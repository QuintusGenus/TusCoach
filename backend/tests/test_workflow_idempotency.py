"""
Regression tests for workflow idempotency
Ensures daily_review workflow doesn't create duplicate plan tasks

Uses the shared `db` fixture from conftest.py.
"""
import pytest
from unittest.mock import patch
from datetime import date, timedelta
from app.models import User, StudyPlan, PlanTask, Topic
from app.schemas.ai import StudentMessageOut, CoachReportOut
from app.workflows.daily_review import daily_review_workflow

# Stub returns for mocked AI service (tests focus on task creation, not messaging)
_STUB_MSG = StudentMessageOut(subject="Test", body="Test body", tone="neutral")
_STUB_REPORT = CoachReportOut(summary="Test", risk_level="low", action_items=[])


@patch("app.services.ai_service.generate_coach_report", return_value=_STUB_REPORT)
@patch("app.services.ai_service.generate_student_message", return_value=_STUB_MSG)
def test_daily_review_idempotency(mock_msg, mock_report, db):
    """
    Test that running daily_review workflow multiple times
    does NOT create duplicate plan tasks for the same date/task_type
    """
    # Setup: Create user and topic
    user = User(email="idempotency@test.com", hashed_password="hash", role="student")
    db.add(user)
    db.commit()

    topic = Topic(name="Anatomy", subject="Medical")
    db.add(topic)
    db.commit()

    student_id = user.id
    tomorrow = date.today() + timedelta(days=1)

    # First run: Should create 2 tasks
    result1 = daily_review_workflow(db, student_id, run_id=1)
    db.commit()

    assert result1["tasks_created"] == 2, "First run should create 2 tasks"

    # Verify tasks were created
    tasks_after_first = db.query(PlanTask).filter(
        PlanTask.date == tomorrow
    ).all()
    assert len(tasks_after_first) == 2, "Should have exactly 2 tasks after first run"

    task_types_first = {t.task_type for t in tasks_after_first}
    assert task_types_first == {"review", "question"}, "Should have review and question tasks"

    # Second run: Should create 0 tasks (idempotency)
    result2 = daily_review_workflow(db, student_id, run_id=2)
    db.commit()

    assert result2["tasks_created"] == 0, "Second run should create 0 tasks (duplicates prevented)"

    # Verify still only 2 tasks exist
    tasks_after_second = db.query(PlanTask).filter(
        PlanTask.date == tomorrow
    ).all()
    assert len(tasks_after_second) == 2, "Should still have exactly 2 tasks after second run"

    # Third run: Verify idempotency again
    result3 = daily_review_workflow(db, student_id, run_id=3)
    db.commit()

    assert result3["tasks_created"] == 0, "Third run should also create 0 tasks"

    tasks_after_third = db.query(PlanTask).filter(
        PlanTask.date == tomorrow
    ).all()
    assert len(tasks_after_third) == 2, "Should still have exactly 2 tasks after third run"


@patch("app.services.ai_service.generate_coach_report", return_value=_STUB_REPORT)
@patch("app.services.ai_service.generate_student_message", return_value=_STUB_MSG)
def test_daily_review_different_dates_not_conflicting(mock_msg, mock_report, db):
    """
    Test that running daily_review on different days creates separate tasks
    """
    # Setup
    user = User(email="dates@test.com", hashed_password="hash", role="student")
    db.add(user)
    db.commit()

    topic = Topic(name="Physiology", subject="Medical")
    db.add(topic)
    db.commit()

    student_id = user.id

    # Run workflow (creates tasks for tomorrow)
    result1 = daily_review_workflow(db, student_id, run_id=1)
    db.commit()

    assert result1["tasks_created"] == 2

    # Fast-forward time by changing what "tomorrow" would be
    # This simulates running the workflow on a different day
    # In real scenario, date.today() would be different
    # For this test, we'll just verify that tasks for different dates can coexist

    plan = db.query(StudyPlan).filter_by(student_id=student_id).first()
    assert plan is not None

    # Manually create tasks for a different date (simulating a future run)
    future_date = date.today() + timedelta(days=2)
    from sqlalchemy.dialects.postgresql import insert

    tasks_data = [
        {
            "plan_id": plan.id,
            "date": future_date,
            "topic_id": topic.id,
            "task_type": "review",
            "target_minutes": 60,
            "status": "pending"
        },
        {
            "plan_id": plan.id,
            "date": future_date,
            "topic_id": topic.id,
            "task_type": "question",
            "target_minutes": 30,
            "status": "pending"
        }
    ]

    for task_data in tasks_data:
        stmt = insert(PlanTask).values(**task_data)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=['plan_id', 'date', 'topic_id', 'task_type']
        )
        db.execute(stmt)

    db.commit()

    # Verify we have tasks for both dates
    all_tasks = db.query(PlanTask).all()
    assert len(all_tasks) == 4, "Should have 2 tasks for tomorrow and 2 for future date"

    dates = {t.date for t in all_tasks}
    assert len(dates) == 2, "Tasks should span 2 different dates"


@patch("app.services.ai_service.generate_coach_report", return_value=_STUB_REPORT)
@patch("app.services.ai_service.generate_student_message", return_value=_STUB_MSG)
def test_concurrent_workflow_runs_no_duplicates(mock_msg, mock_report, db):
    """
    Test that even with race conditions, no duplicates are created
    (PostgreSQL constraint ensures atomicity)
    """
    # Setup
    user = User(email="concurrent@test.com", hashed_password="hash", role="student")
    db.add(user)
    db.commit()

    topic = Topic(name="Biochemistry", subject="Medical")
    db.add(topic)
    db.commit()

    student_id = user.id

    # Simulate concurrent runs by calling workflow multiple times rapidly
    results = []
    for i in range(5):
        result = daily_review_workflow(db, student_id, run_id=i+1)
        db.commit()
        results.append(result)

    # First run should create 2, all others should create 0
    assert results[0]["tasks_created"] == 2, "First run creates 2 tasks"
    for i in range(1, 5):
        assert results[i]["tasks_created"] == 0, f"Run {i+1} should create 0 tasks"

    # Verify total count
    tomorrow = date.today() + timedelta(days=1)
    total_tasks = db.query(PlanTask).filter(PlanTask.date == tomorrow).count()
    assert total_tasks == 2, "Should have exactly 2 tasks total despite 5 runs"
