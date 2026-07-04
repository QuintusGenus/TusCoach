"""
Notification Service

Handles enqueueing and managing push notifications.
Includes quiet-hours gating based on student preferences.
"""
import logging
from datetime import datetime, time, timedelta, timezone
from typing import Optional, Dict, Any, Tuple

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.notifications import Notification
from app.models.user import StudentProfile
from app.models.preferences import StudentPreferences

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Quiet-hours helpers
# ---------------------------------------------------------------------------

def _get_quiet_hours(db: Session, user_id: int) -> Tuple[Optional[time], Optional[time], str]:
    """
    Return (quiet_hours_start, quiet_hours_end, timezone) for a user.
    Returns (None, None, tz) when quiet hours are not configured.
    """
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == user_id)
        .first()
    )
    if not profile:
        return None, None, "Europe/Istanbul"

    prefs = (
        db.query(StudentPreferences)
        .filter(StudentPreferences.student_id == profile.id)
        .first()
    )
    if not prefs:
        return None, None, "Europe/Istanbul"

    return prefs.quiet_hours_start, prefs.quiet_hours_end, prefs.timezone


def _is_within_quiet_hours(now_time: time, start: time, end: time) -> bool:
    """
    Check if now_time falls within the [start, end) quiet window.
    Handles overnight ranges (e.g. 23:00 -> 07:00).
    """
    if start <= end:
        # Same-day range, e.g. 14:00-18:00
        return start <= now_time < end
    else:
        # Overnight range, e.g. 23:00-07:00
        return now_time >= start or now_time < end


def compute_quiet_hours_delay(
    db: Session,
    user_id: int,
    now: Optional[datetime] = None,
) -> Optional[datetime]:
    """
    If the user is currently in quiet hours, return a UTC datetime representing
    when the notification should be sent (= quiet_hours_end today or tomorrow).
    Returns None if send-now is OK.

    `now` should be a timezone-aware UTC datetime.  Defaults to utcnow().
    """
    qh_start, qh_end, tz_name = _get_quiet_hours(db, user_id)
    if qh_start is None or qh_end is None:
        return None  # No quiet hours configured → send now

    # Resolve student-local time
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Europe/Istanbul")

    if now is None:
        now = datetime.now(timezone.utc)

    local_now = now.astimezone(tz)
    local_time = local_now.time()

    if not _is_within_quiet_hours(local_time, qh_start, qh_end):
        return None  # Outside quiet hours → send now

    # Compute the next eligible moment (quiet_hours_end) in student-local tz,
    # then convert to UTC.
    end_today = datetime.combine(local_now.date(), qh_end, tzinfo=tz)
    if end_today <= local_now:
        # End is tomorrow (overnight quiet window)
        end_today += timedelta(days=1)

    return end_today.astimezone(timezone.utc)


def defer_notification(
    db: Session, notification: Notification, send_after: datetime
) -> None:
    """Mark notification as deferred and set next_attempt_at."""
    notification.status = "deferred"
    notification.next_attempt_at = send_after
    notification.attempts += 1
    db.commit()
    logger.info(
        f"Deferred notification {notification.id} until {send_after.isoformat()}"
    )


# ---------------------------------------------------------------------------
# Core CRUD
# ---------------------------------------------------------------------------

def enqueue_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    workflow_run_id: Optional[int] = None
) -> Optional[Notification]:
    """
    Enqueue a notification for delivery.

    If the user is inside quiet hours the notification is created with
    status='deferred' and next_attempt_at set to quiet-hours end.
    """
    # Check quiet hours *before* persisting
    send_after = compute_quiet_hours_delay(db, user_id)

    try:
        notification = Notification(
            user_id=user_id,
            workflow_run_id=workflow_run_id,
            type=type,
            title=title,
            body=body,
            data=data,
            status="deferred" if send_after else "pending",
            next_attempt_at=send_after,
            attempts=0,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        if send_after:
            logger.info(
                f"Enqueued deferred notification {notification.id} for user {user_id} "
                f"(quiet hours, next_attempt_at={send_after.isoformat()})"
            )
        else:
            logger.info(
                f"Enqueued notification {notification.id} for user {user_id} "
                f"(type={type}, workflow_run_id={workflow_run_id})"
            )
        return notification

    except IntegrityError as e:
        db.rollback()
        if workflow_run_id and "workflow_run_id" in str(e):
            logger.debug(
                f"Notification already exists for workflow_run_id={workflow_run_id}, skipping"
            )
            return None
        raise


def mark_notification_sent(db: Session, notification_id: int) -> None:
    """Mark a notification as successfully sent."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification:
        notification.status = "sent"
        notification.sent_at = datetime.utcnow()
        notification.error = None
        db.commit()
        logger.debug(f"Marked notification {notification_id} as sent")


def mark_notification_failed(db: Session, notification_id: int, error: str) -> None:
    """Mark a notification as failed."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification:
        notification.status = "failed"
        notification.error = error
        db.commit()
        logger.warning(f"Marked notification {notification_id} as failed: {error}")


def enqueue_coach_message_notification(
    db: Session,
    user_id: int,
    workflow_run_id: int,
    student_message: Dict[str, Any],
    message_id: Optional[int] = None
) -> Optional[Notification]:
    """
    Enqueue a push notification for a coach message.

    Args:
        db: Database session
        user_id: Target user ID
        workflow_run_id: Workflow run ID (ensures idempotency)
        student_message: Message dict with 'subject' and 'body' keys
        message_id: Optional coach_messages.id for direct deep linking

    Returns:
        Notification object if created, None if duplicate
    """
    title = student_message.get("subject") or "New message from your coach"
    body = student_message.get("body", "")

    if len(body) > 120:
        body = body[:117] + "..."

    data = {
        "kind": "coach_message",
        "workflow_run_id": workflow_run_id,
        "student_id": user_id
    }

    if message_id:
        data["message_id"] = message_id

    return enqueue_notification(
        db=db,
        user_id=user_id,
        type="coach_message",
        title=title,
        body=body,
        data=data,
        workflow_run_id=workflow_run_id
    )
