"""
Calendar aggregation API - unified view of study sessions, exams, and plan tasks
"""
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import StudySession, MockExam, PlanTask, StudyPlan, Topic, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/students/me/calendar", tags=["calendar"])


class CalendarEventOut(BaseModel):
    type: str  # "session" | "exam" | "task"
    date: datetime.date
    title: str
    subject: Optional[str] = None
    minutes: Optional[int] = None
    score: Optional[float] = None
    status: Optional[str] = None


@router.get("", response_model=List[CalendarEventOut])
def get_calendar_events(
    start: datetime.date = Query(...),
    end: datetime.date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all events (sessions, exams, tasks) in a date range."""
    events: List[CalendarEventOut] = []

    # Study sessions
    sessions = (
        db.query(StudySession)
        .filter(
            StudySession.student_id == current_user.id,
            StudySession.date >= start,
            StudySession.date <= end,
        )
        .all()
    )
    for s in sessions:
        events.append(CalendarEventOut(
            type="session",
            date=s.date,
            title=f"Study: {s.subject}" if s.subject else "Study Session",
            subject=s.subject,
            minutes=s.minutes,
        ))

    # Mock exams
    exams = (
        db.query(MockExam)
        .filter(
            MockExam.student_id == current_user.id,
            MockExam.date >= start,
            MockExam.date <= end,
        )
        .all()
    )
    for e in exams:
        events.append(CalendarEventOut(
            type="exam",
            date=e.date,
            title=e.exam_name or "Mock Exam",
            score=e.total_score,
        ))

    # Plan tasks (need to join through StudyPlan to filter by student)
    tasks = (
        db.query(PlanTask)
        .join(StudyPlan, PlanTask.plan_id == StudyPlan.id)
        .filter(
            StudyPlan.student_id == current_user.id,
            PlanTask.date >= start,
            PlanTask.date <= end,
        )
        .all()
    )
    for t in tasks:
        # Try to get topic name for title
        topic_name = None
        if t.topic_id:
            topic = db.query(Topic).filter(Topic.id == t.topic_id).first()
            if topic:
                topic_name = topic.name
        title = f"{t.task_type.title()}: {topic_name}" if topic_name else t.task_type.title()
        subject = None
        if t.topic_id:
            topic = db.query(Topic).filter(Topic.id == t.topic_id).first()
            if topic:
                subject = topic.subject
        events.append(CalendarEventOut(
            type="task",
            date=t.date,
            title=title,
            subject=subject,
            minutes=t.target_minutes,
            status=t.status,
        ))

    events.sort(key=lambda e: e.date)
    return events
