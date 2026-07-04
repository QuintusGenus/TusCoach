"""
Tests for Scoring Service
"""
import pytest
import os
from datetime import datetime, timedelta, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models import User, StudySession, StudyPlan, PlanTask, Topic, MockExam, MockExamBreakdown
from app.services.scoring_service import (
    compute_inactivity_hours,
    compute_adherence_7d,
    compute_weak_topics_top3,
    compute_risk_score
)

test_db_url = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://tuscoach:tuscoach123@localhost:5433/tuscoach_test"
)
engine = create_engine(test_db_url, echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

def test_compute_inactivity(db):
    # Setup
    user = User(email="test@test.com", hashed_password="pw")
    db.add(user)
    db.commit()
    
    # Case 1: No sessions -> 0
    assert compute_inactivity_hours(db, user.id) == 0
    
    # Case 2: Session 2 hours ago
    two_hours_ago = datetime.utcnow() - timedelta(hours=2)
    session = StudySession(
        student_id=user.id, 
        date=two_hours_ago.date(), 
        minutes=30, 
        created_at=two_hours_ago
    )
    db.add(session)
    db.commit()
    
    assert compute_inactivity_hours(db, user.id) in [1, 2] # Allow slight diff

def test_compute_adherence(db):
    user = User(email="adherence@test.com", hashed_password="pw")
    db.add(user)
    db.flush()
    
    # Topic
    topic = Topic(name="Anatomy", subject="Basic")
    db.add(topic)
    db.flush()
    
    # Plan covering today
    plan = StudyPlan(student_id=user.id, start_date=date.today(), end_date=date.today())
    db.add(plan)
    db.flush()
    
    # Task: 100 mins today
    task = PlanTask(
        plan_id=plan.id, 
        date=date.today(), 
        topic_id=topic.id, 
        task_type="study", 
        target_minutes=100
    )
    db.add(task)
    db.commit()
    
    # Case 1: No study -> 0%
    assert compute_adherence_7d(db, user.id) == 0.0
    
    # Case 2: 50 mins study -> 50%
    session = StudySession(student_id=user.id, date=date.today(), minutes=50, topic_id=topic.id)
    db.add(session)
    db.commit()
    
    assert compute_adherence_7d(db, user.id) == 50.0

def test_risk_score(db):
    user = User(email="risk@test.com", hashed_password="pw")
    db.add(user)
    db.flush()
    
    # 1. Inactive (0 hrs studied ever -> 0 inactivity score based on current logic, wait)
    # Logic: if no last_activity, return 0. (Risk 0 from inactivity)
    # Adherence: 0 (No plan -> 0 adherence? No, adherence function returns 0 if no plan)
    # If no plan, adherence is 0. Risk logic: (100-0)*0.4 = 40.
    # So fresh user risk = 0 + 40 + 0 = 40.
    
    score_fresh = compute_risk_score(db, user.id)
    # Actually wait, compute_adherence_7d returns 0 if NO PLAN.
    # Risk calculation says (100 - adherence) * 0.4.
    # If adherence is 0, score is 40.
    # This means a user without a plan is risky. That makes sense? Maybe.
    # Verify adhering to no plan is not good.
    # But wait, adherence returns 0 if no plan.
    # Let's check logic:
    # "if no plan, return 0". -> Adherence is 0 -> Risk is 40.
    
    # Let's create a risk scenario:
    # High inactivity (4 days > 72h) -> 40 pts
    # Low adherence (0%) -> 40 pts
    # Weak topics (<30%) -> 20 pts
    # Total should be 100.
    
    # Setup Topic
    topic = Topic(name="Physio", subject="Basic")
    db.add(topic)
    db.flush()
    
    # Add Plan (so adherence can be calculated properly as 0 if we don't study)
    plan = StudyPlan(student_id=user.id, start_date=date.today(), end_date=date.today())
    db.add(plan)
    db.flush()
    task = PlanTask(plan_id=plan.id, date=date.today(), topic_id=topic.id, task_type="study", target_minutes=100)
    db.add(task)
    
    # Add StudySession 8 days ago (Inactivity > 3 days, and outside 7-day adherence window)
    days_ago = datetime.utcnow() - timedelta(days=8)
    session = StudySession(
        student_id=user.id, 
        date=days_ago.date(), 
        minutes=10, 
        created_at=days_ago
    )
    db.add(session)
    
    # Add Bad Exam (Weak Topic)
    exam = MockExam(student_id=user.id, date=date.today())
    db.add(exam)
    db.flush()
    breakdown = MockExamBreakdown(
        exam_id=exam.id, 
        topic_id=topic.id, 
        correct=2, wrong=8, blank=0 # 20% accuracy
    )
    db.add(breakdown)
    db.commit()
    
    # Calculate
    # Inactivity: 96 hours / 72 * 40 = >40 -> capped at 40.
    # Adherence: 0/100 = 0%. (100-0)*0.4 = 40.
    # Weak Topic: 20% < 30% -> 20.
    # Total: 40 + 40 + 20 = 100.
    
    assert compute_risk_score(db, user.id) == 100
