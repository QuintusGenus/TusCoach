"""
Inactivity Rescue Workflow
- If inactivity >= 72h, create recovery tasks
- Uses student preferences for target minutes and study window
"""
from datetime import date
from sqlalchemy.orm import Session
from app.services.scoring_service import compute_inactivity_hours
from app.services.preferences_service import load_preference_snapshot, get_preferences
from app.models import StudyPlan, PlanTask, Topic

DEFAULT_RECOVERY_MINUTES = 30


def _resolve_recovery_minutes(db: Session, student_id: int) -> int:
    """
    Use the smaller of weekday/weekend targets (gentle re-entry), capped at half
    the daily budget.  Falls back to DEFAULT_RECOVERY_MINUTES.
    """
    prefs = get_preferences(db, student_id)

    weekday = prefs.daily_target_minutes_weekday
    weekend = prefs.daily_target_minutes_weekend

    if weekday is not None and weekend is not None:
        daily = min(weekday, weekend)
    elif weekday is not None:
        daily = weekday
    elif weekend is not None:
        daily = weekend
    else:
        return DEFAULT_RECOVERY_MINUTES

    # Recovery session is at most half the normal daily target
    return max(daily // 2, 15)  # floor of 15 min


def inactivity_rescue_workflow(db: Session, student_id: int, run_id: int) -> dict:
    """
    Rescue Logic
    """
    # 0. Load preference snapshot for audit trail
    pref_snapshot = load_preference_snapshot(db, student_id)

    hours = compute_inactivity_hours(db, student_id)
    threshold = 72

    if hours < threshold:
        return {
            "status": "skipped",
            "preference_snapshot": pref_snapshot,
            "reason": f"Inactivity {hours}h is below threshold {threshold}h"
        }

    # Resolve recovery minutes from preferences
    recovery_minutes = _resolve_recovery_minutes(db, student_id)

    # Recovery: Create easy task for TODAY
    plan = db.query(StudyPlan).filter_by(student_id=student_id).first()
    if not plan:
        # Create minimal plan
        plan = StudyPlan(student_id=student_id, start_date=date.today(), end_date=date.today())
        db.add(plan)
        db.commit()

    topic = db.query(Topic).first()  # Fallback

    task = PlanTask(
        plan_id=plan.id,
        date=date.today(),
        topic_id=topic.id if topic else 1,
        task_type="recovery_review",
        target_minutes=recovery_minutes,
        status="pending"
    )
    db.add(task)

    # Build context with preference-aware details
    prefs = get_preferences(db, student_id)
    window_hint = ""
    if prefs.preferred_study_window_start and prefs.preferred_study_window_end:
        start_str = prefs.preferred_study_window_start.strftime("%H:%M")
        end_str = prefs.preferred_study_window_end.strftime("%H:%M")
        window_hint = f" Try to fit it in your preferred window ({start_str}–{end_str})."

    ctx = {
        "status": "active",
        "preference_snapshot": pref_snapshot,
        "inactivity_hours": hours,
        "recovery_minutes": recovery_minutes,
        "rescue_message": (
            f"Hey! We missed you. Here is a light {recovery_minutes}-min "
            f"recovery session to get back on track.{window_hint}"
        ),
        "tasks_created": 1
    }

    from app.services.ai_service import generate_student_message, generate_coach_report
    msg = generate_student_message(db, student_id, run_id, "inactivity_rescue", ctx)
    ctx["student_message"] = msg.model_dump()

    return ctx
