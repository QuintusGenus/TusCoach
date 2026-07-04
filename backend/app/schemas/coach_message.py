from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CoachMessageOut(BaseModel):
    id: int
    workflow_run_id: Optional[int] = None
    workflow_name: Optional[str] = None
    created_at: datetime
    subject: str
    body: str
    tone: Optional[str] = None
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    unread_count: int
