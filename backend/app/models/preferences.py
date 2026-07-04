"""
Student preferences model for personalized coaching.
"""
from datetime import datetime, date, time
from typing import Optional
from sqlalchemy import Integer, String, Date, Time, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class StudentPreferences(Base):
    __tablename__ = "student_preferences"
    __table_args__ = (
        UniqueConstraint("student_id", name="uq_student_preferences_student_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("student_profiles.id"), nullable=False
    )

    exam_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    daily_target_minutes_weekday: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    daily_target_minutes_weekend: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    preferred_study_window_start: Mapped[Optional[time]] = mapped_column(
        Time, nullable=True
    )
    preferred_study_window_end: Mapped[Optional[time]] = mapped_column(
        Time, nullable=True
    )
    quiet_hours_start: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    quiet_hours_end: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    timezone: Mapped[str] = mapped_column(
        String, nullable=False, default="Europe/Istanbul"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=datetime.utcnow
    )

    student_profile: Mapped["StudentProfile"] = relationship(
        "StudentProfile", back_populates="preferences_rel"
    )
