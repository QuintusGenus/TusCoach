"""
Notification schemas for API validation.
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class NotificationBase(BaseModel):
    """Base notification schema"""
    type: str
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification"""
    user_id: int
    workflow_run_id: Optional[int] = None


class NotificationOut(NotificationBase):
    """Schema for notification response"""
    id: int
    user_id: int
    workflow_run_id: Optional[int]
    status: str
    error: Optional[str]
    created_at: datetime
    sent_at: Optional[datetime]

    class Config:
        from_attributes = True
