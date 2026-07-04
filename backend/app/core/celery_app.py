from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "tuscoach",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"],   # <-- önemli
)

# Production configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=False,
    # Reliability: acknowledge tasks only after they complete (not on receive).
    # If a worker crashes mid-task, the message is re-delivered.
    task_acks_late=True,
    # Fetch one task at a time so a crashed worker doesn't lose a batch.
    worker_prefetch_multiplier=1,
    # If a worker is killed (SIGKILL), reject the task so it's re-queued.
    task_reject_on_worker_lost=True,
)

# Autodiscover tasks module(s)
celery_app.autodiscover_tasks(["app"])

# --- BEAT SCHEDULE (PRODUCTION) ---
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "inactivity_scan_every_6h": {
        "task": "inactivity_scan",
        "schedule": 60.0 * 60.0 * 6,  # Every 6 hours
    },
    "nightly_daily_review_2130": {
        "task": "nightly_daily_review",
        "schedule": crontab(hour=21, minute=30),  # Daily at 21:30 Europe/Istanbul
    },
    "process_recent_events_every_2min": {
        "task": "process_recent_events",
        "schedule": 120.0,  # Every 2 minutes
    },
    "send_pending_notifications_every_1min": {
        "task": "send_pending_notifications",
        "schedule": 60.0,  # Every 1 minute
    },
}