"""
Tests for backfill_coach_messages.py script.

Verifies that the backfill script correctly populates coach_messages
from historical workflow_runs data.
"""
import pytest
from datetime import datetime
from app.models import WorkflowRun, CoachMessage, User, StudentProfile
from app.core.security import get_password_hash


@pytest.fixture
def test_workflow_runs(db, test_user, test_student_profile):
    """Create test workflow_runs with student_message in context."""
    workflow_runs = []

    # Workflow run 1: with student_message
    run1 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="daily_review",
        status="done",
        context={
            "student_message": {
                "subject": "Daily Review Summary",
                "body": "Great progress today! You studied for 2 hours.",
                "tone": "encouraging"
            },
            "other_data": "some value"
        },
        created_at=datetime(2024, 1, 10, 10, 0, 0)
    )
    db.add(run1)

    # Workflow run 2: with student_message
    run2 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="exam_intervention",
        status="done",
        context={
            "student_message": {
                "subject": "Exam Preparation Tips",
                "body": "Your exam is in 2 weeks. Focus on weak topics.",
                "tone": "supportive"
            }
        },
        created_at=datetime(2024, 1, 11, 14, 0, 0)
    )
    db.add(run2)

    # Workflow run 3: without student_message
    run3 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="inactivity_scan",
        status="done",
        context={
            "some_other_data": "value"
        },
        created_at=datetime(2024, 1, 12, 9, 0, 0)
    )
    db.add(run3)

    # Workflow run 4: with empty student_message
    run4 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="daily_review",
        status="done",
        context={
            "student_message": {
                "subject": "",
                "body": "",
                "tone": "neutral"
            }
        },
        created_at=datetime(2024, 1, 13, 10, 0, 0)
    )
    db.add(run4)

    # Workflow run 5: failed workflow with student_message
    run5 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="daily_review",
        status="failed",
        context={
            "student_message": {
                "subject": "This should still be backfilled",
                "body": "Even failed workflows can have messages",
                "tone": "neutral"
            }
        },
        created_at=datetime(2024, 1, 14, 10, 0, 0)
    )
    db.add(run5)

    db.commit()

    for run in [run1, run2, run3, run4, run5]:
        db.refresh(run)

    workflow_runs = [run1, run2, run3, run4, run5]
    return workflow_runs


def test_backfill_creates_messages_from_workflow_runs(db, test_user, test_student_profile, test_workflow_runs):
    """Test that backfill creates coach_messages from workflow_runs."""
    # Import here to avoid circular dependency
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import backfill_message, BackfillStats

    stats = BackfillStats()

    # Backfill run1 (has content)
    result1 = backfill_message(db, test_workflow_runs[0], stats, dry_run=False, verbose=True)
    assert result1 is True
    assert stats.messages_created == 1

    # Verify message was created
    message = db.query(CoachMessage).filter(
        CoachMessage.workflow_run_id == test_workflow_runs[0].id
    ).first()

    assert message is not None
    assert message.user_id == test_user.id
    assert message.student_id == test_student_profile.id
    assert message.subject == "Daily Review Summary"
    assert message.body == "Great progress today! You studied for 2 hours."
    assert message.tone == "encouraging"
    # Compare without timezone info (DB may add UTC tzinfo)
    assert message.created_at.replace(tzinfo=None) == datetime(2024, 1, 10, 10, 0, 0)


def test_backfill_skips_empty_messages(db, test_user, test_student_profile, test_workflow_runs):
    """Test that backfill skips messages with empty subject and body."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import backfill_message, BackfillStats

    stats = BackfillStats()

    # Try to backfill run4 (empty subject and body)
    result = backfill_message(db, test_workflow_runs[3], stats, dry_run=False, verbose=True)
    assert result is False
    assert stats.messages_skipped_empty == 1

    # Verify no message was created
    message = db.query(CoachMessage).filter(
        CoachMessage.workflow_run_id == test_workflow_runs[3].id
    ).first()
    assert message is None


def test_backfill_is_idempotent(db, test_user, test_student_profile, test_workflow_runs):
    """Test that backfill is idempotent - running twice doesn't create duplicates."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import backfill_message, BackfillStats

    stats1 = BackfillStats()

    # First backfill
    result1 = backfill_message(db, test_workflow_runs[0], stats1, dry_run=False)
    assert result1 is True
    assert stats1.messages_created == 1

    # Second backfill (should skip due to UNIQUE constraint)
    stats2 = BackfillStats()
    result2 = backfill_message(db, test_workflow_runs[0], stats2, dry_run=False)
    assert result2 is False
    assert stats2.messages_already_exist == 1

    # Verify only one message exists
    count = db.query(CoachMessage).filter(
        CoachMessage.workflow_run_id == test_workflow_runs[0].id
    ).count()
    assert count == 1


