"""
Tests for quiet-hours notification gating.

Verifies:
- Notifications enqueued during quiet hours are deferred
- Notifications enqueued outside quiet hours are pending
- Overnight quiet hours (e.g. 23:00-07:00) are handled correctly
- No quiet hours configured → send immediately
- _is_within_quiet_hours edge cases
- compute_quiet_hours_delay returns correct UTC send-after time
- defer_notification updates status and next_attempt_at
"""
import pytest
from datetime import datetime, date, time, timedelta, timezone
from unittest.mock import patch

from app.models.notifications import Notification
from app.models.user import User, StudentProfile
from app.models.preferences import StudentPreferences
from app.core.security import get_password_hash
from app.services.notification_service import (
    _is_within_quiet_hours,
    compute_quiet_hours_delay,
    defer_notification,
    enqueue_notification,
    enqueue_coach_message_notification,
)


# ---------------------------------------------------------------------------
# Unit tests for _is_within_quiet_hours
# ---------------------------------------------------------------------------

class TestIsWithinQuietHours:
    def test_same_day_inside(self):
        assert _is_within_quiet_hours(time(14, 30), time(14, 0), time(18, 0)) is True

    def test_same_day_outside_before(self):
        assert _is_within_quiet_hours(time(13, 0), time(14, 0), time(18, 0)) is False

    def test_same_day_outside_after(self):
        assert _is_within_quiet_hours(time(18, 0), time(14, 0), time(18, 0)) is False

    def test_same_day_at_start(self):
        assert _is_within_quiet_hours(time(14, 0), time(14, 0), time(18, 0)) is True

    def test_overnight_inside_late(self):
        # 23:00-07:00, current time is 23:30 → inside
        assert _is_within_quiet_hours(time(23, 30), time(23, 0), time(7, 0)) is True

    def test_overnight_inside_early(self):
        # 23:00-07:00, current time is 03:00 → inside
        assert _is_within_quiet_hours(time(3, 0), time(23, 0), time(7, 0)) is True

    def test_overnight_outside(self):
        # 23:00-07:00, current time is 12:00 → outside
        assert _is_within_quiet_hours(time(12, 0), time(23, 0), time(7, 0)) is False

    def test_overnight_at_end(self):
        # 23:00-07:00, current time is 07:00 → outside (end is exclusive)
        assert _is_within_quiet_hours(time(7, 0), time(23, 0), time(7, 0)) is False


# ---------------------------------------------------------------------------
# compute_quiet_hours_delay
# ---------------------------------------------------------------------------

def test_compute_delay_no_preferences(db, test_user):
    """No preferences → returns None (send now)."""
    result = compute_quiet_hours_delay(db, test_user.id)
    assert result is None


def test_compute_delay_no_quiet_hours(db, test_user, test_student_profile):
    """Preferences exist but no quiet hours set → returns None."""
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        daily_target_minutes_weekday=120,
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()

    result = compute_quiet_hours_delay(db, test_user.id)
    assert result is None


def test_compute_delay_outside_quiet_hours(db, test_user, test_student_profile):
    """Current time is outside quiet hours → returns None."""
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        quiet_hours_start=time(23, 0),
        quiet_hours_end=time(7, 0),
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()

    # Simulate 14:00 Istanbul time (UTC+3 in summer, but let's use a fixed moment)
    # 2026-02-06 11:00 UTC = 14:00 Istanbul (UTC+3)
    fake_now = datetime(2026, 2, 6, 11, 0, 0, tzinfo=timezone.utc)
    result = compute_quiet_hours_delay(db, test_user.id, now=fake_now)
    assert result is None


def test_compute_delay_inside_overnight_quiet_hours(db, test_user, test_student_profile):
    """Current time is 01:00 Istanbul, quiet 23:00-07:00 → deferred until 07:00 Istanbul."""
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        quiet_hours_start=time(23, 0),
        quiet_hours_end=time(7, 0),
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()

    # 2026-02-06 22:00 UTC = 2026-02-07 01:00 Istanbul (UTC+3)
    fake_now = datetime(2026, 2, 6, 22, 0, 0, tzinfo=timezone.utc)
    result = compute_quiet_hours_delay(db, test_user.id, now=fake_now)

    assert result is not None
    # Should be 07:00 Istanbul = 04:00 UTC on 2026-02-07
    assert result.hour == 4
    assert result.day == 7
    assert result.tzinfo == timezone.utc


