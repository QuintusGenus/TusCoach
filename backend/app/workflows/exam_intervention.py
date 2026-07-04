"""
Exam Intervention Workflow
- Check weak topics
- Create 7-day micro cycle
"""
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.services.scoring_service import compute_weak_topics_top3
from app.models import StudyPlan, PlanTask

def exam_intervention_workflow(db: Session, student_id: int, run_id: int) -> dict:
    """
    Intervention Logic
    """
    # 1. Identify Weakness
    weak_topics = compute_weak_topics_top3(db, student_id)
    
    if not weak_topics:
        return {"status": "skipped", "reason": "No weak topics found (or no exams)"}
        
    top_weakness = weak_topics[0]
    topic_id = top_weakness["topic_id"]
    topic_name = top_weakness["topic_name"]
    accuracy = top_weakness["accuracy"]
    
    # 2. Create 7-day plan
    # Ensure Plan
    plan = db.query(StudyPlan).filter_by(student_id=student_id).first()
    if not plan:
        plan = StudyPlan(student_id=student_id, start_date=date.today(), end_date=date.today()+timedelta(days=7))
        db.add(plan)
        db.commit()
    
    # 3 days of review, 1 day break, 2 days questions, 1 day mock
    cycle = [
        ("review", 60), ("review", 60), ("review", 60),
        ("break", 0),
        ("question", 45), ("question", 45),
        ("mock", 120)
    ]
    
    tasks_created = 0
    start_date = date.today()
    
    for i, (type_, mins) in enumerate(cycle):
        if type_ == "break":
            continue
            
        t = PlanTask(
            plan_id=plan.id,
            date=start_date + timedelta(days=i),
            topic_id=topic_id,
            task_type=f"intervention_{type_}",
            target_minutes=mins,
            status="pending"
        )
        db.add(t)
        tasks_created += 1
        
    ctx = {
        "status": "active",
        "weak_topic": topic_name,
        "accuracy": accuracy,
        "intervention_summary": f"Generated 7-day intervention for '{topic_name}' ({accuracy:.1f}% accuracy).",
        "tasks_created": tasks_created
    }
    
    from app.services.ai_service import generate_student_message
    msg = generate_student_message(db, student_id, run_id, "exam_intervention", ctx)
    ctx["student_message"] = msg.model_dump()
    
    return ctx
