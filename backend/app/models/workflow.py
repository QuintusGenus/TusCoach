"""
Workflow models
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    workflow_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    trigger_event_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
