"""
Tests for workflow notification enqueueing.

Verifies that push notifications are enqueued when workflows produce coach messages.
"""
import pytest
from app.services.workflow_engine import run_workflow
from app.models.notifications import Notification
from app.models.user import User


def test_workflow_with_coach_message_enqueues_notification(db, test_user):
    """
    Test that a workflow producing a student_message enqueues a notification.
    """
    # Register a minimal test workflow that produces a student_message
    from app.workflows import WORKFLOW_REGISTRY

    def test_coach_message_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Test Subject",
                "body": "Test body with some content",
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_coach_message"] = test_coach_message_workflow

    try:
        # Run the workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_coach_message"
        )

        assert run.status == "done"
        assert "student_message" in run.context

        # Check that a notification was enqueued
        notification = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()

        assert notification is not None
        assert notification.user_id == test_user.id
        assert notification.type == "coach_message"
        assert notification.title == "Test Subject"
        assert notification.body == "Test body with some content"
        assert notification.status == "pending"
        assert notification.data["kind"] == "coach_message"
        assert notification.data["workflow_run_id"] == run.id
        assert notification.data["student_id"] == test_user.id

    finally:
        # Cleanup test workflow
        del WORKFLOW_REGISTRY["test_coach_message"]


def test_workflow_without_coach_message_does_not_enqueue_notification(db, test_user):
    """
    Test that a workflow without a student_message does not enqueue a notification.
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_no_message_workflow(db_session, student_id, run_id):
        return {
            "some_other_data": "value"
        }

    WORKFLOW_REGISTRY["test_no_message"] = test_no_message_workflow

    try:
        # Run the workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_no_message"
        )

        assert run.status == "done"
        assert "student_message" not in run.context

        # Check that no notification was enqueued
        notification = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()

        assert notification is None

    finally:
        del WORKFLOW_REGISTRY["test_no_message"]


def test_workflow_with_empty_message_does_not_enqueue_notification(db, test_user):
    """
    Test that a workflow with an empty student_message does not enqueue a notification.
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_empty_message_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "",
                "body": "",
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_empty_message"] = test_empty_message_workflow

    try:
        # Run the workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_empty_message"
        )

        assert run.status == "done"

        # Check that no notification was enqueued
        notification = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()

        assert notification is None

    finally:
        del WORKFLOW_REGISTRY["test_empty_message"]


def test_duplicate_workflow_run_does_not_create_duplicate_notification(db, test_user):
    """
    Test that running the same workflow twice does not create duplicate notifications.

    This tests the idempotency constraint on workflow_run_id.
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_idempotent_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Idempotent Subject",
                "body": "This should only create one notification",
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_idempotent"] = test_idempotent_workflow

    try:
        # Run the workflow first time
        run1 = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_idempotent"
        )

        # Check that a notification was created
        notification1 = db.query(Notification).filter(
            Notification.workflow_run_id == run1.id
        ).first()
        assert notification1 is not None

        # Run the workflow second time (different workflow_run)
        run2 = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_idempotent"
        )

        # Check that a second notification was created for the second run
        notification2 = db.query(Notification).filter(
            Notification.workflow_run_id == run2.id
        ).first()
        assert notification2 is not None

        # But they should be different notifications
        assert notification1.id != notification2.id
        assert run1.id != run2.id

        # Total notifications should be 2
        total_notifications = db.query(Notification).filter(
            Notification.user_id == test_user.id
        ).count()
        assert total_notifications == 2

    finally:
        del WORKFLOW_REGISTRY["test_idempotent"]


def test_notification_body_truncated_to_120_chars(db, test_user):
    """
    Test that notification body is truncated to 120 characters for push notifications.
    """
    from app.workflows import WORKFLOW_REGISTRY

    long_body = "A" * 200  # 200 character body

    def test_long_body_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Long Body Test",
                "body": long_body,
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_long_body"] = test_long_body_workflow

    try:
        # Run the workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_long_body"
        )

        # Check notification body is truncated
        notification = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()

        assert notification is not None
        assert len(notification.body) == 120
        assert notification.body == "A" * 117 + "..."

    finally:
        del WORKFLOW_REGISTRY["test_long_body"]


def test_notification_fallback_title(db, test_user):
    """
    Test that notification uses fallback title when subject is empty.
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_no_subject_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "",
                "body": "Body without subject",
                "tone": "encouraging"
            }
        }

    WORKFLOW_REGISTRY["test_no_subject"] = test_no_subject_workflow

    try:
        # Run the workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_no_subject"
        )

        # Check notification uses fallback title
        notification = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()

        assert notification is not None
        assert notification.title == "New message from your coach"
        assert notification.body == "Body without subject"

    finally:
        del WORKFLOW_REGISTRY["test_no_subject"]


def test_workflow_failure_does_not_enqueue_notification(db, test_user):
    """
    Test that a failed workflow does not enqueue a notification.
    """
    from app.workflows import WORKFLOW_REGISTRY

    def test_failing_workflow(db_session, student_id, run_id):
        raise ValueError("Workflow failed intentionally")

    WORKFLOW_REGISTRY["test_failing"] = test_failing_workflow

    try:
        # Run the workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_failing"
        )

        assert run.status == "failed"

        # Check that no notification was enqueued
        notification = db.query(Notification).filter(
            Notification.workflow_run_id == run.id
        ).first()

        assert notification is None

    finally:
        del WORKFLOW_REGISTRY["test_failing"]
