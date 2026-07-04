from typing import Any, Optional
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.plan import (
    DailyPlanResponse,
    PlanOverviewResponse,
    GeneratePlanRequest,
    UpdateTaskRequest,
    CreateTaskRequest,
    ReorderBlocksRequest,
    UpdateBlockDaysRequest,
)
from app.services import plan_service

router = APIRouter()


@router.get("/students/me/plan", response_model=DailyPlanResponse)
def get_daily_plan(
    date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get study plan tasks for a specific date (enriched with subject info)."""
    if not date:
        date = datetime.now(ZoneInfo("Europe/Istanbul")).date()

    tasks = plan_service.get_tasks_by_date(db, current_user.id, date)
    enriched = plan_service.enrich_tasks(db, tasks)
    return {"date": date, "tasks": enriched}


@router.get("/students/me/plan/overview")
def get_plan_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get overview of the active study plan (or null)."""
    plan = plan_service.get_active_plan(db, current_user.id)
    if not plan:
        return None

    total = len(plan.tasks) if plan.tasks else 0
    completed = sum(1 for t in plan.tasks if t.status == "done") if plan.tasks else 0
    return {
        "id": plan.id,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "version": plan.version,
        "status": plan.status,
        "total_tasks": total,
        "completed_tasks": completed,
        "tur_number": plan.tur_number,
    }


@router.get("/students/me/plan/structure")
def get_plan_structure(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get the full tur structure of the active plan."""
    plan = plan_service.get_active_plan(db, current_user.id)
    if not plan:
        return None
    return plan_service.get_plan_structure(db, plan)


@router.post("/students/me/plan/generate", response_model=PlanOverviewResponse)
def generate_plan(
    body: GeneratePlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Generate a new tur-based study plan. Archives any existing active plan."""
    plan = plan_service.generate_study_plan(
        db, current_user.id, tur_number=body.tur_number
    )
    total = len(plan.tasks) if plan.tasks else 0
    completed = sum(1 for t in plan.tasks if t.status == "done") if plan.tasks else 0
    return {
        "id": plan.id,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "version": plan.version,
        "status": plan.status,
        "total_tasks": total,
        "completed_tasks": completed,
        "tur_number": plan.tur_number,
    }


@router.post("/plan_tasks/{task_id}/complete")
def complete_plan_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark a plan task as done."""
    task = plan_service.complete_task(db, task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or permission denied")
    return {"status": "success", "task_id": task.id, "new_status": task.status}


@router.put("/plan_tasks/{task_id}")
def update_plan_task(
    task_id: int,
    body: UpdateTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update a plan task's target_minutes, task_type, and/or date."""
    try:
        task = plan_service.update_task(
            db, task_id, current_user.id,
            target_minutes=body.target_minutes,
            task_type=body.task_type,
            new_date=body.date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or permission denied")
    enriched = plan_service.enrich_tasks(db, [task])
    return {"status": "success", "task": enriched[0]}


@router.post("/plan_tasks")
def create_plan_task(
    body: CreateTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new task on a specific date within the active plan."""
    try:
        task = plan_service.create_task(
            db, current_user.id,
            task_date=body.date,
            task_type=body.task_type,
            target_minutes=body.target_minutes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    enriched = plan_service.enrich_tasks(db, [task])
    return {"status": "success", "task": enriched[0]}


@router.put("/students/me/plan/blocks/reorder")
def reorder_plan_blocks(
    body: ReorderBlocksRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Reorder subject blocks. All task dates are reassigned."""
    try:
        plan = plan_service.reorder_blocks(db, current_user.id, body.order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return plan_service.get_plan_structure(db, plan)


@router.put("/students/me/plan/blocks/{subject}")
def update_block_days(
    subject: str,
    body: UpdateBlockDaysRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Change reading/question days for a subject block. Cascades to subsequent blocks."""
    try:
        plan = plan_service.update_block_days(
            db, current_user.id,
            subject=subject,
            reading_days=body.reading_days,
            question_days=body.question_days,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return plan_service.get_plan_structure(db, plan)


@router.get("/subjects/{subject}/topics")
def get_subject_topics(
    subject: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get topics (konular) for a subject."""
    from app.models.study import Topic
    topics = (
        db.query(Topic)
        .filter(Topic.subject == subject)
        .order_by(Topic.sort_order, Topic.id)
        .all()
    )
    return [
        {"id": t.id, "name": t.name, "parent_id": t.parent_id, "sort_order": t.sort_order}
        for t in topics
    ]


@router.delete("/plan_tasks/{task_id}")
def delete_plan_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Delete a plan task."""
    deleted = plan_service.delete_task(db, task_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found or permission denied")
    return {"status": "success"}
