"""
Stats Service
Computes statistics from study sessions
"""
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Optional
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import StudySession
from app.services.preferences_service import get_preferences
from app.core.config import get_settings


def get_student_stats(db: Session, student_id: int, range_days: int = 7) -> Dict:
    """
    Compute stats for a student over a given range.

    Args:
        db: Database session
        student_id: Student user ID
        range_days: Number of days to look back (default 7)

    Returns:
        Dict with daily_minutes, total_minutes, streak_days
    """
    # Calculate date range
    end_date = date.today()
    start_date = end_date - timedelta(days=range_days - 1)

    # Query: Sum minutes per date for this student in the range
    daily_data = db.query(
        StudySession.date,
        func.sum(StudySession.minutes).label('total_minutes')
    ).filter(
        StudySession.student_id == student_id,
        StudySession.date >= start_date,
        StudySession.date <= end_date
    ).group_by(
        StudySession.date
    ).order_by(
        StudySession.date
    ).all()

    # Build daily_minutes map
    daily_map = {row.date: int(row.total_minutes) for row in daily_data}

    # Build full daily_minutes list (include days with 0 minutes)
    daily_minutes = []
    for i in range(range_days):
        current_date = start_date + timedelta(days=i)
        minutes = daily_map.get(current_date, 0)
        daily_minutes.append({
            "date": current_date,
            "minutes": minutes
        })

    # Total minutes
    total_minutes = sum(item['minutes'] for item in daily_minutes)

    # Streak calculation (consecutive days from today backwards with >= MIN_DAILY_MINUTES)
    settings = get_settings()
    streak_days = 0
    for i in range(range_days - 1, -1, -1):  # Start from most recent
        current_date = start_date + timedelta(days=i)
        if daily_map.get(current_date, 0) >= settings.MIN_DAILY_MINUTES:
            streak_days += 1
        else:
            break  # Streak broken

    return {
        "range": f"{range_days}d",
        "daily_minutes": daily_minutes,
        "total_minutes": total_minutes,
        "streak_days": streak_days
    }


# ── Analytics helpers ──

def _sum_minutes_for_range(
    db: Session, student_id: int, start: date, end: date
) -> Dict[date, int]:
    """Return {date: minutes} for a student within [start, end]."""
    rows = (
        db.query(StudySession.date, func.sum(StudySession.minutes).label("m"))
        .filter(
            StudySession.student_id == student_id,
            StudySession.date >= start,
            StudySession.date <= end,
        )
        .group_by(StudySession.date)
        .all()
    )
    return {r.date: int(r.m) for r in rows}


def _target_for_date(d: date, weekday_target: Optional[int], weekend_target: Optional[int]) -> Optional[int]:
    """Return target minutes for a given date based on day-of-week."""
    if d.weekday() < 5:  # Mon-Fri
        return weekday_target
    return weekend_target


def _now() -> datetime:
    """Current UTC-aware datetime. Extracted for test mockability."""
    return datetime.now(timezone.utc)


def _student_today(db: Session, user_id: int) -> date:
    """Today's date in the student's timezone (from preferences)."""
    prefs = get_preferences(db, user_id)
    tz = ZoneInfo(prefs.timezone)
    return _now().astimezone(tz).date()


def _compute_streak(db: Session, user_id: int) -> int:
    """Consecutive days with minutes >= MIN_DAILY_MINUTES, from student's today backwards."""
    settings = get_settings()
    today = _student_today(db, user_id)
    # Look back up to 365 days max
    start = today - timedelta(days=364)
    daily = _sum_minutes_for_range(db, user_id, start, today)
    streak = 0
    d = today
    while d >= start:
        if daily.get(d, 0) >= settings.MIN_DAILY_MINUTES:
            streak += 1
        else:
            break
        d -= timedelta(days=1)
    return streak


def _last_session_date(db: Session, student_id: int) -> Optional[date]:
    """Return the most recent study session date, or None."""
    row = (
        db.query(func.max(StudySession.date))
        .filter(StudySession.student_id == student_id)
        .scalar()
    )
    return row


