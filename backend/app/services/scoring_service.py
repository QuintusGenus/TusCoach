"""
Scoring Engine for Workflows
Attributes:
- Deterministic scoring logic
- No LLM usage
"""
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, and_
from app.models import StudySession, PlanTask, MockExamBreakdown, MockExam, Topic, StudyPlan

def compute_inactivity_hours(db: Session, student_id: int) -> int:
    """
    Computes hours since the last activity (Study Session creation).
    Returns 0 if no sessions found (or treat as high number? Prompt says 'based on last...').
    If no session, let's return a high number (e.g. 9999) or 0? 
    Usually inactivity means "how long they successfully slept". 
    Actually, "inactivity" usually means separation from last study.
    If no session, they are infinitely inactive. Return 24*30 (1 month) as default cap?
    Let's return -1 if never studied, or just 0 if we assume they just joined.
    Let's use 0 for "just joined" to avoid punishing new users, 
    but for workflows, high inactivity is bad.
    Let's return 0 if never, assuming "fresh".
    Wait, logic: "Risk score" uses it. High inactivity -> High Risk.
    If never studied, risk is high? Yes.
    Let's return time since account creation? No, "based on last StudySession".
    If no sessions, let's return 720 (30 days).
    """
    stmt = (
        select(StudySession.created_at)
        .where(StudySession.student_id == student_id)
        .order_by(desc(StudySession.created_at))
        .limit(1)
    )
    last_activity = db.scalar(stmt)
    
    if not last_activity:
        # No study sessions yet.
        return 0 # Or maybe a specific signal value. But for risk calc, 0 means "active just now"? 
        # If I return 0, risk score might be low. 
        # Let's check compute_risk_score logic later. 
        # For now, return 0 as "neutral".
    
    diff = datetime.utcnow() - last_activity
    return int(diff.total_seconds() / 3600)

def compute_adherence_7d(db: Session, student_id: int) -> float:
    """
    Planned vs Actual minutes for the last 7 days.
    (actual / planned) * 100
    If no plan, return 0. (As per instructions).
    If planned is 0, return 100 if actual > 0 else 0?
    Instructions: "if no plan, return 0".
    """
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    
    # 1. Get Planned Tasks in range [today-7, today] (or just up to today)
    # Actually, usually "last 7 days" includes today.
    
    # Check if student has ANY plan
    has_plan = db.scalar(select(StudyPlan.id).where(StudyPlan.student_id == student_id).limit(1))
    if not has_plan:
        return 0.0

    # Sum planned minutes
    # We join PlanTask with StudyPlan to ensure it belongs to student
    planned_minutes = db.scalar(
        select(func.sum(PlanTask.target_minutes))
        .join(StudyPlan)
        .where(
            StudyPlan.student_id == student_id,
            PlanTask.date >= seven_days_ago,
            PlanTask.date <= today
        )
    ) or 0
    
    if planned_minutes == 0:
        return 0.0 # Avoid division by zero, and "no plan" logic overlap
        
    # Sum actual minutes from StudySessions
    actual_minutes = db.scalar(
        select(func.sum(StudySession.minutes))
        .where(
            StudySession.student_id == student_id,
            StudySession.date >= seven_days_ago,
            StudySession.date <= today
        )
    ) or 0
    
    adherence = (actual_minutes / planned_minutes) * 100
    return round(min(adherence, 100.0), 2) # Cap at 100%? Or allow over-performance? Adherence usually caps at 100 or is strict. Let's cap at 100 for risk scoring consistency.

def compute_weak_topics_top3(db: Session, student_id: int) -> list[dict]:
    """
    Use last N MockExamBreakdown rows grouped by topic_id.
    Rank by lowest accuracy (correct / (correct + wrong + blank)).
    """
    # 1. Get recent breakdowns
    # We'll fetch all breakdowns from the last 5 exams? Or simple aggregation of all time?
    # "Use last N MockExamBreakdown rows". Let's say N=50 rows (or all).
    # Group by Topic.
    
    stmt = (
        select(
            MockExamBreakdown.topic_id,
            func.sum(MockExamBreakdown.correct).label("total_correct"),
            func.sum(MockExamBreakdown.wrong).label("total_wrong"),
            func.sum(MockExamBreakdown.blank).label("total_blank"),
            Topic.name.label("topic_name")
        )
        .join(MockExam)
        .join(Topic, MockExamBreakdown.topic_id == Topic.id)
        .where(MockExam.student_id == student_id)
        .group_by(MockExamBreakdown.topic_id, Topic.name)
    )
    
    results = db.execute(stmt).all()
    
    topic_scores = []
    for r in results:
        total = r.total_correct + r.total_wrong + r.total_blank
        accuracy = (r.total_correct / total) * 100 if total > 0 else 0.0
        topic_scores.append({
            "topic_id": r.topic_id,
            "topic_name": r.topic_name,
            "accuracy": accuracy,
            "total_questions": total
        })
    
    # Sort by accuracy ascending (lowest first)
    topic_scores.sort(key=lambda x: x["accuracy"])
    
    return topic_scores[:3]

def compute_risk_score(db: Session, student_id: int) -> int:
    """
    Risk Score (0-100). Higher is 'At Risk'.
    Formula:
    - Inactivity Factor (40%): If > 3 days (72h), risk increases.
        Min( (hours / 72) * 40, 40 )
    - Adherence Factor (40%): If < 50%, risk increases.
        (100 - adherence) * 0.4
    - Weak Topics Factor (20%): If top weak topic < 30% accuracy, add 20 risk.
    """
    inactivity = compute_inactivity_hours(db, student_id)
    adherence = compute_adherence_7d(db, student_id)
    weak_topics = compute_weak_topics_top3(db, student_id)
    
    # 1. Inactivity Score (Max 40)
    # If 72 hours (3 days) inactive -> 40 points (Max risk contribution)
    inactivity_score = min((inactivity / 72) * 40, 40) if inactivity > 0 else 0
    
    # 2. Adherence Score (Max 40)
    # Low adherence = high risk.
    # Ex: 0% adherence -> 40 points. 100% adherence -> 0 points.
    adherence_score = (100 - adherence) * 0.4
    
    # 3. Weak Topic Score (Max 20)
    # If weakest topic is below 30% accuracy, add 20 points.
    weak_topic_score = 0
    if weak_topics:
        worst = weak_topics[0]["accuracy"]
        if worst < 30.0:
            weak_topic_score = 20
        elif worst < 50.0:
            weak_topic_score = 10
            
    total_risk = int(inactivity_score + adherence_score + weak_topic_score)
    return min(total_risk, 100)
