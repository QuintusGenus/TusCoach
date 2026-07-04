"""
Study Sessions API routes
"""
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import StudySession, User
from app.api.deps import get_current_user
from app.services.events_service import emit_event, EventValidationError

router = APIRouter(prefix="/sessions", tags=["sessions"])


class StudySessionCreate(BaseModel):
    """Request body for creating a study session"""
    date: datetime.date = Field(..., description="Date of the study session")
    minutes: int = Field(..., ge=1, le=1000, description="Duration in minutes (1-1000)")
    subject: Optional[str] = Field(default=None, description="TUS subject name")
    topic_id: Optional[int] = Field(default=None, description="Optional topic ID")
    notes: Optional[str] = Field(default=None, description="Optional notes")


class StudySessionResponse(BaseModel):
    """Response body for study session"""
    id: int
    student_id: int
    date: datetime.date
    minutes: int
    subject: Optional[str] = None
    topic_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/", response_model=StudySessionResponse)
def create_study_session(
    session_data: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new study session for the authenticated user."""
    study_session = StudySession(
        student_id=current_user.id,
        date=session_data.date,
        minutes=session_data.minutes,
        subject=session_data.subject,
        topic_id=session_data.topic_id,
        notes=session_data.notes
    )

    db.add(study_session)
    db.commit()
    db.refresh(study_session)

    try:
        emit_event(
            db=db,
            student_id=current_user.id,
            event_type="study_session_created",
            payload={
                "session_id": study_session.id,
                "minutes": session_data.minutes,
                "date": str(session_data.date),
                "subject": session_data.subject,
                "topic_id": session_data.topic_id
            }
        )
    except EventValidationError as e:
        print(f"Failed to emit event: {e}")

    return StudySessionResponse(
        id=study_session.id,
        student_id=study_session.student_id,
        date=study_session.date,
        minutes=study_session.minutes,
        subject=study_session.subject,
        topic_id=study_session.topic_id,
        notes=study_session.notes,
        created_at=study_session.created_at.isoformat()
    )


@router.get("/students/me/sessions", response_model=List[StudySessionResponse])
def list_study_sessions(
    days: int = Query(default=30, ge=1, le=365),
    subject: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List study sessions for the authenticated user."""
    cutoff = datetime.date.today() - datetime.timedelta(days=days)
    q = db.query(StudySession).filter(
        StudySession.student_id == current_user.id,
        StudySession.date >= cutoff,
    )
    if subject:
        q = q.filter(StudySession.subject == subject)
    sessions = q.order_by(desc(StudySession.date), desc(StudySession.id)).all()
    return [
        StudySessionResponse(
            id=s.id,
            student_id=s.student_id,
            date=s.date,
            minutes=s.minutes,
            subject=s.subject,
            topic_id=s.topic_id,
            notes=s.notes,
            created_at=s.created_at.isoformat()
        )
        for s in sessions
    ]


@router.delete("/students/me/sessions/{session_id}", status_code=204)
def delete_study_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a study session owned by the authenticated user."""
    session = db.query(StudySession).filter(StudySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    db.delete(session)
    db.commit()
