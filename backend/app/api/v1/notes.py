"""
Notes API routes
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Note, User
from app.api.deps import get_current_user
from app.schemas.note import NoteCreate, NoteUpdate, NoteOut

router = APIRouter(prefix="/students/me/notes", tags=["notes"])


def _note_out(n: Note) -> NoteOut:
    return NoteOut(
        id=n.id,
        subject=n.subject,
        title=n.title,
        content=n.content,
        created_at=n.created_at.isoformat(),
        updated_at=n.updated_at.isoformat() if n.updated_at else None,
    )


@router.post("", response_model=NoteOut)
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new note."""
    note = Note(
        student_id=current_user.id,
        subject=data.subject,
        title=data.title,
        content=data.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_out(note)


@router.get("", response_model=List[NoteOut])
def list_notes(
    subject: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notes for the authenticated user."""
    q = db.query(Note).filter(Note.student_id == current_user.id)
    if subject:
        q = q.filter(Note.subject == subject)
    notes = q.order_by(desc(Note.created_at)).limit(limit).all()
    return [_note_out(n) for n in notes]


@router.get("/{note_id}", response_model=NoteOut)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your note")
    return _note_out(note)


@router.put("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your note")

    if data.subject is not None:
        note.subject = data.subject
    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    note.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(note)
    return _note_out(note)


@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your note")
    db.delete(note)
    db.commit()
