"""
Study domains models: Topic, Plan, Task, Session
"""
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import Integer, String, Date, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("topics.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False) # FK to users.id logic handled in service for loose coupling or add ForeignKey("users.id")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String, default="active")
    tur_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    custom_block_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tasks: Mapped[List["PlanTask"]] = relationship("PlanTask", back_populates="plan")

class PlanTask(Base):
    __tablename__ = "plan_tasks"
    __table_args__ = (
        UniqueConstraint('plan_id', 'date', 'topic_id', 'task_type', name='uq_plan_task'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("study_plans.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    task_type: Mapped[str] = mapped_column(String, nullable=False) # review, question, etc
    target_minutes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="pending")
    phase: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "reading" or "question"
    subject_block_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-11 position in tur
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plan: Mapped["StudyPlan"] = relationship("StudyPlan", back_populates="tasks")

class StudySession(Base):
    """Tracks student study sessions"""
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    topic_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # ForeignKey("topics.id")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
