from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base

class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("student_profiles.id"), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    workflow_run_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("workflow_runs.id"), nullable=True, index=True)
    
    subject: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint('user_id', 'workflow_run_id', name='uq_user_workflow_run'),
    )

    # Relationships
    user = relationship("User")
    # student = relationship("StudentProfile") 
    # workflow_run = relationship("WorkflowRun")
