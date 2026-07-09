"""
Exam Intervention Workflow
- Identifies weak subjects from the mock exam
- Sends a short, encouraging feedback message (no plan creation)
"""
from sqlalchemy.orm import Session
from app.services.scoring_service import compute_weak_topics_top3


def exam_intervention_workflow(db: Session, student_id: int, run_id: int) -> dict:
    """
    Post-exam feedback: compute accuracy + weak subjects, generate short message.
    """
    weak_topics = compute_weak_topics_top3(db, student_id)

    if not weak_topics:
        return {"status": "skipped", "reason": "No weak topics found (or no exams)"}

    # Build human-readable summary
    top_subjects = [t["topic_name"] for t in weak_topics[:3]]
    top_accuracy = weak_topics[0]["accuracy"]

    subject_list = " ve ".join(top_subjects) if len(top_subjects) <= 2 else \
        ", ".join(top_subjects[:-1]) + " ve " + top_subjects[-1]

    ctx = {
        "status": "active",
        "weak_topics": weak_topics,
        "top_subjects": top_subjects,
        "top_accuracy": top_accuracy,
        "feedback_summary": (
            f"Genel doğruluk: %{top_accuracy:.0f}. "
            f"Odaklanılması gereken konular: {subject_list}."
        ),
    }

    from app.services.ai_service import generate_student_message
    msg = generate_student_message(db, student_id, run_id, "exam_intervention", ctx)
    ctx["student_message"] = msg.model_dump()

    return ctx
