"""
Tests for coach message persistence idempotency.

Verifies that coach messages are persisted exactly once per workflow_run,
even if the persistence logic is called multiple times.
"""
import pytest
from sqlalchemy.exc import IntegrityError
from app.models import User, StudentProfile, WorkflowRun, CoachMessage
from app.services.workflow_engine import run_workflow
from app.workflows import WORKFLOW_REGISTRY


def test_workflow_persists_coach_message_on_completion(db, test_user, test_student_profile):
    """
    Test that a workflow with student_message persists to coach_messages table.
    """
    def test_message_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Test Message Subject",
                "body": "Test message body with content",
                "tone": "encouraging"
            },
            "other_data": "some value"
        }

    WORKFLOW_REGISTRY["test_message_persist"] = test_message_workflow

    try:
        # Run workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_message_persist"
        )

        assert run.status == "done"
        assert "student_message" in run.context

        # Verify message was persisted
        message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()

        assert message is not None
        assert message.user_id == test_user.id
        assert message.student_id == test_student_profile.id
        assert message.workflow_run_id == run.id
        assert message.subject == "Test Message Subject"
        assert message.body == "Test message body with content"
        assert message.tone == "encouraging"
        assert message.read_at is None
        assert message.created_at is not None

        # Verify only one message was created
        message_count = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).count()
        assert message_count == 1

    finally:
        del WORKFLOW_REGISTRY["test_message_persist"]


def test_duplicate_persistence_attempt_is_idempotent(db, test_user, test_student_profile):
    """
    Test that attempting to persist the same workflow_run_id twice does not create duplicates.

    This simulates a scenario where the workflow persistence logic runs multiple times
    for the same workflow_run (e.g., retry logic, race condition, manual reprocessing).
    """
    def test_idempotent_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Idempotency Test",
                "body": "This should only be persisted once",
                "tone": "neutral"
            }
        }

    WORKFLOW_REGISTRY["test_idempotent_persist"] = test_idempotent_workflow

    try:
        # First workflow run - should persist message
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_idempotent_persist"
        )

        assert run.status == "done"

        # Verify first message was created
        first_message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()
        assert first_message is not None
        first_message_id = first_message.id

        # Attempt to persist the same workflow_run_id again (simulating duplicate persistence)
        # This should fail due to UNIQUE constraint and be handled gracefully
        try:
            duplicate_message = CoachMessage(
                user_id=test_user.id,
                student_id=test_student_profile.id,
                workflow_run_id=run.id,  # Same workflow_run_id
                subject="Duplicate Subject",
                body="This should not be inserted",
                tone="neutral"
            )
            db.add(duplicate_message)
            db.commit()

            # If we get here, the constraint didn't work
            pytest.fail("Expected IntegrityError due to duplicate workflow_run_id")

        except IntegrityError as e:
            # This is expected - rollback and continue
            db.rollback()
            assert "uq_user_workflow_run" in str(e).lower() or "unique" in str(e).lower()

        # Verify only one message exists for this workflow_run
        message_count = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).count()
        assert message_count == 1

        # Verify the original message is still intact
        final_message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()
        assert final_message.id == first_message_id
        assert final_message.subject == "Idempotency Test"
        assert final_message.body == "This should only be persisted once"

    finally:
        del WORKFLOW_REGISTRY["test_idempotent_persist"]


def test_multiple_workflows_for_same_user_create_multiple_messages(db, test_user, test_student_profile):
    """
    Test that running multiple different workflows for the same user creates multiple messages.
    """
    def test_workflow_1(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "First Workflow",
                "body": "First message",
                "tone": "encouraging"
            }
        }

    def test_workflow_2(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Second Workflow",
                "body": "Second message",
                "tone": "supportive"
            }
        }

    WORKFLOW_REGISTRY["test_multi_1"] = test_workflow_1
    WORKFLOW_REGISTRY["test_multi_2"] = test_workflow_2

    try:
        # Run first workflow
        run1 = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_multi_1"
        )

        # Run second workflow
        run2 = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_multi_2"
        )

        # Verify both workflows succeeded
        assert run1.status == "done"
        assert run2.status == "done"

        # Verify two different messages were created
        messages = db.query(CoachMessage).filter(
            CoachMessage.user_id == test_user.id
        ).order_by(CoachMessage.created_at).all()

        assert len(messages) == 2
        assert messages[0].workflow_run_id == run1.id
        assert messages[0].subject == "First Workflow"
        assert messages[1].workflow_run_id == run2.id
        assert messages[1].subject == "Second Workflow"

    finally:
        del WORKFLOW_REGISTRY["test_multi_1"]
        del WORKFLOW_REGISTRY["test_multi_2"]


