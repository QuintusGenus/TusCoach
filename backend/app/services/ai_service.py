"""
AI Service
Generates human-readable messages from workflow context.
Supports stub mode (local) and future LLM integration.
"""
import os
from sqlalchemy.orm import Session
from app.schemas.ai import StudentMessageOut, CoachReportOut
from app.models.message import CoachMessage

# Simple stub logic
def _stub_student_message(workflow_name: str, context: dict) -> StudentMessageOut:
    if workflow_name == "daily_review":
        risk = context.get("risk_score", 0)
        tasks = context.get("tasks_created", 0)
        tone = "warm" if risk < 50 else "urgent"
        return StudentMessageOut(
            subject="Your Daily Plan is Ready",
            body=f"Good morning! Your risk score is currently {risk}. We have scheduled {tasks} tasks for you tomorrow. Keep it up!",
            tone=tone
        )
    elif workflow_name == "inactivity_rescue":
        hours = context.get("inactivity_hours", 0)
        return StudentMessageOut(
            subject="We Miss You!",
            body=f"It's been {hours} hours since your last session. We've prepared a quick recovery session for you.",
            tone="warm"
        )
    elif workflow_name == "exam_intervention":
        topic = context.get("weak_topic", "Unknown")
        return StudentMessageOut(
            subject="Action Plan: Boost Your Scores",
            body=f"We noticed you struggled with {topic}. We've created a 7-day focus plan to help you master it.",
            tone="supportive"
        )
    return StudentMessageOut(subject="Update", body="Workflow completed.", tone="neutral")

def _stub_coach_report(workflow_name: str, context: dict) -> CoachReportOut:
    if workflow_name == "daily_review":
        risk = context.get("risk_score", 0)
        level = "high" if risk > 70 else "medium" if risk > 30 else "low"
        return CoachReportOut(
            summary=f"Daily Review run. Risk Score: {risk}.",
            risk_level=level,
            action_items=["Check student adherence", "Review upcoming tasks"]
        )
    return CoachReportOut(summary="Workflow run", risk_level="low", action_items=[])

def generate_student_message(db: Session, student_id: int, run_id: int, workflow_name: str, context: dict) -> StudentMessageOut:
    """
    Generates a message for the student based on workflow context AND saves it to CoachMessage table.

    NOTE: student_id here is actually users.id (from workflow_runs).
    CoachMessage.student_id expects student_profiles.id, so we look it up.
    """
    from app.models.user import StudentProfile

    # Check for LLM_API_KEY (mock check)
    api_key = os.getenv("LLM_API_KEY")
    if not api_key or api_key == "your-api-key-here":
        msg = _stub_student_message(workflow_name, context)
    else:
        # Future: Call LLM here
        msg = _stub_student_message(workflow_name, context)

    # Look up student_profiles.id from users.id
    profile = db.query(StudentProfile).filter_by(user_id=student_id).first()
    profile_id = profile.id if profile else None

    # Save to DB
    db_msg = CoachMessage(
        student_id=profile_id,
        user_id=student_id,
        workflow_run_id=run_id,
        subject=msg.subject,
        body=msg.body,
        tone=msg.tone
    )
    db.add(db_msg)
    db.commit()

    return msg

def generate_coach_report(workflow_name: str, context: dict) -> CoachReportOut:
    """
    Generates a report for the coach.
    """
    # Same logic for provider fallback
    return _stub_coach_report(workflow_name, context)
