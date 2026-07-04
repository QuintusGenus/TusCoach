"""
Events service for logging application events
"""
import json
from typing import Optional
from sqlalchemy.orm import Session
from app.models import EventLog


class EventValidationError(Exception):
    """Raised when event validation fails"""
    pass


def emit_event(
    db: Session,
    student_id: Optional[int],
    event_type: str,
    payload: dict
) -> EventLog:
    """
    Create an event log entry.
    
    Args:
        db: Database session
        student_id: ID of the student (nullable for system events)
        event_type: Type of event (e.g., "study_session_created")
        payload: Event data as a dictionary
        
    Returns:
        Created EventLog instance
        
    Raises:
        EventValidationError: If validation fails
    """
    # Validate event_type
    if not event_type or not event_type.strip():
        raise EventValidationError("event_type cannot be empty")
    
    # Validate payload is JSON-serializable
    try:
        json.dumps(payload)
    except (TypeError, ValueError) as e:
        raise EventValidationError(f"payload must be JSON-serializable: {e}")
    
    # Create event log
    event = EventLog(
        student_id=student_id,
        event_type=event_type.strip(),
        payload=payload
    )
    
    db.add(event)
    db.commit()
    db.refresh(event)
    
    return event
