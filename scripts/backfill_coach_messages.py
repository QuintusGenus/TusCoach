import sys
import os
import logging

# Add backend to path so we can import app modules
# Assumes script is at ROOT/scripts/backfill_coach_messages.py
# Backend is at ROOT/backend
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.core.db import SessionLocal
from app.models.workflow import WorkflowRun
from app.models.message import CoachMessage
from app.models.user import StudentProfile
from sqlalchemy.exc import IntegrityError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def backfill_workflow_messages():
    db = SessionLocal()
    try:
        logger.info("Starting backfill of coach messages from workflow history...")
        
        # 1. Fetch all runs with context
        runs = db.query(WorkflowRun).filter(WorkflowRun.context.isnot(None)).all()
        logger.info(f"Found {len(runs)} workflow runs to check.")
        
        count = 0
        skipped = 0
        errors = 0
        
        for run in runs:
            ctx = run.context or {}
            msg = ctx.get("student_message")
            
            # Check if message has content
            if not msg or (not msg.get("subject") and not msg.get("body")):
                continue
                
            # Check if already exists
            exists = db.query(CoachMessage).filter_by(workflow_run_id=run.id).first()
            if exists:
                skipped += 1
                continue
            
            # Resolve IDs
            # run.student_id is expected to be the User ID based on app logic
            user_id = run.student_id
            
            # Find Student Profile ID
            profile = db.query(StudentProfile).filter_by(user_id=user_id).first()
            if not profile:
                logger.warning(f"Run {run.id}: Profile not found for user {user_id}, skipping.")
                errors += 1
                continue
            
            try:
                new_msg = CoachMessage(
                    user_id=user_id,
                    student_id=profile.id,
                    workflow_run_id=run.id,
                    created_at=run.created_at, # Preserve historical timestamp
                    subject=msg.get("subject", "No Subject"),
                    body=msg.get("body", ""),
                    tone=msg.get("tone")
                )
                db.add(new_msg)
                db.commit()
                count += 1
            except IntegrityError:
                db.rollback()
                skipped += 1
            except Exception as e:
                db.rollback()
                logger.error(f"Error persisting run {run.id}: {e}")
                errors += 1
        
        logger.info(f"Backfill Complete.")
        logger.info(f"Created: {count}")
        logger.info(f"Skipped (Exists): {skipped}")
        logger.info(f"Errors/Missing Profile: {errors}")
        
    finally:
        db.close()

if __name__ == "__main__":
    backfill_workflow_messages()
