"""
Tests for preference-aware workflow behaviour.

Verifies:
- daily_review uses weekday target on weekdays
- daily_review uses weekend target on weekends
- daily_review falls back to defaults when no preferences set
- preference_snapshot is stored in workflow_runs.context
- inactivity_rescue uses preferences for recovery minutes
"""
import pytest
from datetime import date, time, timedelta
from unittest.mock import patch, MagicMock

from app.models import StudyPlan, PlanTask, Topic, WorkflowRun, StudentProfile
from app.models.preferences import StudentPreferences
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.ai import StudentMessageOut, CoachReportOut


# ---------------------------------------------------------------------------
# Stubs for AI service (ai_service has stale CoachMessage columns)
# ---------------------------------------------------------------------------

def _fake_generate_student_message(db, student_id, run_id, workflow_name, context):
    return StudentMessageOut(subject="stub", body="stub body", tone="neutral")


def _fake_generate_coach_report(workflow_name, context):
    return CoachReportOut(summary="stub", risk_level="low", action_items=[])


@pytest.fixture(autouse=True)
def mock_ai_service():
    """Mock AI service to avoid stale CoachMessage column writes."""
    with patch(
        "app.services.ai_service.generate_student_message",
        _fake_generate_student_message,
    ), patch(
        "app.services.ai_service.generate_coach_report",
        _fake_generate_coach_report,
    ):
        yield


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def topic(db):
    """Create a topic so workflows can create tasks."""
    t = Topic(name="Anatomy", subject="Basic Sciences")
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@pytest.fixture
def student_with_preferences(db, test_user, test_student_profile, topic):
    """
    Student with weekday=120, weekend=60, study window 07:00-23:00.
    """
    prefs = StudentPreferences(
        student_id=test_student_profile.id,
        daily_target_minutes_weekday=120,
        daily_target_minutes_weekend=60,
        preferred_study_window_start=time(7, 0),
        preferred_study_window_end=time(23, 0),
        timezone="Europe/Istanbul",
    )
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return test_user, test_student_profile, prefs


# ---------------------------------------------------------------------------
# daily_review — weekday
# ---------------------------------------------------------------------------

def test_daily_review_weekday_uses_weekday_target(db, student_with_preferences, topic):
    """Run daily_review when tomorrow is a weekday -> tasks use weekday budget."""
    user, profile, prefs = student_with_preferences

    # 2026-02-09 is a Monday, so tomorrow (Tuesday) is weekday
    fake_today = date(2026, 2, 9)

    with patch("app.workflows.daily_review.date") as mock_date:
        mock_date.today.return_value = fake_today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        from app.workflows.daily_review import daily_review_workflow
        ctx = daily_review_workflow(db, user.id, run_id=1)

    # With 120 weekday minutes: review ~80, question ~40
    assert ctx["review_minutes"] == round(120 * 2 / 3)  # 80
    assert ctx["question_minutes"] == 120 - round(120 * 2 / 3)  # 40

    # Verify tasks were actually created with those values
    tasks = db.query(PlanTask).filter(
        PlanTask.date == fake_today + timedelta(days=1)
    ).all()
    assert len(tasks) == 2

    review_task = next(t for t in tasks if t.task_type == "review")
    question_task = next(t for t in tasks if t.task_type == "question")
    assert review_task.target_minutes == 80
    assert question_task.target_minutes == 40


def test_daily_review_weekend_uses_weekend_target(db, student_with_preferences, topic):
    """Run daily_review when tomorrow is a weekend -> tasks use weekend budget."""
    user, profile, prefs = student_with_preferences

    # 2026-02-06 is a Friday, so tomorrow (Saturday) is weekend
    fake_today = date(2026, 2, 6)

    with patch("app.workflows.daily_review.date") as mock_date:
        mock_date.today.return_value = fake_today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        from app.workflows.daily_review import daily_review_workflow
        ctx = daily_review_workflow(db, user.id, run_id=2)

    # With 60 weekend minutes: review ~40, question ~20
    assert ctx["review_minutes"] == round(60 * 2 / 3)  # 40
    assert ctx["question_minutes"] == 60 - round(60 * 2 / 3)  # 20

    tasks = db.query(PlanTask).filter(
        PlanTask.date == fake_today + timedelta(days=1)
    ).all()
    assert len(tasks) == 2

    review_task = next(t for t in tasks if t.task_type == "review")
    question_task = next(t for t in tasks if t.task_type == "question")
    assert review_task.target_minutes == 40
    assert question_task.target_minutes == 20


