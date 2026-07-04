"""
User models
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Integer, String, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(String, default="student") # student, coach, admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student_profile: Mapped["StudentProfile"] = relationship("StudentProfile", back_populates="user", uselist=False)
    # coach_relationships: Mapped[List["CoachStudent"]] = relationship("CoachStudent", foreign_keys="CoachStudent.coach_id")

class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    tus_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    target_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    daily_minutes: Mapped[int] = mapped_column(Integer, default=0)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)

    user: Mapped["User"] = relationship("User", back_populates="student_profile")
    preferences_rel: Mapped[Optional["StudentPreferences"]] = relationship(
        "StudentPreferences", back_populates="student_profile", uselist=False
    )

class CoachStudent(Base):
    __tablename__ = "coach_students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
