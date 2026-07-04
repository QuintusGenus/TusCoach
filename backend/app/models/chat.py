"""
Persistent chat storage models.

ChatThread: one active thread per (user_id, student_id) for MVP.
ChatMessage: individual messages within a thread.
"""
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("user_id", "student_id", name="uq_chat_thread_user_student"),
    )

    # Relationships
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="thread", cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )
    user = relationship("User")
    student = relationship("StudentProfile")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    thread_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # "user" | "assistant" | "system"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    thread: Mapped["ChatThread"] = relationship("ChatThread", back_populates="messages")
