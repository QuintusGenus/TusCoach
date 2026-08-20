"""
Admin/Debug endpoints for development
"""
import uuid
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.db import get_db
from app.api.deps import get_current_user, get_admin_user
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.models.events import EventLog
from app.models.study import PlanTask, StudyPlan
from app.models.qbank import Question
from app.schemas.admin import (
    WorkflowRunOut, EventLogOut, PlanTaskOut,
    QuestionAdminOut, QuestionPatchIn, BulkApproveIn,
)

router = APIRouter()


@router.get("/workflow_runs", response_model=List[WorkflowRunOut])
def list_workflow_runs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    return (
        db.query(WorkflowRun)
        .order_by(desc(WorkflowRun.created_at))
        .limit(limit)
        .all()
    )


@router.get("/events", response_model=List[EventLogOut])
def list_event_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    return (
        db.query(EventLog)
        .order_by(desc(EventLog.created_at))
        .limit(limit)
        .all()
    )


@router.get("/plan_tasks", response_model=List[PlanTaskOut])
def list_plan_tasks(
    date: date = Query(..., description="Date to filter plan tasks (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _admin: User = Depends(get_admin_user),
):
    return (
        db.query(PlanTask)
        .join(StudyPlan, PlanTask.plan_id == StudyPlan.id)
        .filter(PlanTask.date == date)
        .filter(StudyPlan.student_id == current_user.id)
        .order_by(PlanTask.created_at)
        .all()
    )


# ── Question pipeline endpoints ───────────────────────────────────────────────

@router.get("/questions", response_model=List[QuestionAdminOut])
def list_questions(
    status_filter: Optional[str] = Query(None, alias="status",
                                         description="draft | approved | retired"),
    test_type: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List questions with optional filters. Defaults to all statuses."""
    q = db.query(Question)
    if status_filter:
        q = q.filter(Question.status == status_filter)
    if test_type:
        q = q.filter(Question.test == test_type)
    if subject:
        q = q.filter(Question.subject == subject)
    return q.order_by(desc(Question.created_at)).limit(limit).all()


# bulk-approve must appear before {question_id} routes to avoid routing ambiguity
@router.post("/questions/bulk-approve", response_model=List[QuestionAdminOut])
def bulk_approve_questions(
    data: BulkApproveIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Approve a list of questions by ID. Returns the updated records."""
    questions = (
        db.query(Question)
        .filter(Question.id.in_(data.ids))
        .all()
    )
    for q in questions:
        q.status = "approved"
    db.commit()
    for q in questions:
        db.refresh(q)
    return questions


@router.post("/questions/{question_id}/approve", response_model=QuestionAdminOut)
def approve_question(
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Approve a draft question — makes it live in Pratik immediately."""
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    question.status = "approved"
    db.commit()
    db.refresh(question)
    return question


@router.post("/questions/{question_id}/reject", response_model=QuestionAdminOut)
def reject_question(
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Reject (retire) a draft question."""
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    question.status = "retired"
    db.commit()
    db.refresh(question)
    return question


@router.patch("/questions/{question_id}", response_model=QuestionAdminOut)
def patch_question(
    question_id: uuid.UUID,
    data: QuestionPatchIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Edit any field of a question before or after approval."""
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    db.commit()
    db.refresh(question)
    return question
