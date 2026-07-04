"""
Admin/Debug endpoints for development

WARNING: DEV-ONLY ENDPOINTS
These endpoints are for development and debugging purposes.
TODO: Add proper admin role checking before deploying to production.
TODO: Currently allows any authenticated user - must restrict to admin role.
"""
from typing import List
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.models.events import EventLog
from app.models.study import PlanTask, StudyPlan
from app.schemas.admin import WorkflowRunOut, EventLogOut, PlanTaskOut

router = APIRouter()


@router.get("/workflow_runs", response_model=List[WorkflowRunOut])
def list_workflow_runs(
    limit: int = Query(50, ge=1, le=200, description="Number of workflow runs to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # TODO: Add admin role check
):
    """
    [DEV-ONLY] List recent workflow runs for debugging.

    Returns the last N workflow runs ordered by created_at descending.

    TODO: Restrict to admin role only.
    """
    runs = (
        db.query(WorkflowRun)
        .order_by(desc(WorkflowRun.created_at))
        .limit(limit)
        .all()
    )
    return runs


@router.get("/events", response_model=List[EventLogOut])
def list_event_logs(
    limit: int = Query(50, ge=1, le=200, description="Number of events to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # TODO: Add admin role check
):
    """
    [DEV-ONLY] List recent event logs for debugging.

    Returns the last N event logs ordered by created_at descending.

    TODO: Restrict to admin role only.
    """
    events = (
        db.query(EventLog)
        .order_by(desc(EventLog.created_at))
        .limit(limit)
        .all()
    )
    return events


@router.get("/plan_tasks", response_model=List[PlanTaskOut])
def list_plan_tasks(
    date: date = Query(..., description="Date to filter plan tasks (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # TODO: Add admin role check
):
    """
    [DEV-ONLY] List plan tasks for a specific date.

    Currently returns tasks for the authenticated user's student_id.

    TODO: Restrict to admin role only.
    TODO: Add optional student_id parameter to view any student's tasks (admin only).
    """
    # For MVP, return tasks for the authenticated user
    # In the future, admins should be able to query any student's tasks
    tasks = (
        db.query(PlanTask)
        .join(StudyPlan, PlanTask.plan_id == StudyPlan.id)
        .filter(PlanTask.date == date)
        .filter(StudyPlan.student_id == current_user.id)
        .order_by(PlanTask.created_at)
        .all()
    )
    return tasks
