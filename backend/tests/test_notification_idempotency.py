"""
Integration test for notification idempotency.

Verifies that attempting to enqueue the same notification multiple times
for the same workflow_run_id only creates one notification record.
"""
import pytest
from app.services.workflow_engine import run_workflow
from app.services.notification_service import enqueue_coach_message_notification
from app.models.notifications import Notification
from app.models.workflow import WorkflowRun


def test_enqueue_same_notification_twice_creates_only_one(db, test_user):
    """
    Test that attempting to enqueue a notification for the same workflow_run_id twice
    results in only one notification record (idempotency via unique constraint).
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Test Message",
                "body": "Test body content",
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_idempotency"] = test_workflow

    try:
        # Run workflow once
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_idempotency"
        )

        assert run.status == "done"

        # First notification should be created
        notification1 = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()
        assert notification1 is not None
        assert notification1.type == "coach_message"

        # Attempt to enqueue the same notification again for the same workflow_run_id
        # This simulates a retry or bug scenario
        result = enqueue_coach_message_notification(
            db=db,
            user_id=test_user.id,
            workflow_run_id=run.id,
            student_message={
                "subject": "Different Subject",  # Different data
                "body": "Different body",
                "tone": "neutral"
            }
        )

        # Result should be None (duplicate detected)
        assert result is None

        # Only one notification should exist for this workflow_run_id
        notifications = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).all()

        assert len(notifications) == 1
        # Original notification should be unchanged
        assert notifications[0].id == notification1.id
        assert notifications[0].title == "Test Message"  # Original title
        assert notifications[0].body == "Test body content"  # Original body

    finally:
        del WORKFLOW_REGISTRY["test_idempotency"]


def test_workflow_run_twice_creates_two_notifications(db, test_user):
    """
    Test that running the same workflow TWICE creates TWO different workflow_runs
    and TWO different notifications (since they have different workflow_run_ids).

    This verifies that the idempotency is per workflow_run_id, not per workflow_name.
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Repeated Message",
                "body": "This workflow runs multiple times",
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_repeated"] = test_workflow

    try:
        # Run workflow first time
        run1 = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_repeated"
        )

        # Run workflow second time (creates a NEW workflow_run)
        run2 = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_repeated"
        )

        # Should have two different workflow_run_ids
        assert run1.id != run2.id

        # Should have two different notifications
        notifications = db.query(Notification).filter(
            Notification.user_id == test_user.id
        ).all()

        assert len(notifications) == 2

        # Each notification should have a different workflow_run_id
        notification_run_ids = {n.workflow_run_id for n in notifications}
        assert notification_run_ids == {run1.id, run2.id}

    finally:
        del WORKFLOW_REGISTRY["test_repeated"]


def test_workflow_retry_after_notification_enqueue_is_idempotent(db, test_user):
    """
    Integration test simulating a workflow retry scenario:
    1. Workflow completes and enqueues notification
    2. Workflow is somehow retried (e.g., due to system issue)
    3. Second attempt should not create duplicate notification

    This tests the real-world scenario where workflow completion is idempotent.
    """
    from app.workflows import WORKFLOW_REGISTRY

    call_count = 0

    def test_workflow_with_retry(db_session, student_id, run_id):
        nonlocal call_count
        call_count += 1

        return {
            "student_message": {
                "subject": f"Retry Test {call_count}",
                "body": f"This is attempt #{call_count}",
                "tone": "encouraging"
            },
            "attempt": call_count
        }

    WORKFLOW_REGISTRY["test_retry"] = test_workflow_with_retry

    try:
        # First execution - creates workflow_run and notification
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_retry"
        )

        workflow_run_id = run.id
        assert run.status == "done"
        assert run.context["attempt"] == 1

        # Notification should exist
        notification1 = db.query(Notification).filter(
            Notification.workflow_run_id == workflow_run_id
        ).first()
        assert notification1 is not None
        assert notification1.title == "Retry Test 1"

        # Simulate retry: manually try to enqueue another notification
        # for the same workflow_run_id (as if the workflow engine ran again)
        result = enqueue_coach_message_notification(
            db=db,
            user_id=test_user.id,
            workflow_run_id=workflow_run_id,
            student_message={
                "subject": "Retry Test 2",
                "body": "This is attempt #2",
                "tone": "encouraging"
            }
        )

        # Should return None (duplicate)
        assert result is None

        # Still only one notification
        notifications = db.query(Notification).filter(
            Notification.workflow_run_id == workflow_run_id
        ).all()

        assert len(notifications) == 1
        assert notifications[0].id == notification1.id
        # Original data preserved
        assert notifications[0].title == "Retry Test 1"
        assert notifications[0].body == "This is attempt #1"

    finally:
        del WORKFLOW_REGISTRY["test_retry"]