def test_backfill_dry_run_mode(db, test_user, test_student_profile, test_workflow_runs):
    """Test that dry_run mode doesn't actually create messages."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import backfill_message, BackfillStats

    stats = BackfillStats()

    # Backfill in dry_run mode
    result = backfill_message(db, test_workflow_runs[0], stats, dry_run=True)
    assert result is True
    assert stats.messages_created == 1  # Counted, but not actually created

    # Verify no message was actually created
    message = db.query(CoachMessage).filter(
        CoachMessage.workflow_run_id == test_workflow_runs[0].id
    ).first()
    assert message is None


def test_backfill_preserves_original_timestamp(db, test_user, test_student_profile, test_workflow_runs):
    """Test that backfill preserves the original created_at timestamp."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import backfill_message, BackfillStats

    stats = BackfillStats()

    # Backfill run1
    original_timestamp = test_workflow_runs[0].created_at
    backfill_message(db, test_workflow_runs[0], stats, dry_run=False)

    # Verify message has original timestamp
    message = db.query(CoachMessage).filter(
        CoachMessage.workflow_run_id == test_workflow_runs[0].id
    ).first()

    # Compare without timezone info (DB may add UTC tzinfo)
    assert message.created_at.replace(tzinfo=None) == original_timestamp.replace(tzinfo=None)


def test_backfill_skips_workflow_run_without_profile(db, test_workflow_runs):
    """Test that backfill skips workflow_runs for users without StudentProfile."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import backfill_message, BackfillStats

    # Create user without StudentProfile
    user_no_profile = User(
        email="no_profile@example.com",
        hashed_password=get_password_hash("password"),
        is_active=True
    )
    db.add(user_no_profile)
    db.commit()
    db.refresh(user_no_profile)

    # Create workflow run for user without profile
    run = WorkflowRun(
        student_id=user_no_profile.id,
        workflow_name="daily_review",
        status="done",
        context={
            "student_message": {
                "subject": "Test",
                "body": "This should be skipped",
                "tone": "neutral"
            }
        }
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    stats = BackfillStats()

    # Try to backfill
    result = backfill_message(db, run, stats, dry_run=False)
    assert result is False
    assert stats.messages_skipped_no_profile == 1

    # Verify no message was created
    message = db.query(CoachMessage).filter(
        CoachMessage.workflow_run_id == run.id
    ).first()
    assert message is None


def test_get_workflow_runs_with_messages(db, test_user, test_student_profile, test_workflow_runs):
    """Test that get_workflow_runs_with_messages correctly filters runs."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from scripts.backfill_coach_messages import get_workflow_runs_with_messages

    all_runs, runs_with_messages = get_workflow_runs_with_messages(db)

    # We have 5 workflow runs total
    assert len(all_runs) == 5

    # Only 4 have student_message (run3 doesn't have it)
    assert len(runs_with_messages) == 4

    # Verify the correct runs are included
    run_ids_with_messages = {run.id for run in runs_with_messages}
    assert test_workflow_runs[0].id in run_ids_with_messages  # run1
    assert test_workflow_runs[1].id in run_ids_with_messages  # run2
    assert test_workflow_runs[2].id not in run_ids_with_messages  # run3 (no student_message)
    assert test_workflow_runs[3].id in run_ids_with_messages  # run4 (empty message)
    assert test_workflow_runs[4].id in run_ids_with_messages  # run5 (failed workflow)
