from pydantic import BaseModel
from typing import List, Optional

class StudentMessageOut(BaseModel):
    subject: str
    body: str
    tone: str # warm, urgent, neutral

class CoachReportOut(BaseModel):
    summary: str
    risk_level: str # low, medium, high
    action_items: List[str]
