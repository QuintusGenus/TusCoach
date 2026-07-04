from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import StudentProfile
from app.models.preferences import StudentPreferences


def _get_or_create_profile(db: Session, user_id: int) -> StudentProfile:
    """Return existing StudentProfile or create one."""
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if not profile:
        profile = StudentProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def get_preferences(db: Session, user_id: int) -> StudentPreferences:
    """
    Return the student's preferences row, creating profile + defaults if needed.
    """
    profile = _get_or_create_profile(db, user_id)

    prefs = (
        db.query(StudentPreferences)
        .filter(StudentPreferences.student_id == profile.id)
        .first()
    )
    if not prefs:
        prefs = StudentPreferences(student_id=profile.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def update_preferences(
    db: Session, user_id: int, updates: Dict[str, Any]
) -> StudentPreferences:
    """
    Apply partial updates to preferences (upsert pattern).
    `updates` should contain only the fields that were explicitly sent.
    """
    prefs = get_preferences(db, user_id)

    for field, value in updates.items():
        setattr(prefs, field, value)

    db.commit()
    db.refresh(prefs)
    return prefs


def load_preference_snapshot(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Return a JSON-serialisable snapshot of the student's preferences.
    Workflows store this in context for debugging / auditing.
    """
    prefs = get_preferences(db, user_id)
    return {
        "exam_date": prefs.exam_date.isoformat() if prefs.exam_date else None,
        "daily_target_minutes_weekday": prefs.daily_target_minutes_weekday,
        "daily_target_minutes_weekend": prefs.daily_target_minutes_weekend,
        "preferred_study_window_start": (
            prefs.preferred_study_window_start.isoformat()
            if prefs.preferred_study_window_start else None
        ),
        "preferred_study_window_end": (
            prefs.preferred_study_window_end.isoformat()
            if prefs.preferred_study_window_end else None
        ),
        "quiet_hours_start": (
            prefs.quiet_hours_start.isoformat() if prefs.quiet_hours_start else None
        ),
        "quiet_hours_end": (
            prefs.quiet_hours_end.isoformat() if prefs.quiet_hours_end else None
        ),
        "timezone": prefs.timezone,
    }


def get_onboarding_status(db: Session, user_id: int) -> dict:
    """
    Return booleans for whether key onboarding fields are set.
    """
    prefs = get_preferences(db, user_id)
    return {
        "exam_date_set": prefs.exam_date is not None,
        "daily_target_set": (
            prefs.daily_target_minutes_weekday is not None
            or prefs.daily_target_minutes_weekend is not None
        ),
    }
