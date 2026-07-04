"""
Daily Review Workflow
- Computes risk score
- Creates 2 planar tasks for tomorrow if checking scores
- Uses student preferences for target_minutes (weekday vs weekend)
- Summary
"""
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.services.scoring_service import compute_risk_score
from app.services.preferences_service import load_preference_snapshot, get_preferences
from app.models import StudyPlan, PlanTask, Topic

# Hardcoded defaults when no preference is set
DEFAULT_REVIEW_MINUTES = 60
DEFAULT_QUESTION_MINUTES = 30
REVIEW_RATIO = 2 / 3  # review gets 2/3 of daily budget
QUESTION_RATIO = 1 / 3  # questions get 1/3


def _resolve_target_minutes(db: Session, student_id: int, target_date: date):
    """
    Return (review_minutes, question_minutes) based on student preferences
    and whether target_date falls on a weekday or weekend.
    """
    prefs = get_preferences(db, student_id)

    is_weekend = target_date.weekday() >= 5  # Saturday=5, Sunday=6

    if is_weekend and prefs.daily_target_minutes_weekend is not None:
        daily = prefs.daily_target_minutes_weekend
    elif not is_weekend and prefs.daily_target_minutes_weekday is not None:
        daily = prefs.daily_target_minutes_weekday
    else:
        # No preference set — use hardcoded defaults
        return DEFAULT_REVIEW_MINUTES, DEFAULT_QUESTION_MINUTES

    # Split daily budget across task types
    review = round(daily * REVIEW_RATIO)
    question = daily - review  # remainder to avoid rounding loss
    return review, question


def daily_review_workflow(db: Session, student_id: int, run_id: int) -> dict:
    """
    Daily Review Logic
    """
    # 0. Load preference snapshot for audit trail
    pref_snapshot = load_preference_snapshot(db, student_id)

    # 1. Compute Score
    risk = compute_risk_score(db, student_id)

    # 2. Check/Create Tasks for Tomorrow
    tomorrow = date.today() + timedelta(days=1)

    # Resolve target minutes from preferences
    review_minutes, question_minutes = _resolve_target_minutes(db, student_id, tomorrow)

    # Ensure Plan exists (create default one if missing for simplicity)
    plan = db.query(StudyPlan).filter_by(student_id=student_id).first()
    if not plan:
        plan = StudyPlan(
            student_id=student_id,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30)
        )
        db.add(plan)
        db.commit()

    # Create 2 simple tasks (with strong idempotency using ON CONFLICT)
    # Assume we have at least one topic. Use Topic 1 if exists.
    topic = db.query(Topic).first()
    topic_id = topic.id if topic else None

    tasks_created = 0
    if topic_id:
        # Prepare tasks to insert
        tasks_to_insert = [
            {
                "plan_id": plan.id,
                "date": tomorrow,
                "topic_id": topic_id,
                "task_type": "review",
                "target_minutes": review_minutes,
                "status": "pending"
            },
            {
                "plan_id": plan.id,
                "date": tomorrow,
                "topic_id": topic_id,
                "task_type": "question",
                "target_minutes": question_minutes,
                "status": "pending"
            }
        ]

        # Use INSERT ... ON CONFLICT DO NOTHING for strong idempotency
        for task_data in tasks_to_insert:
            stmt = insert(PlanTask).values(**task_data)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=['plan_id', 'date', 'topic_id', 'task_type']
            )
            result = db.execute(stmt)
            # rowcount tells us how many rows were actually inserted (0 if conflict, 1 if new)
            tasks_created += result.rowcount

        db.commit()

    # AI Message Generation
    ctx = {
        "preference_snapshot": pref_snapshot,
        "risk_score": risk,
        "tasks_created": tasks_created,
        "review_minutes": review_minutes,
        "question_minutes": question_minutes,
        "summary": f"Daily Review Complete. Risk: {risk}. Scheduled {tasks_created} tasks for {tomorrow}."
    }

    from app.services.ai_service import generate_student_message, generate_coach_report
    msg = generate_student_message(db, student_id, run_id, "daily_review", ctx)
    report = generate_coach_report("daily_review", ctx)

    ctx["student_message"] = msg.model_dump()
    ctx["coach_report"] = report.model_dump()

    return ctx
