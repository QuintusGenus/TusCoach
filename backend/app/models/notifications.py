"""
Notification models for push notifications.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Notification(Base):
    """
    Notification outbox for reliable push notification delivery.

    Notifications are enqueued here and processed by a background task.
    """
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    workflow_run_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("workflow_runs.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,  # Ensures one notification per workflow_run
        index=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)  # "coach_message", "task_reminder", etc.
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Deep link data
    status: Mapped[str] = mapped_column(
        String,
        default="pending",
        nullable=False,
        index=True
    )  # "pending", "sent", "failed", "deferred"
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    next_attempt_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