def test_compute_delay_inside_same_day_quiet_hours(db, test_user, test_student_profile):
    """Current time is 15:00 Istanbul, quiet 14:00-18:00 → deferred until 18:00 Istanbul."""
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        quiet_hours_start=time(14, 0),
        quiet_hours_end=time(18, 0),
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()

    # 2026-02-06 12:00 UTC = 15:00 Istanbul (UTC+3)
    fake_now = datetime(2026, 2, 6, 12, 0, 0, tzinfo=timezone.utc)
    result = compute_quiet_hours_delay(db, test_user.id, now=fake_now)

    assert result is not None
    # 18:00 Istanbul = 15:00 UTC
    assert result.hour == 15
    assert result.day == 6
    assert result.tzinfo == timezone.utc


# ---------------------------------------------------------------------------
# enqueue_notification with quiet hours
# ---------------------------------------------------------------------------

def test_enqueue_during_quiet_hours_creates_deferred(db, test_user, test_student_profile):
    """Notification enqueued during quiet hours gets status=deferred."""
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        quiet_hours_start=time(23, 0),
        quiet_hours_end=time(7, 0),
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()

    # 01:00 Istanbul = 22:00 UTC previous day
    fake_now = datetime(2026, 2, 6, 22, 0, 0, tzinfo=timezone.utc)

    with patch("app.services.notification_service.datetime") as mock_dt:
        mock_dt.now.return_value = fake_now
        mock_dt.utcnow.return_value = fake_now.replace(tzinfo=None)
        mock_dt.combine = datetime.combine
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        notification = enqueue_notification(
            db=db,
            user_id=test_user.id,
            type="coach_message",
            title="Test",
            body="Hello",
        )

    assert notification is not None
    assert notification.status == "deferred"
    assert notification.next_attempt_at is not None


def test_enqueue_outside_quiet_hours_creates_pending(db, test_user, test_student_profile):
    """Notification enqueued outside quiet hours gets status=pending."""
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        quiet_hours_start=time(23, 0),
        quiet_hours_end=time(7, 0),
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()

    # 14:00 Istanbul = 11:00 UTC
    fake_now = datetime(2026, 2, 6, 11, 0, 0, tzinfo=timezone.utc)

    with patch("app.services.notification_service.datetime") as mock_dt:
        mock_dt.now.return_value = fake_now
        mock_dt.utcnow.return_value = fake_now.replace(tzinfo=None)
        mock_dt.combine = datetime.combine
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        notification = enqueue_notification(
            db=db,
            user_id=test_user.id,
            type="coach_message",
            title="Test",
            body="Hello",
        )

    assert notification is not None
    assert notification.status == "pending"
    assert notification.next_attempt_at is None


def test_enqueue_without_preferences_creates_pending(db, test_user):
    """No preferences at all → always pending."""
    notification = enqueue_notification(
        db=db,
        user_id=test_user.id,
        type="coach_message",
        title="Test",
        body="Hello",
    )

    assert notification is not None
    assert notification.status == "pending"
    assert notification.next_attempt_at is None


# ---------------------------------------------------------------------------
# defer_notification
# ---------------------------------------------------------------------------

def test_defer_notification_updates_fields(db, test_user):
    """defer_notification sets status, next_attempt_at, and increments attempts."""
    notification = Notification(
        user_id=test_user.id,
        type="coach_message",
        title="Test",
        body="Hello",
        status="pending",
        attempts=0,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    send_after = datetime(2026, 2, 7, 4, 0, 0, tzinfo=timezone.utc)
    defer_notification(db, notification, send_after)

    db.refresh(notification)
    assert notification.status == "deferred"
    assert notification.next_attempt_at is not None
    assert notification.attempts == 1


def test_defer_notification_increments_attempts(db, test_user):
    """Multiple deferrals increment the attempts counter."""
    notification = Notification(
        user_id=test_user.id,
        type="coach_message",
        title="Test",
        body="Hello",
        status="pending",
        attempts=0,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    send_after = datetime(2026, 2, 7, 4, 0, 0, tzinfo=timezone.utc)
    defer_notification(db, notification, send_after)
    defer_notification(db, notification, send_after + timedelta(hours=1))

    db.refresh(notification)
    assert notification.attempts == 2
