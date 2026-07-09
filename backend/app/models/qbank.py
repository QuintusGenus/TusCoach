"""
QBank models: Question, QuestionAttempt, SRSState, QBankExamSession
"""
import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import Integer, String, Text, Date, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PgUUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    test: Mapped[str] = mapped_column(String(20), nullable=False, index=True)       # "temel" | "klinik"
    subject: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subtopic: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSONB, nullable=False)                    # {"A": "...", "B": "...", ...}
    correct_key: Mapped[str] = mapped_column(String(1), nullable=False)             # "A"-"E"
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_citation: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    predicted_diff: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    empirical_diff: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft|approved|retired
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QuestionAttempt(Base):
    __tablename__ = "question_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, index=True
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class SRSState(Base):
    __tablename__ = "srs_state"

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("questions.id"), primary_key=True
    )
    interval: Mapped[int] = mapped_column(Integer, default=0)          # days until next review
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)     # SM-2 ease factor
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    next_review: Mapped[date] = mapped_column(Date, nullable=False, index=True)


class QBankExamSession(Base):
    __tablename__ = "qbank_exam_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    test_type: Mapped[str] = mapped_column(String(20), nullable=False)   # "temel" | "klinik"
    question_ids: Mapped[list] = mapped_column(JSONB, nullable=False)    # [uuid_str, ...]
    answers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # {uuid_str: key}
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    score_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    by_subject: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # {subject: {correct, total}}
