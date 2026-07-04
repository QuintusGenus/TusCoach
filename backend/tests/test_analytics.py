"""
Tests for analytics endpoints: summary, weekly, daily
"""
import pytest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from app.models.study import StudySession
from app.models.preferences import StudentPreferences
from app.services.stats_service import (
    get_stats_summary,
    get_weekly_stats,
    get_daily_stats,
    _compute_streak,
)


# ── helpers ──

def _seed_session(db, user_id, d: date, minutes: int):
    s = StudySession(student_id=user_id, date=d, minutes=minutes)
    db.add(s)
    db.commit()


def _seed_preferences(db, profile_id, **kwargs):
    prefs = StudentPreferences(student_id=profile_id, **kwargs)
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


# ── Summary ──

class TestStatsSummary:
    @patch("app.services.stats_service.date")
    def test_today_minutes(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)  # Wednesday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_session(db, test_user.id, today, 45)
        _seed_session(db, test_user.id, today, 30)
        _seed_session(db, test_user.id, today - timedelta(days=1), 60)

        result = get_stats_summary(db, test_user.id)

        assert result["today_minutes"] == 75
        assert result["week_minutes"] == 135  # 75 + 60

    @patch("app.services.stats_service.date")
    def test_today_target_weekday(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)  # Wednesday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            daily_target_minutes_weekday=120,
            daily_target_minutes_weekend=60,
        )

        result = get_stats_summary(db, test_user.id)

        assert result["today_target_minutes"] == 120

    @patch("app.services.stats_service.date")
    def test_today_target_weekend(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 14)  # Saturday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            daily_target_minutes_weekday=120,
            daily_target_minutes_weekend=60,
        )

        result = get_stats_summary(db, test_user.id)

        assert result["today_target_minutes"] == 60

    @patch("app.services.stats_service.date")
    def test_no_preferences_target_is_none(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_stats_summary(db, test_user.id)

        assert result["today_target_minutes"] is None
        assert result["week_target_minutes"] is None

    @patch("app.services.stats_service._now")
    @patch("app.services.stats_service.date")
    def test_streak_days(self, mock_date, mock_now, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        # 3-day streak: today, yesterday, day before (all >= 10 MIN_DAILY_MINUTES)
        _seed_session(db, test_user.id, today, 30)
        _seed_session(db, test_user.id, today - timedelta(days=1), 20)
        _seed_session(db, test_user.id, today - timedelta(days=2), 10)
        # Gap on day 3
        _seed_session(db, test_user.id, today - timedelta(days=4), 50)

        result = get_stats_summary(db, test_user.id)

        assert result["streak_days"] == 3

    @patch("app.services.stats_service._now")
    @patch("app.services.stats_service.date")
    def test_streak_zero_when_no_today(self, mock_date, mock_now, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        # Session yesterday but not today
        _seed_session(db, test_user.id, today - timedelta(days=1), 20)

        result = get_stats_summary(db, test_user.id)

        assert result["streak_days"] == 0

    @patch("app.services.stats_service.date")
    def test_last_session_date(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_session(db, test_user.id, today - timedelta(days=5), 30)
        _seed_session(db, test_user.id, today - timedelta(days=2), 20)

        result = get_stats_summary(db, test_user.id)

        assert result["last_session_date"] == today - timedelta(days=2)

    @patch("app.services.stats_service.date")
    def test_last_session_date_none(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_stats_summary(db, test_user.id)

        assert result["last_session_date"] is None

    @patch("app.services.stats_service.date")
    def test_exam_countdown(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            exam_date=date(2025, 9, 15),
        )

        result = get_stats_summary(db, test_user.id)

        assert result["exam_countdown_days"] == (date(2025, 9, 15) - today).days

    @patch("app.services.stats_service.date")
    def test_exam_countdown_past(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            exam_date=date(2025, 5, 1),  # already past
        )

        result = get_stats_summary(db, test_user.id)

        assert result["exam_countdown_days"] is None

    @patch("app.services.stats_service.date")
    def test_week_target_minutes(self, mock_date, db, test_user, test_student_profile):
        # Wed Jun 11 2025 → week is Thu Jun 5 .. Wed Jun 11
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            daily_target_minutes_weekday=100,
            daily_target_minutes_weekend=50,
        )

        result = get_stats_summary(db, test_user.id)

        # Last 7 days: Thu(wd) Fri(wd) Sat(we) Sun(we) Mon(wd) Tue(wd) Wed(wd)
        # = 5*100 + 2*50 = 600
        assert result["week_target_minutes"] == 600


# ── Weekly ──

class TestWeeklyStats:
    @patch("app.services.stats_service.date")
    def test_weekly_buckets_count(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)  # Wednesday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_weekly_stats(db, test_user.id, weeks=4)

        assert len(result) == 4

    @patch("app.services.stats_service.date")
    def test_weekly_buckets_ordered_oldest_first(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_weekly_stats(db, test_user.id, weeks=4)

        for i in range(len(result) - 1):
            assert result[i]["week_start"] < result[i + 1]["week_start"]

    @patch("app.services.stats_service.date")
    def test_weekly_aggregates_sessions(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)  # Wednesday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        # Current week's Monday is Jun 9
        _seed_session(db, test_user.id, date(2025, 6, 9), 40)   # Mon
        _seed_session(db, test_user.id, date(2025, 6, 10), 50)  # Tue
        _seed_session(db, test_user.id, date(2025, 6, 11), 60)  # Wed (today)

        result = get_weekly_stats(db, test_user.id, weeks=2)

        # Last bucket is current week
        assert result[-1]["minutes"] == 150

    @patch("app.services.stats_service.date")
    def test_weekly_week_start_is_monday(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)  # Wednesday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_weekly_stats(db, test_user.id, weeks=1)

        # Week start should be Monday Jun 9
        assert result[0]["week_start"] == date(2025, 6, 9)
        assert result[0]["week_start"].weekday() == 0  # Monday

    @patch("app.services.stats_service.date")
    def test_weekly_target_minutes(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)  # Wednesday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            daily_target_minutes_weekday=100,
            daily_target_minutes_weekend=50,
        )

        result = get_weekly_stats(db, test_user.id, weeks=1)

        # Current week Mon-Wed (3 weekdays so far, clamped to today)
        # Mon(100) + Tue(100) + Wed(100) = 300
        assert result[0]["target_minutes"] == 300

    @patch("app.services.stats_service.date")
    def test_weekly_no_prefs_target_none(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_weekly_stats(db, test_user.id, weeks=1)

        assert result[0]["target_minutes"] is None


# ── Daily ──

class TestDailyStats:
    @patch("app.services.stats_service.date")
    def test_daily_count(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_daily_stats(db, test_user.id, days=7)

        assert len(result) == 7

    @patch("app.services.stats_service.date")
    def test_daily_ordered_oldest_first(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_daily_stats(db, test_user.id, days=7)

        for i in range(len(result) - 1):
            assert result[i]["date"] < result[i + 1]["date"]

    @patch("app.services.stats_service.date")
    def test_daily_includes_zeros(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_session(db, test_user.id, today, 30)
        _seed_session(db, test_user.id, today - timedelta(days=3), 20)

        result = get_daily_stats(db, test_user.id, days=7)

        # Last entry is today
        assert result[-1]["date"] == today
        assert result[-1]["minutes"] == 30

        # 3 days ago
        assert result[-4]["minutes"] == 20

        # Days with no sessions should be 0
        assert result[-2]["minutes"] == 0

    @patch("app.services.stats_service.date")
    def test_daily_target_weekday_weekend(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 14)  # Saturday
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_preferences(
            db, test_student_profile.id,
            daily_target_minutes_weekday=100,
            daily_target_minutes_weekend=50,
        )

        result = get_daily_stats(db, test_user.id, days=3)

        # Thu(wd), Fri(wd), Sat(we)
        assert result[0]["target_minutes"] == 100  # Thu
        assert result[1]["target_minutes"] == 100  # Fri
        assert result[2]["target_minutes"] == 50   # Sat

    @patch("app.services.stats_service.date")
    def test_daily_multiple_sessions_same_day(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        _seed_session(db, test_user.id, today, 20)
        _seed_session(db, test_user.id, today, 35)
        _seed_session(db, test_user.id, today, 15)

        result = get_daily_stats(db, test_user.id, days=1)

        assert result[0]["minutes"] == 70

    @patch("app.services.stats_service.date")
    def test_daily_no_prefs_target_none(self, mock_date, db, test_user, test_student_profile):
        today = date(2025, 6, 11)
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        result = get_daily_stats(db, test_user.id, days=1)

        assert result[0]["target_minutes"] is None


# ── Streak Hardening ──

class TestStreakHardening:
    """Tests for MIN_DAILY_MINUTES threshold and timezone awareness."""

    @patch("app.services.stats_service._now")
    def test_below_threshold_breaks_streak(self, mock_now, db, test_user, test_student_profile):
        """9 minutes (< 10 MIN_DAILY_MINUTES) should NOT count toward streak."""
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        today = date(2025, 6, 11)
        _seed_session(db, test_user.id, today, 9)  # Below threshold
        _seed_session(db, test_user.id, today - timedelta(days=1), 30)

        streak = _compute_streak(db, test_user.id)
        assert streak == 0  # Today below threshold → streak 0

    @patch("app.services.stats_service._now")
    def test_at_threshold_counts(self, mock_now, db, test_user, test_student_profile):
        """Exactly 10 minutes (= MIN_DAILY_MINUTES) should count."""
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        today = date(2025, 6, 11)
        _seed_session(db, test_user.id, today, 10)
        _seed_session(db, test_user.id, today - timedelta(days=1), 10)

        streak = _compute_streak(db, test_user.id)
        assert streak == 2

    @patch("app.services.stats_service._now")
    def test_multiple_small_sessions_sum_to_threshold(self, mock_now, db, test_user, test_student_profile):
        """Multiple sessions summing to >= threshold should count."""
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        today = date(2025, 6, 11)
        _seed_session(db, test_user.id, today, 4)
        _seed_session(db, test_user.id, today, 3)
        _seed_session(db, test_user.id, today, 3)  # total = 10

        streak = _compute_streak(db, test_user.id)
        assert streak == 1

    @patch("app.services.stats_service._now")
    def test_missing_day_breaks_streak(self, mock_now, db, test_user, test_student_profile):
        """A gap day in the middle should break the streak."""
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        today = date(2025, 6, 11)
        _seed_session(db, test_user.id, today, 30)
        # day -1 is missing
        _seed_session(db, test_user.id, today - timedelta(days=2), 30)
        _seed_session(db, test_user.id, today - timedelta(days=3), 30)

        streak = _compute_streak(db, test_user.id)
        assert streak == 1  # Only today

    @patch("app.services.stats_service._now")
    def test_day_below_threshold_breaks_streak(self, mock_now, db, test_user, test_student_profile):
        """A day with minutes < threshold in the middle breaks the streak."""
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        today = date(2025, 6, 11)
        _seed_session(db, test_user.id, today, 30)
        _seed_session(db, test_user.id, today - timedelta(days=1), 5)  # Below threshold
        _seed_session(db, test_user.id, today - timedelta(days=2), 30)

        streak = _compute_streak(db, test_user.id)
        assert streak == 1  # Yesterday below threshold breaks it

    @patch("app.services.stats_service._now")
    def test_no_sessions_streak_zero(self, mock_now, db, test_user, test_student_profile):
        """No sessions at all should return streak 0."""
        mock_now.return_value = datetime(2025, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

        streak = _compute_streak(db, test_user.id)
        assert streak == 0

    # ── Timezone tests ──

    @patch("app.services.stats_service._now")
    def test_timezone_late_night_istanbul(self, mock_now, db, test_user, test_student_profile):
        """
        UTC 22:00 Jun 11 = Istanbul 01:00 Jun 12.
        Session on Jun 12 should count because "today" in Istanbul is Jun 12.
        """
        # UTC: 22:00 Jun 11 → Istanbul (UTC+3): 01:00 Jun 12
        mock_now.return_value = datetime(2025, 6, 11, 22, 0, 0, tzinfo=timezone.utc)

        istanbul_today = date(2025, 6, 12)
        _seed_session(db, test_user.id, istanbul_today, 30)
        _seed_session(db, test_user.id, istanbul_today - timedelta(days=1), 20)  # Jun 11

        streak = _compute_streak(db, test_user.id)
        assert streak == 2  # Jun 12 (today in Istanbul) + Jun 11

    @patch("app.services.stats_service._now")
    def test_timezone_pre_midnight_istanbul(self, mock_now, db, test_user, test_student_profile):
        """
        UTC 20:30 Jun 11 = Istanbul 23:30 Jun 11.
        "Today" in Istanbul is still Jun 11.
        """
        mock_now.return_value = datetime(2025, 6, 11, 20, 30, 0, tzinfo=timezone.utc)

        _seed_session(db, test_user.id, date(2025, 6, 11), 30)

        streak = _compute_streak(db, test_user.id)
        assert streak == 1

    @patch("app.services.stats_service._now")
    def test_timezone_future_session_not_counted(self, mock_now, db, test_user, test_student_profile):
        """
        Session for Istanbul's tomorrow should not be counted in streak.
        """
        # Istanbul today = Jun 11 (23:30 Istanbul = 20:30 UTC)
        mock_now.return_value = datetime(2025, 6, 11, 20, 30, 0, tzinfo=timezone.utc)

        _seed_session(db, test_user.id, date(2025, 6, 12), 60)  # Tomorrow
        # No session for today (Jun 11)

        streak = _compute_streak(db, test_user.id)
        assert streak == 0  # Jun 12 is outside range, Jun 11 has nothing

    @patch("app.services.stats_service._now")
    def test_timezone_custom_tz(self, mock_now, db, test_user, test_student_profile):
        """
        Student with US/Eastern timezone (UTC-5 in winter, UTC-4 in summer).
        Jun 11 23:00 UTC = Jun 11 19:00 Eastern (summer, UTC-4).
        """
        # Set timezone to US/Eastern
        _seed_preferences(db, test_student_profile.id, timezone="US/Eastern")

        # UTC: 23:00 Jun 11 → Eastern (UTC-4 summer): 19:00 Jun 11
        mock_now.return_value = datetime(2025, 6, 11, 23, 0, 0, tzinfo=timezone.utc)

        _seed_session(db, test_user.id, date(2025, 6, 11), 30)

        streak = _compute_streak(db, test_user.id)
        assert streak == 1  # Today in Eastern is Jun 11

    @patch("app.services.stats_service._now")
    def test_timezone_date_differs_from_utc(self, mock_now, db, test_user, test_student_profile):
        """
        UTC 02:00 Jun 12 = Istanbul 05:00 Jun 12.
        But US/Eastern = 22:00 Jun 11 (still previous day).
        With Eastern tz, today should be Jun 11.
        """
        _seed_preferences(db, test_student_profile.id, timezone="US/Eastern")

        # UTC: 02:00 Jun 12 → Eastern (UTC-4 summer): 22:00 Jun 11
        mock_now.return_value = datetime(2025, 6, 12, 2, 0, 0, tzinfo=timezone.utc)

        # Session on Jun 11 (Eastern's "today")
        _seed_session(db, test_user.id, date(2025, 6, 11), 30)
        # Session on Jun 12 (Eastern's "tomorrow") — should NOT count
        _seed_session(db, test_user.id, date(2025, 6, 12), 30)

        streak = _compute_streak(db, test_user.id)
        assert streak == 1  # Only Jun 11 counts (today in Eastern)
