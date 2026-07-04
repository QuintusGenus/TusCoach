"""
Mock exam schemas
"""
import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class MockExamBreakdownCreate(BaseModel):
    subject: str = Field(..., description="TUS subject name")
    correct: int = Field(default=0, ge=0)
    wrong: int = Field(default=0, ge=0)
    blank: int = Field(default=0, ge=0)


class MockExamCreate(BaseModel):
    exam_name: str = Field(..., min_length=1, max_length=200)
    date: datetime.date
    notes: Optional[str] = None
    breakdowns: List[MockExamBreakdownCreate] = Field(default_factory=list)


class MockExamBreakdownOut(BaseModel):
    id: int
    subject: Optional[str] = None
    correct: int
    wrong: int
    blank: int
    net: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class MockExamOut(BaseModel):
    id: int
    exam_name: Optional[str] = None
    date: datetime.date
    total_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: str
    breakdowns: List[MockExamBreakdownOut] = []

    model_config = ConfigDict(from_attributes=True)