def test_workflow_without_student_message_does_not_persist(db, test_user, test_student_profile):
    """
    Test that workflows without student_message do not create coach_messages entries.
    """
    def test_no_message_workflow(db_session, student_id, run_id):
        return {
            "some_other_data": "value",
            "workflow_result": "success"
        }

    WORKFLOW_REGISTRY["test_no_message_persist"] = test_no_message_workflow

    try:
        # Run workflow without student_message
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_no_message_persist"
        )

        assert run.status == "done"
        assert "student_message" not in run.context

        # Verify no message was persisted
        message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()

        assert message is None

    finally:
        del WORKFLOW_REGISTRY["test_no_message_persist"]


def test_workflow_with_empty_message_does_not_persist(db, test_user, test_student_profile):
    """
    Test that workflows with empty subject and body do not persist messages.
    """
    def test_empty_message_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "",
                "body": "",
                "tone": "neutral"
            }
        }

    WORKFLOW_REGISTRY["test_empty_persist"] = test_empty_message_workflow

    try:
        # Run workflow with empty message
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_empty_persist"
        )

        assert run.status == "done"

        # Verify no message was persisted (empty content)
        message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()

        assert message is None

    finally:
        del WORKFLOW_REGISTRY["test_empty_persist"]


def test_workflow_with_only_subject_persists_message(db, test_user, test_student_profile):
    """
    Test that a workflow with only subject (no body) still persists.
    """
    def test_subject_only_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Subject Only",
                "body": "",
                "tone": "neutral"
            }
        }

    WORKFLOW_REGISTRY["test_subject_only"] = test_subject_only_workflow

    try:
        # Run workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_subject_only"
        )

        assert run.status == "done"

        # Verify message was persisted (subject is non-empty)
        message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()

        assert message is not None
        assert message.subject == "Subject Only"
        assert message.body == ""

    finally:
        del WORKFLOW_REGISTRY["test_subject_only"]


def test_workflow_with_only_body_persists_message(db, test_user, test_student_profile):
    """
    Test that a workflow with only body (no subject) still persists.
    """
    def test_body_only_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "",
                "body": "Body content without subject",
                "tone": "neutral"
            }
        }

    WORKFLOW_REGISTRY["test_body_only"] = test_body_only_workflow

    try:
        # Run workflow
        run = run_workflow(
            db=db,
            student_id=test_user.id,
            workflow_name="test_body_only"
        )

        assert run.status == "done"

        # Verify message was persisted (body is non-empty)
        message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()

        assert message is not None
        assert message.subject == ""
        assert message.body == "Body content without subject"

    finally:
        del WORKFLOW_REGISTRY["test_body_only"]


def test_workflow_persistence_failure_does_not_fail_workflow(db, test_user):
    """
    Test that if message persistence fails (e.g., no StudentProfile),
    the workflow still completes successfully.
    """
    # Create user without StudentProfile
    user_no_profile = User(
        email="no_profile@example.com",
        hashed_password="hashed",
        is_active=True
    )
    db.add(user_no_profile)
    db.commit()
    db.refresh(user_no_profile)

    def test_no_profile_workflow(db_session, student_id, run_id):
        return {
            "student_message": {
                "subject": "Test Subject",
                "body": "Test body",
                "tone": "neutral"
            }
        }

    WORKFLOW_REGISTRY["test_no_profile"] = test_no_profile_workflow

    try:
        # Run workflow for user without StudentProfile
        run = run_workflow(
            db=db,
            student_id=user_no_profile.id,
            workflow_name="test_no_profile"
        )

        # Workflow should still complete successfully
        assert run.status == "done"
        assert "student_message" in run.context

        # But no message should be persisted
        message = db.query(CoachMessage).filter(
            CoachMessage.workflow_run_id == run.id
        ).first()

        assert message is None

    finally:
        del WORKFLOW_REGISTRY["test_no_profile"]
        db.delete(user_no_profile)
        db.commit()


def test_workflow_with_null_workflow_run_id_in_message(db, test_user, test_student_profile):
    """
    Test that CoachMessages can be created without a workflow_run_id (manual messages).

    Note: The UNIQUE constraint is on (user_id, workflow_run_id), which allows
    multiple messages with workflow_run_id = NULL for the same user.
    """
    # Create first manual message (no workflow_run_id)
    message1 = CoachMessage(
        user_id=test_user.id,
        student_id=test_student_profile.id,
        workflow_run_id=None,
        subject="Manual Message 1",
        body="First manual message",
        tone="neutral"
    )
    db.add(message1)
    db.commit()

    # Create second manual message (also no workflow_run_id)
    message2 = CoachMessage(
        user_id=test_user.id,
        student_id=test_student_profile.id,
        workflow_run_id=None,
        subject="Manual Message 2",
        body="Second manual message",
        tone="encouraging"
    )
    db.add(message2)
    db.commit()

    # Both should be persisted successfully
    manual_messages = db.query(CoachMessage).filter(
        CoachMessage.user_id == test_user.id,
        CoachMessage.workflow_run_id.is_(None)
    ).all()

    assert len(manual_messages) == 2
    assert manual_messages[0].subject == "Manual Message 1"
    assert manual_messages[1].subject == "Manual Message 2"
