"""
Device schemas for API validation.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DeviceRegister(BaseModel):
    """Schema for device registration"""
    platform: str  # "ios" or "android"
    expo_push_token: str


class DevicePing(BaseModel):
    """Schema for device ping (keepalive)"""
    expo_push_token: str


class DeviceOut(BaseModel):
    """Schema for device response"""
    id: int
    user_id: int
    platform: str
    expo_push_token: str
    created_at: datetime
    last_seen_at: Optional[datetime]

    class Config:
        from_attributes = True
