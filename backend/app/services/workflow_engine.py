"""
Workflow Engine
Orchestrates execution of proactive coaching flows.
"""
import traceback
import logging
from typing import Callable, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models import WorkflowRun, CoachMessage, StudentProfile
from app.workflows import WORKFLOW_REGISTRY
from app.services.notification_service import enqueue_coach_message_notification

logger = logging.getLogger(__name__)

def run_workflow(
    db: Session,
    student_id: int,
    workflow_name: str,
    trigger_event_id: Optional[int] = None
) -> WorkflowRun:
    """
    Executes a named workflow for a student.
    
    Args:
        db: Database session
        student_id: Target student (User ID)
        workflow_name: Name of workflow to run (must be in registry)
        trigger_event_id: Optional ID of event that triggered this
        
    Returns:
        WorkflowRun object (updated with status and context)
    """
    # 1. Create WorkflowRun record
    run = WorkflowRun(
        student_id=student_id,
        workflow_name=workflow_name,
        status="queued",
        trigger_event_id=trigger_event_id,
        context={}
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # 2. Lookup Workflow
    handler = WORKFLOW_REGISTRY.get(workflow_name)
    if not handler:
        run.status = "failed"
        run.context = {"error": f"Workflow '{workflow_name}' not found"}
        db.commit()
        return run

    # 3. Execute
    try:
        run.status = "running"
        db.commit()

        # Run handler - handler should return updated context dict
        result_context = handler(db, student_id, run.id)

        run.context = result_context if result_context else {}
        run.status = "done"
        db.commit()

        # 4. Enqueue push notification & Persist Message
        if run.context and "student_message" in run.context:
            student_message = run.context["student_message"]
            has_content = student_message and (student_message.get("subject") or student_message.get("body"))
            
            if has_content:
                message_id = None

                # A. Persist message to DB first (so we have message_id for notification)
                try:
                    profile = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
                    if profile:
                        coach_msg = CoachMessage(
                            user_id=student_id,
                            student_id=profile.id,
                            workflow_run_id=run.id,
                            subject=student_message.get("subject"),
                            body=student_message.get("body"),
                            tone=student_message.get("tone")
                        )
                        db.add(coach_msg)
                        db.commit()
                        db.refresh(coach_msg)
                        message_id = coach_msg.id
                        logger.info(f"Persisted CoachMessage {message_id} for run {run.id}")
                    else:
                        logger.warning(f"Skipped persistence: No StudentProfile for user {student_id}")
                except IntegrityError as e:
                    db.rollback()
                    logger.info(f"IntegrityError persistence: {e}")
                except Exception as persist_error:
                    logger.error(f"Failed to persist message for run {run.id}: {persist_error}", exc_info=True)

                # B. Enqueue notification (with message_id if available)
                try:
                    enqueue_coach_message_notification(
                        db=db,
                        user_id=student_id,
                        workflow_run_id=run.id,
                        student_message=student_message,
                        message_id=message_id  # Pass message_id for deep linking
                    )
                    logger.info(
                        f"Enqueued push notification for workflow_run {run.id} (message_id={message_id})"
                    )
                except Exception as notif_error:
                    # Don't fail the workflow if notification enqueueing fails
                    logger.error(
                        f"Failed to enqueue notification for workflow_run {run.id}: {notif_error}",
                        exc_info=True
                    )

    except Exception as e:
        db.rollback()
        run.status = "failed"
        run.context = {"error": str(e), "traceback": traceback.format_exc()}
        db.commit()

    db.refresh(run)
    return run
