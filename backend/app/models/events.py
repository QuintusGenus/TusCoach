"""
Event models
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class EventLog(Base):
    """Stores application events for auditing and analytics"""

    __tablename__ = "event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )
