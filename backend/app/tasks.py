"""
Celery tasks for TusCoach background processing.

Reliability features:
- Exponential backoff retries on transient errors (network, DB timeouts)
- Row-level locking (SELECT … FOR UPDATE SKIP LOCKED) to prevent duplicate
  processing when multiple workers / overlapping beats run concurrently
- Per-item error handling so one bad record doesn't fail the whole batch
- Structured logging with counts per run
"""
import logging
from datetime import datetime, timedelta, timezone as tz

import requests.exceptions
from sqlalchemy import or_
from sqlalchemy.exc import OperationalError

from app.core.celery_app import celery_app
from app.core.db import SessionLocal
from app.models.devices import Device
from app.models.events import EventLog
from app.models.notifications import Notification
from app.models.workflow import WorkflowRun
from app.services.expo_push_service import (
    send_expo_push_notification,
    process_expo_response,
)
from app.services.notification_service import (
    compute_quiet_hours_delay,
    defer_notification,
    mark_notification_failed,
    mark_notification_sent,
)
from app.services.workflow_engine import run_workflow

logger = logging.getLogger("tuscoach.tasks")

# Exception types that indicate transient failures worth retrying
_TRANSIENT = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
    OperationalError,
    OSError,
)


# ---------------------------------------------------------------------------
# send_pending_notifications
# ---------------------------------------------------------------------------
@celery_app.task(
    name="send_pending_notifications",
    bind=True,
    autoretry_for=_TRANSIENT,
    retry_backoff=True,          # 1 s → 2 s → 4 s …
    retry_backoff_max=300,       # cap at 5 min
    retry_jitter=True,
    max_retries=5,
)
def send_pending_notifications(self):
    """
    Send pending push notifications via Expo Push API.

    Uses SELECT … FOR UPDATE SKIP LOCKED so overlapping runs (or multiple
    workers) never double-send the same notification.
    """
    db = SessionLocal()
    try:
        utc_now = datetime.now(tz.utc)

        # Lock rows so concurrent workers skip them
        sendable = (
            db.query(Notification)
            .filter(
                or_(
                    Notification.status == "pending",
                    (Notification.status == "deferred")
                    & (Notification.next_attempt_at <= utc_now),
                )
            )
            .with_for_update(skip_locked=True)
            .limit(100)
            .all()
        )

        if not sendable:
            logger.debug("send_pending_notifications: nothing to send")
            return {"sent": 0, "failed": 0, "deferred": 0}

        sent = 0
        failed = 0
        deferred = 0

        for notification in sendable:
            try:
                # Re-check quiet hours at actual send time
                send_after = compute_quiet_hours_delay(
                    db, notification.user_id, now=utc_now
                )
                if send_after:
                    defer_notification(db, notification, send_after)
                    deferred += 1
                    continue

                # If it was deferred, flip back to pending
                if notification.status == "deferred":
                    notification.status = "pending"
                    notification.next_attempt_at = None
                    db.commit()

                # Find devices
                devices = (
                    db.query(Device)
                    .filter(Device.user_id == notification.user_id)
                    .all()
                )
                if not devices:
                    mark_notification_failed(
                        db, notification.id, "No devices registered"
                    )
                    db.commit()
                    failed += 1
                    continue

                expo_tokens = [d.expo_push_token for d in devices]
                expo_response = send_expo_push_notification(
                    expo_push_tokens=expo_tokens,
                    title=notification.title,
                    body=notification.body,
                    data=notification.data,
                )
                stats = process_expo_response(
                    db=db,
                    notification=notification,
                    expo_tokens=expo_tokens,
                    expo_response=expo_response,
                )
                if stats["success"] > 0:
                    sent += 1
                else:
                    failed += 1

            except _TRANSIENT:
                # Let Celery autoretry handle the whole task
                db.rollback()
                raise
            except Exception:
                # Non-transient error for this notification — mark failed, continue
                db.rollback()
                mark_notification_failed(
                    db, notification.id, "Unexpected processing error"
                )
                db.commit()
                failed += 1
                logger.exception(
                    "send_pending_notifications: notification %s failed",
                    notification.id,
                )

        logger.info(
            "send_pending_notifications complete: sent=%d failed=%d deferred=%d",
            sent,
            failed,
            deferred,
        )
        return {"sent": sent, "failed": failed, "deferred": deferred}

    except _TRANSIENT:
        db.rollback()
        raise  # Celery autoretry picks this up
    finally:
        db.close()


# ---------------------------------------------------------------------------
# process_recent_events
# ---------------------------------------------------------------------------
@celery_app.task(
    name="process_recent_events",
    bind=True,
    autoretry_for=_TRANSIENT,
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=5,
)
def process_recent_events(self):
    """
    Process unprocessed events from the last 24 h and trigger workflows.

    Idempotency: events with processed_at already set are skipped by the
    query, and each event is committed individually.
    Row-level locking prevents duplicate processing across workers.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.now(tz.utc) - timedelta(days=1)

        events = (
            db.query(EventLog)
            .filter(
                EventLog.processed_at.is_(None),
                EventLog.created_at >= cutoff,
            )
            .order_by(EventLog.created_at)
            .with_for_update(skip_locked=True)
            .all()
        )

        processed = 0
        workflows_triggered = 0
        skipped = 0
        errors = 0

        for event in events:
            try:
                if not event.student_id:
                    event.processed_at = datetime.now(tz.utc)
                    db.commit()
                    skipped += 1
                    continue

                triggered = False

                if event.event_type == "study_session_created":
                    six_hours_ago = datetime.now(tz.utc) - timedelta(hours=6)
                    recent = (
                        db.query(WorkflowRun)
                        .filter(
                            WorkflowRun.student_id == event.student_id,
                            WorkflowRun.workflow_name == "daily_review",
                            WorkflowRun.created_at >= six_hours_ago,
                        )
                        .first()
                    )
                    if not recent:
                        run_workflow(
                            db=db,
                            student_id=event.student_id,
                            workflow_name="daily_review",
                            trigger_event_id=event.id,
                        )
                        triggered = True

                elif event.event_type == "mock_exam_created":
                    run_workflow(
                        db=db,
                        student_id=event.student_id,
                        workflow_name="exam_intervention",
                        trigger_event_id=event.id,
                    )
                    triggered = True

                # Mark processed — idempotency guard for the next run
                event.processed_at = datetime.now(tz.utc)
                db.commit()
                processed += 1
                if triggered:
                    workflows_triggered += 1

            except _TRANSIENT:
                db.rollback()
                raise  # Let Celery retry the whole task
            except Exception:
                db.rollback()
                errors += 1
                logger.exception(
                    "process_recent_events: event %s (%s) failed",
                    event.id,
                    event.event_type,
                )
                # Mark event as processed to prevent infinite retry loop
                try:
                    event.processed_at = datetime.now(tz.utc)
                    db.commit()
                except Exception:
                    db.rollback()

        logger.info(
            "process_recent_events complete: processed=%d workflows=%d skipped=%d errors=%d",
            processed,
            workflows_triggered,
            skipped,
            errors,
        )
        return {
            "processed": processed,
            "workflows_triggered": workflows_triggered,
            "skipped": skipped,
            "errors": errors,
        }

    except _TRANSIENT:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# inactivity_scan
# ---------------------------------------------------------------------------
@celery_app.task(
    name="inactivity_scan",
    bind=True,
    autoretry_for=_TRANSIENT,
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def inactivity_scan(self):
    """Scan for inactive students and trigger rescue workflows."""
    db = SessionLocal()
    try:
        # MVP: single student — extend to loop over all active students later
        run_workflow(db=db, student_id=1, workflow_name="inactivity_rescue")
        logger.info("inactivity_scan complete")
    except _TRANSIENT:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# nightly_daily_review
# ---------------------------------------------------------------------------
@celery_app.task(
    name="nightly_daily_review",
    bind=True,
    autoretry_for=_TRANSIENT,
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def nightly_daily_review(self):
    """Run the daily review workflow each night."""
    db = SessionLocal()
    try:
        # MVP: single student — extend to loop over all active students later
        run_workflow(db=db, student_id=1, workflow_name="daily_review")
        logger.info("nightly_daily_review complete")
    except _TRANSIENT:
        db.rollback()
        raise
    finally:
        db.close()
