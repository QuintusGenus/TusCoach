"""
Device models for push notification tokens.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Device(Base):
    """
    Registered devices for push notifications.

    Each device has an Expo push token that can receive notifications.
    """
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    platform: Mapped[str] = mapped_column(String, nullable=False)  # "ios" or "android"
    expo_push_token: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