# ---------------------------------------------------------------------------
# daily_review — no preferences (fallback)
# ---------------------------------------------------------------------------

def test_daily_review_no_preferences_uses_defaults(db, test_user, test_student_profile, topic):
    """When student has no preferences row, defaults should be used (60 + 30)."""
    fake_today = date(2026, 2, 9)  # Monday

    with patch("app.workflows.daily_review.date") as mock_date:
        mock_date.today.return_value = fake_today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        from app.workflows.daily_review import daily_review_workflow
        ctx = daily_review_workflow(db, test_user.id, run_id=3)

    assert ctx["review_minutes"] == 60
    assert ctx["question_minutes"] == 30

    tasks = db.query(PlanTask).filter(
        PlanTask.date == fake_today + timedelta(days=1)
    ).all()
    review_task = next(t for t in tasks if t.task_type == "review")
    question_task = next(t for t in tasks if t.task_type == "question")
    assert review_task.target_minutes == 60
    assert question_task.target_minutes == 30


# ---------------------------------------------------------------------------
# preference_snapshot in context
# ---------------------------------------------------------------------------

def test_daily_review_stores_preference_snapshot(db, student_with_preferences, topic):
    """Verify preference_snapshot is stored in the returned context."""
    user, profile, prefs = student_with_preferences

    fake_today = date(2026, 2, 9)

    with patch("app.workflows.daily_review.date") as mock_date:
        mock_date.today.return_value = fake_today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        from app.workflows.daily_review import daily_review_workflow
        ctx = daily_review_workflow(db, user.id, run_id=4)

    snapshot = ctx["preference_snapshot"]
    assert snapshot["daily_target_minutes_weekday"] == 120
    assert snapshot["daily_target_minutes_weekend"] == 60
    assert snapshot["preferred_study_window_start"] == "07:00:00"
    assert snapshot["preferred_study_window_end"] == "23:00:00"
    assert snapshot["timezone"] == "Europe/Istanbul"


def test_daily_review_snapshot_stored_in_workflow_run(db, student_with_preferences, topic):
    """
    Run the workflow via the engine and verify preference_snapshot
    is persisted in workflow_runs.context.
    """
    user, profile, prefs = student_with_preferences

    fake_today = date(2026, 2, 9)

    with patch("app.workflows.daily_review.date") as mock_date:
        mock_date.today.return_value = fake_today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)

        from app.services.workflow_engine import run_workflow
        run = run_workflow(db, user.id, "daily_review")

    assert run.status == "done"
    assert "preference_snapshot" in run.context
    assert run.context["preference_snapshot"]["daily_target_minutes_weekday"] == 120


# ---------------------------------------------------------------------------
# inactivity_rescue — uses preferences
# ---------------------------------------------------------------------------

def test_inactivity_rescue_uses_preference_targets(db, student_with_preferences, topic):
    """
    inactivity_rescue should use half the smaller daily target (60 weekend / 2 = 30).
    """
    user, profile, prefs = student_with_preferences

    with patch("app.workflows.inactivity_rescue.compute_inactivity_hours", return_value=100):
        from app.workflows.inactivity_rescue import inactivity_rescue_workflow
        ctx = inactivity_rescue_workflow(db, user.id, run_id=5)

    # min(120, 60) = 60 -> 60 // 2 = 30
    assert ctx["recovery_minutes"] == 30
    assert ctx["status"] == "active"
    assert "preference_snapshot" in ctx


def test_inactivity_rescue_includes_window_hint(db, student_with_preferences, topic):
    """
    rescue_message should mention the preferred study window.
    """
    user, profile, prefs = student_with_preferences

    with patch("app.workflows.inactivity_rescue.compute_inactivity_hours", return_value=100):
        from app.workflows.inactivity_rescue import inactivity_rescue_workflow
        ctx = inactivity_rescue_workflow(db, user.id, run_id=6)

    assert "07:00" in ctx["rescue_message"]
    assert "23:00" in ctx["rescue_message"]


def test_inactivity_rescue_no_preferences_uses_default(db, test_user, test_student_profile, topic):
    """Without preferences, recovery minutes should be the default 30."""

    with patch("app.workflows.inactivity_rescue.compute_inactivity_hours", return_value=100):
        from app.workflows.inactivity_rescue import inactivity_rescue_workflow
        ctx = inactivity_rescue_workflow(db, test_user.id, run_id=7)

    assert ctx["recovery_minutes"] == 30
    assert ctx["status"] == "active"
