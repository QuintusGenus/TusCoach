"""
QBank Pydantic V2 schemas
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, ConfigDict, Field


# ─── Question ────────────────────────────────────────────────────────────────

class QuestionOut(BaseModel):
    """Question sent to the client — correct_key and explanation omitted until answered."""
    id: uuid.UUID
    test: str
    subject: str
    subtopic: Optional[str] = None
    stem: str
    options: Dict[str, str]            # {"A": "...", "B": "...", ...}
    status: str

    model_config = ConfigDict(from_attributes=True)


# ─── Attempts ─────────────────────────────────────────────────────────────────

class AttemptCreate(BaseModel):
    question_id: uuid.UUID
    selected_key: str = Field(..., min_length=1, max_length=1)


class AttemptResult(BaseModel):
    is_correct: bool
    correct_key: str
    explanation: Optional[str] = None


# ─── Today's Queue ────────────────────────────────────────────────────────────

class TodayQueueOut(BaseModel):
    questions: List[QuestionOut]
    srs_due_count: int


# ─── Mastery ──────────────────────────────────────────────────────────────────

class MasteryOut(BaseModel):
    subject: str
    test: str
    attempts: int
    correct: int
    rate: float                        # 0.0 – 1.0

    model_config = ConfigDict(from_attributes=True)


# ─── QBank Exam Sessions ──────────────────────────────────────────────────────

class QBankExamCreate(BaseModel):
    test_type: str = Field(..., pattern="^(temel|klinik)$")


class QBankExamOut(BaseModel):
    id: int
    test_type: str
    question_ids: List[str]            # UUID strings
    answers: Optional[Dict[str, str]] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score_pct: Optional[float] = None
    by_subject: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class QBankExamSubmitIn(BaseModel):
    answers: Dict[str, str]            # {question_id_str: selected_key}


class QBankExamResult(BaseModel):
    id: int
    score_pct: float
    correct: int
    total: int
    by_subject: Dict[str, Any]         # {subject: {"correct": n, "total": n}}


# ─── Subjects List ────────────────────────────────────────────────────────────

class SubjectListOut(BaseModel):
    subject: str
    subtopics: List[str]


# ─── Drill Queue ──────────────────────────────────────────────────────────────

class DrillQueueOut(BaseModel):
    questions: List[QuestionOut]
    subject: str
    subtopic: Optional[str] = None


# ─── Subtopic Mastery ─────────────────────────────────────────────────────────

class SubtopicMasteryOut(BaseModel):
    subtopic: str
    attempts: int
    correct: int
    rate: float
