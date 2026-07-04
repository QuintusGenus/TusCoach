"""
Mock Exams API routes
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import MockExam, MockExamBreakdown, User
from app.api.deps import get_current_user
from app.schemas.exam import (
    MockExamCreate,
    MockExamOut,
    MockExamBreakdownOut,
)

router = APIRouter(prefix="/students/me/exams", tags=["exams"])


def _build_exam_out(exam: MockExam) -> MockExamOut:
    breakdowns = []
    for b in exam.breakdowns:
        net = b.correct - b.wrong * 0.25
        breakdowns.append(MockExamBreakdownOut(
            id=b.id,
            subject=b.subject,
            correct=b.correct,
            wrong=b.wrong,
            blank=b.blank,
            net=round(net, 2),
        ))
    return MockExamOut(
        id=exam.id,
        exam_name=exam.exam_name,
        date=exam.date,
        total_score=exam.total_score,
        notes=exam.notes,
        created_at=exam.created_at.isoformat(),
        breakdowns=breakdowns,
    )


@router.post("", response_model=MockExamOut)
def create_mock_exam(
    data: MockExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a mock exam with per-subject breakdowns."""
    # Calculate total net score
    total_net = 0.0
    for b in data.breakdowns:
        total_net += b.correct - b.wrong * 0.25

    exam = MockExam(
        student_id=current_user.id,
        exam_name=data.exam_name,
        date=data.date,
        total_score=round(total_net, 2),
        notes=data.notes,
    )
    db.add(exam)
    db.flush()  # get exam.id

    for b in data.breakdowns:
        breakdown = MockExamBreakdown(
            exam_id=exam.id,
            subject=b.subject,
            correct=b.correct,
            wrong=b.wrong,
            blank=b.blank,
        )
        db.add(breakdown)

    db.commit()
    db.refresh(exam)
    return _build_exam_out(exam)


@router.get("", response_model=List[MockExamOut])
def list_mock_exams(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List mock exams for the authenticated user, newest first."""
    exams = (
        db.query(MockExam)
        .filter(MockExam.student_id == current_user.id)
        .order_by(desc(MockExam.date), desc(MockExam.id))
        .limit(limit)
        .all()
    )
    return [_build_exam_out(e) for e in exams]


@router.get("/{exam_id}", response_model=MockExamOut)
def get_mock_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single mock exam with breakdowns."""
    exam = db.query(MockExam).filter(MockExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your exam")
    return _build_exam_out(exam)


@router.delete("/{exam_id}", status_code=204)
def delete_mock_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a mock exam owned by the authenticated user."""
    exam = db.query(MockExam).filter(MockExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your exam")
    db.delete(exam)
    db.commit()
