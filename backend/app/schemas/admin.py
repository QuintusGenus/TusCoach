"""
Admin/Debug schemas for development
"""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class WorkflowRunOut(BaseModel):
    """Minimal workflow run info for admin debugging"""
    id: int
    student_id: int
    workflow_name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventLogOut(BaseModel):
    """Event log info for admin debugging"""
    id: int
    student_id: Optional[int] = None
    user_id: Optional[int] = None
    event_type: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlanTaskOut(BaseModel):
    """Plan task info for admin debugging"""
    id: int
    plan_id: int
    date: date
    topic_id: int
    task_type: str
    target_minutes: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
