"""
QBank API routes
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.db import get_db
from app.models import User
from app.models.qbank import Question, QBankExamSession
from app.api.deps import get_current_user
from app.schemas.qbank import (
    QuestionOut,
    AttemptCreate,
    AttemptResult,
    TodayQueueOut,
    MasteryOut,
    QBankExamCreate,
    QBankExamOut,
    QBankExamSubmitIn,
    QBankExamResult,
    SubjectListOut,
    DrillQueueOut,
    SubtopicMasteryOut,
)
from app.services import qbank_service

router = APIRouter(prefix="/students/me/qbank", tags=["qbank"])


@router.get("/today", response_model=TodayQueueOut)
def get_today_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return today's question queue: SRS reviews + adaptive new questions (up to 10 total)."""
    questions, srs_due_count = qbank_service.build_today_queue(db, current_user.id)
    return TodayQueueOut(questions=questions, srs_due_count=srs_due_count)


@router.get("/questions/{question_id}", response_model=QuestionOut)
def get_question(
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single approved question (correct_key and explanation withheld)."""
    question = db.get(Question, question_id)
    if not question or question.status == "retired":
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/attempts", response_model=AttemptResult)
def record_attempt(
    data: AttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an answer, update SRS state, return correct key and explanation."""
    try:
        return qbank_service.record_attempt(
            db, current_user.id, data.question_id, data.selected_key
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/subjects", response_model=List[SubjectListOut])
def get_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct subjects with subtopics from approved questions (for drill selector)."""
    return qbank_service.get_subjects_list(db)


@router.get("/drill", response_model=DrillQueueOut)
def get_drill_queue(
    subject: str = Query(..., description="Subject to drill"),
    subtopic: str | None = Query(None, description="Optional subtopic filter"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return up to `limit` approved questions for subject/subtopic drill.
    Excludes questions answered correctly in the last 7 days.
    """
    questions = qbank_service.get_drill_questions(
        db, current_user.id, subject, subtopic, limit
    )
    return DrillQueueOut(questions=questions, subject=subject, subtopic=subtopic)


@router.get("/mastery", response_model=List[MasteryOut])
def get_mastery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return per-subject attempt accuracy for both temel and klinik tracks."""
    return qbank_service.get_mastery(db, current_user.id)


@router.get("/mastery/{subject}", response_model=List[SubtopicMasteryOut])
def get_subtopic_mastery(
    subject: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return per-subtopic attempt accuracy for a given subject."""
    return qbank_service.get_subtopic_mastery(db, current_user.id, subject)


@router.post("/exams", response_model=QBankExamOut)
def start_exam(
    data: QBankExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new timed QBank exam session (up to 100 approved questions)."""
    session = qbank_service.start_exam_session(db, current_user.id, data.test_type)
    if not session.question_ids:
        raise HTTPException(
            status_code=422,
            detail=f"No approved questions found for test type '{data.test_type}'",
        )
    return session


@router.get("/exams/{session_id}", response_model=QBankExamOut)
def get_exam_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get an existing exam session."""
    session = db.get(QBankExamSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Exam session not found")
    if session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your exam session")
    return session


@router.post("/exams/{session_id}/submit", response_model=QBankExamResult)
def submit_exam(
    session_id: int,
    data: QBankExamSubmitIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit answers and receive scored results. Idempotent — safe to call twice."""
    session = db.get(QBankExamSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Exam session not found")
    if session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your exam session")

    session = qbank_service.submit_exam_session(db, session, data.answers)
    correct = sum(
        1 for v in (session.by_subject or {}).values() for _ in range(v["correct"])
    )
    # Re-count correctly from by_subject
    correct = sum(v["correct"] for v in (session.by_subject or {}).values())
    total = len(session.question_ids)
    return QBankExamResult(
        id=session.id,
        score_pct=session.score_pct or 0.0,
        correct=correct,
        total=total,
        by_subject=session.by_subject or {},
    )