def get_stats_summary(db: Session, user_id: int) -> Dict:
    """
    Dashboard summary:
    today_minutes, today_target_minutes, week_minutes, week_target_minutes,
    streak_days, last_session_date, exam_countdown_days
    """
    prefs = get_preferences(db, user_id)
    today = date.today()

    # Today minutes
    today_map = _sum_minutes_for_range(db, user_id, today, today)
    today_minutes = today_map.get(today, 0)

    # Today target
    today_target = _target_for_date(
        today, prefs.daily_target_minutes_weekday, prefs.daily_target_minutes_weekend
    )

    # Week minutes: last 7 days including today
    week_start = today - timedelta(days=6)
    week_map = _sum_minutes_for_range(db, user_id, week_start, today)
    week_minutes = sum(week_map.values())

    # Week target: sum targets for each of the 7 days
    week_target = None
    if prefs.daily_target_minutes_weekday is not None or prefs.daily_target_minutes_weekend is not None:
        week_target = 0
        for i in range(7):
            d = week_start + timedelta(days=i)
            t = _target_for_date(
                d, prefs.daily_target_minutes_weekday, prefs.daily_target_minutes_weekend
            )
            week_target += t or 0

    # Streak
    streak = _compute_streak(db, user_id)

    # Last session
    last_date = _last_session_date(db, user_id)

    # Exam countdown
    exam_countdown = None
    if prefs.exam_date:
        delta = (prefs.exam_date - today).days
        if delta >= 0:
            exam_countdown = delta

    return {
        "today_minutes": today_minutes,
        "today_target_minutes": today_target,
        "week_minutes": week_minutes,
        "week_target_minutes": week_target,
        "streak_days": streak,
        "last_session_date": last_date,
        "exam_countdown_days": exam_countdown,
    }


def get_weekly_stats(db: Session, user_id: int, weeks: int = 8) -> List[Dict]:
    """
    Return [{week_start, minutes, target_minutes}] for the last N weeks,
    ordered oldest-first (newest-last).
    """
    prefs = get_preferences(db, user_id)
    today = date.today()

    # Current week's Monday (ISO)
    current_monday = today - timedelta(days=today.weekday())
    oldest_monday = current_monday - timedelta(weeks=weeks - 1)

    # Fetch all data in one query
    daily_map = _sum_minutes_for_range(db, user_id, oldest_monday, today)

    buckets = []
    for w in range(weeks):
        ws = oldest_monday + timedelta(weeks=w)
        we = ws + timedelta(days=6)
        # Clamp end to today for current week
        if we > today:
            we = today

        minutes = 0
        target = 0
        has_target = (
            prefs.daily_target_minutes_weekday is not None
            or prefs.daily_target_minutes_weekend is not None
        )
        d = ws
        while d <= we:
            minutes += daily_map.get(d, 0)
            if has_target:
                target += _target_for_date(
                    d,
                    prefs.daily_target_minutes_weekday,
                    prefs.daily_target_minutes_weekend,
                ) or 0
            d += timedelta(days=1)

        buckets.append({
            "week_start": ws,
            "minutes": minutes,
            "target_minutes": target if has_target else None,
        })

    return buckets


def get_daily_stats(db: Session, user_id: int, days: int = 30) -> List[Dict]:
    """
    Return [{date, minutes, target_minutes}] for the last N days,
    ordered oldest-first (newest-last).
    """
    prefs = get_preferences(db, user_id)
    today = date.today()
    start = today - timedelta(days=days - 1)

    daily_map = _sum_minutes_for_range(db, user_id, start, today)

    has_target = (
        prefs.daily_target_minutes_weekday is not None
        or prefs.daily_target_minutes_weekend is not None
    )

    result = []
    for i in range(days):
        d = start + timedelta(days=i)
        t = _target_for_date(
            d, prefs.daily_target_minutes_weekday, prefs.daily_target_minutes_weekend
        ) if has_target else None
        result.append({
            "date": d,
            "minutes": daily_map.get(d, 0),
            "target_minutes": t,
        })

    return result
