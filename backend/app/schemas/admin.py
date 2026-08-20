"""
Admin/Debug schemas for development
"""
import uuid
from datetime import datetime, date
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict


class WorkflowRunOut(BaseModel):
    """Minimal workflow run info for admin debugging"""
    id: int
    student_id: int
    workflow_name: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventLogOut(BaseModel):
    """Event log info for admin debugging"""
    id: int
    student_id: Optional[int] = None
    user_id: Optional[int] = None
    event_type: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


# ── Question pipeline schemas ─────────────────────────────────────────────────

class QuestionAdminOut(BaseModel):
    """Full question details for admin review — includes correct_key and explanation."""
    id: uuid.UUID
    test: str
    subject: str
    subtopic: Optional[str] = None
    difficulty_label: Optional[str] = None
    stem: str
    options: Dict[str, str]
    correct_key: str
    explanation: Optional[str] = None
    source_citation: Optional[str] = None
    predicted_diff: Optional[float] = None
    empirical_diff: Optional[float] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuestionPatchIn(BaseModel):
    """All fields optional — only provided fields are updated."""
    test: Optional[str] = None
    subject: Optional[str] = None
    subtopic: Optional[str] = None
    difficulty_label: Optional[str] = None
    stem: Optional[str] = None
    options: Optional[Dict[str, str]] = None
    correct_key: Optional[str] = None
    explanation: Optional[str] = None
    source_citation: Optional[str] = None
    predicted_diff: Optional[float] = None


class BulkApproveIn(BaseModel):
    """List of question IDs to bulk-approve."""
    ids: List[uuid.UUID]
