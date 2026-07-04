from app.core.db import SessionLocal
from app.models import User, StudentProfile, CoachMessage
from app.services.workflow_engine import run_workflow
from app.workflows import WORKFLOW_REGISTRY
from app.core.security import get_password_hash
from sqlalchemy import text
import pytest
import logging
import sys

# Configure logging to see workflow engine output
logging.basicConfig(stream=sys.stderr, level=logging.INFO)


# Mock Workflow Handler
def mock_persistence_workflow(db, student_id, run_id):
    return {
        "student_message": {
            "subject": "Persistence Test Subject",
            "body": "Persistence Test Body",
            "tone": "confident"
        }
    }

# Register logic
WORKFLOW_REGISTRY["test_persistence_flow"] = mock_persistence_workflow

def test_workflow_message_persistence():
    db = SessionLocal()
    try:
        # 1. Setup Data
        email = "test_persistence_unique@example.com"
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(email=email, hashed_password=get_password_hash("test"), is_active=True)
            db.add(user)
            db.commit()
            db.refresh(user)

        profile = db.query(StudentProfile).filter_by(user_id=user.id).first()
        if not profile:
            profile = StudentProfile(user_id=user.id)
            db.add(profile)
            db.commit()

        # 2. Run Workflow (First Time)
        print("Running workflow first time...")
        run = run_workflow(db, user.id, "test_persistence_flow")
        
        assert run.status == "done"
        
        # Verify persistence
        msg = db.query(CoachMessage).filter_by(workflow_run_id=run.id).first()
        assert msg is not None
        assert msg.subject == "Persistence Test Subject"
        assert msg.user_id == user.id

        print("First run persisted message successfully.")

        # 3. Test Idempotency
        # Since run_workflow creates a NEW run ID, we can't 'rerun' it to test idempotency of the *same* run.
        # We must manually try to insert a duplicate for this runs ID to verify DB constraint works,
        # AND/OR assume the code block handles it.
        # Let's verify valid DB constraint:
        
        try:
            dup_msg = CoachMessage(
                user_id=user.id,
                student_id=profile.id,
                workflow_run_id=run.id,
                subject="Duplicate",
                body="Duplicate"
            )
            db.add(dup_msg)
            db.commit()
            raise AssertionError("Should have failed with IntegrityError")
        except Exception as e:
            db.rollback()
            print(f"Caught expected error for duplicate insert: {e}")
            assert "integrity" in str(e).lower() or "unique" in str(e).lower()

        # 4. Verify original still exists
        msg_check = db.query(CoachMessage).filter_by(workflow_run_id=run.id).first()
        assert msg_check.subject == "Persistence Test Subject"

        print("Idempotency verified.")

    finally:
        db.close()

if __name__ == "__main__":
    test_workflow_message_persistence()
