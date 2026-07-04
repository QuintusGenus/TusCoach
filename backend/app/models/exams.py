"""
Exam models
"""
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import Integer, String, Text, Date, DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class MockExam(Base):
    __tablename__ = "mock_exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    exam_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    total_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    breakdowns: Mapped[List["MockExamBreakdown"]] = relationship(
        "MockExamBreakdown", back_populates="exam", cascade="all, delete-orphan"
    )


class MockExamBreakdown(Base):
    __tablename__ = "mock_exam_breakdowns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("mock_exams.id"), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    topic_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    wrong: Mapped[int] = mapped_column(Integer, default=0)
    blank: Mapped[int] = mapped_column(Integer, default=0)
    avg_time_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    exam: Mapped["MockExam"] = relationship("MockExam", back_populates="breakdowns")
