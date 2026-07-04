"""
Note schemas
"""
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    subject: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=300)
    content: Optional[str] = None


class NoteUpdate(BaseModel):
    subject: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    content: Optional[str] = None


class NoteOut(BaseModel):
    id: int
    subject: Optional[str] = None
    title: str
    content: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
