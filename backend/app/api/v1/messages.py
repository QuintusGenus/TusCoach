from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.schemas.coach_message import CoachMessageOut, UnreadCountResponse
from app.services.messages_service import (
    get_latest_student_message,
    get_student_messages_history,
    get_message_by_id,
    mark_message_read,
    get_unread_count,
    get_student_message_by_workflow_run
)
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/students/me/messages/latest", response_model=CoachMessageOut)
def get_my_latest_message(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the latest message for the authenticated user."""
    data = get_latest_student_message(db, current_user.id)
    if not data:
        raise HTTPException(status_code=404, detail="No coach message found")
    return data

@router.get("/students/me/messages/unread_count", response_model=UnreadCountResponse)
def get_my_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get count of unread messages."""
    count = get_unread_count(db, current_user.id)
    return {"unread_count": count}

@router.get("/students/me/messages", response_model=List[CoachMessageOut])
def get_my_messages_history(
    limit: int = Query(50, ge=1, le=100, description="Max messages"),
    unread_only: bool = Query(False, description="Filter unread only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List messages history."""
    messages = get_student_messages_history(db, current_user.id, limit=limit, unread_only=unread_only)
    return messages

@router.get("/students/me/messages/by-workflow-run/{workflow_run_id}", response_model=CoachMessageOut)
def get_my_message_by_workflow_run(
    workflow_run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get message by source workflow run ID (Legacy/Mobile support)."""
    data = get_student_message_by_workflow_run(db, current_user.id, workflow_run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Message not found")
    return data

@router.get("/students/me/messages/{message_id}", response_model=CoachMessageOut)
def get_my_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific message by ID."""
    data = get_message_by_id(db, current_user.id, message_id)
    if not data:
        raise HTTPException(status_code=404, detail="Message not found")
    return data

@router.post("/students/me/messages/{message_id}/read", response_model=CoachMessageOut)
def mark_my_message_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a message as read."""
    data = mark_message_read(db, current_user.id, message_id)
    if not data:
        raise HTTPException(status_code=404, detail="Message not found")
    return data
