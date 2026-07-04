from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.models.message import CoachMessage
from app.models.workflow import WorkflowRun

def _enrich_message(msg: CoachMessage, workflow_name: Optional[str] = None):
    # Attach workflow_name dynamically for Pydantic schema
    # Or return a dict. Pydantic accepts dicts.
    return {
        "id": msg.id,
        "workflow_run_id": msg.workflow_run_id,
        "workflow_name": workflow_name,
        "created_at": msg.created_at,
        "subject": msg.subject,
        "body": msg.body,
        "tone": msg.tone,
        "read_at": msg.read_at
    }

def get_latest_student_message(db: Session, user_id: int):
    """
    Get latest message for user.
    """
    row = (
        db.query(CoachMessage, WorkflowRun.workflow_name)
        .outerjoin(WorkflowRun, CoachMessage.workflow_run_id == WorkflowRun.id)
        .filter(CoachMessage.user_id == user_id)
        .order_by(desc(CoachMessage.created_at))
        .first()
    )
    
    if not row:
        return None
        
    msg, wf_name = row
    return _enrich_message(msg, wf_name)

def get_student_messages_history(
    db: Session, 
    user_id: int, 
    limit: int = 50, 
    unread_only: bool = False
) -> List[dict]:
    """
    Get message history.
    """
    query = (
        db.query(CoachMessage, WorkflowRun.workflow_name)
        .outerjoin(WorkflowRun, CoachMessage.workflow_run_id == WorkflowRun.id)
        .filter(CoachMessage.user_id == user_id)
    )
    
    if unread_only:
        query = query.filter(CoachMessage.read_at.is_(None))
        
    rows = query.order_by(desc(CoachMessage.created_at)).limit(limit).all()
    
    return [_enrich_message(msg, wf_name) for msg, wf_name in rows]

def get_message_by_id(db: Session, user_id: int, message_id: int):
    row = (
        db.query(CoachMessage, WorkflowRun.workflow_name)
        .outerjoin(WorkflowRun, CoachMessage.workflow_run_id == WorkflowRun.id)
        .filter(CoachMessage.id == message_id)
        .filter(CoachMessage.user_id == user_id)
        .first()
    )
    
    if not row:
        return None
        
    msg, wf_name = row
    return _enrich_message(msg, wf_name)

def mark_message_read(db: Session, user_id: int, message_id: int):
    msg = (
        db.query(CoachMessage)
        .filter(CoachMessage.id == message_id)
        .filter(CoachMessage.user_id == user_id)
        .first()
    )
    
    if msg:
        if not msg.read_at:
            msg.read_at = func.now() # Server side timestamp
            db.commit()
            db.refresh(msg)
        
        # We need workflow name for the response
        wf_name = None
        if msg.workflow_run_id:
             # Lazy load or query
             # Since it's just one, secondary query is cheap
             wf = db.query(WorkflowRun).filter(WorkflowRun.id == msg.workflow_run_id).first()
             if wf:
                 wf_name = wf.workflow_name
                 
        return _enrich_message(msg, wf_name)
    return None

def get_unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(func.count(CoachMessage.id))
        .filter(CoachMessage.user_id == user_id)
        .filter(CoachMessage.read_at.is_(None))
        .scalar()
    ) or 0

# Support legacy signature for backward compatibility if needed, 
# but API is being updated to use these new functions.
# The legacy endpoints called:
# get_student_message_by_workflow_run
# I should keep it working or update API to not use it?
# Requirement 3: "GET /v1/students/me/messages/{id}" (New)
# I will implement 'get_student_message_by_workflow_run' using new table if desired, 
# but user didn't ask for it explicitly in the list.
# However, to keep existing code working (if any), I'll add a shim.

def get_student_message_by_workflow_run(db: Session, user_id: int, workflow_run_id: int):
    row = (
        db.query(CoachMessage, WorkflowRun.workflow_name)
        .outerjoin(WorkflowRun, CoachMessage.workflow_run_id == WorkflowRun.id)
        .filter(CoachMessage.workflow_run_id == workflow_run_id)
        .filter(CoachMessage.user_id == user_id)
        .first()
    )
    if not row:
        return None
    msg, wf = row
    return _enrich_message(msg, wf)
