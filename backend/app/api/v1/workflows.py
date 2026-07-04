"""
Workflows API routes
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.workflow_engine import run_workflow
from app.models import WorkflowRun, User

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.post("/students/{student_id}/{workflow_name}/run")
def trigger_workflow(
    student_id: int, 
    workflow_name: str, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Trigger a workflow execution for a student.
    Runs synchronously for MVP (or can use background_tasks if preferred).
    For now, let's run it synchronously to return the result immediately for debugging.
    """
    # Validate Student exists
    stud = db.get(User, student_id)
    if not stud:
        raise HTTPException(status_code=404, detail="Student not found")

    # Run
    run = run_workflow(db, student_id, workflow_name)
    
    if run.status == "failed":
        raise HTTPException(status_code=500, detail=run.context)
        
    return {
        "run_id": run.id,
        "workflow": run.workflow_name,
        "status": run.status,
        "context": run.context,
        "created_at": run.created_at
    }

@router.get("/{run_id}")
def get_workflow_run(run_id: int, db: Session = Depends(get_db)):
    """
    Get workflow run details
    """
    run = db.get(WorkflowRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
        
    return {
        "run_id": run.id,
        "workflow": run.workflow_name,
        "status": run.status,
        "context": run.context,
        "created_at": run.created_at
    }
