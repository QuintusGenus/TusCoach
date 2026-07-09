from pydantic import BaseModel, ConfigDict, Field
from datetime import date
from typing import List, Optional


class PlanTaskOut(BaseModel):
    id: int
    task_type: str
    target_minutes: int
    status: str
    date: date
    subject: Optional[str] = None
    topic_name: Optional[str] = None
    phase: Optional[str] = None
    subject_block_order: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DailyPlanResponse(BaseModel):
    date: date
    tasks: List[PlanTaskOut]


class PlanOverviewResponse(BaseModel):
    id: int
    start_date: date
    end_date: date
    version: int
    status: str
    total_tasks: int
    completed_tasks: int
    tur_number: Optional[int] = None


class BlockConfigItem(BaseModel):
    """One subject's block in a user-customized plan structure."""
    subject: str
    order: int = Field(ge=1)
    reading_days: int = Field(ge=0, le=30)
    question_days: int = Field(ge=0, le=30)


class GeneratePlanRequest(BaseModel):
    tur_number: int = 1
    # When provided, the plan structure is built from the user's own per-subject
    # block config instead of the fixed tur preset. tur_number is still used for
    # labeling and task-detail heuristics.
    custom_block_config: Optional[List[BlockConfigItem]] = None


class UpdateTaskRequest(BaseModel):
    target_minutes: Optional[int] = None
    task_type: Optional[str] = None
    date: Optional[date] = None


class CreateTaskRequest(BaseModel):
    date: date
    task_type: str
    target_minutes: int


class ReorderBlocksRequest(BaseModel):
    order: List[str]


class UpdateBlockDaysRequest(BaseModel):
    reading_days: int
    question_days: int


class SubjectBlockInfo(BaseModel):
    subject: str
    order: int
    start_date: date
    end_date: date
    reading_days: int
    question_days: int
    phase: str  # "completed", "active", "pending"


class PlanStructureResponse(BaseModel):
    id: int
    tur_number: int
    start_date: date
    end_date: date
    blocks: List[SubjectBlockInfo]
    current_block_index: Optional[int] = None
