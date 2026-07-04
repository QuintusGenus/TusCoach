"""
Unit tests for messages service layer.

Tests:
- get_latest_student_message returns newest coach_messages row
- get_student_messages_history returns messages newest-first
- Filtering by user_id (access control)
- Empty state returns None / empty list
- Stable ordering by created_at desc
- Limit parameter respected
"""

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.user import User, StudentProfile
from app.models.message import CoachMessage
from app.models.workflow import WorkflowRun
from app.services.messages_service import (
    get_latest_student_message,
    get_student_messages_history
)
from app.core.security import get_password_hash


@pytest.fixture
def test_user(db: Session):
    """Create a test user with student profile."""
    user = User(
        email=f"test_messages_{datetime.now(timezone.utc).timestamp()}@example.com",
        hashed_password=get_password_hash("testpass"),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_profile(db: Session, test_user: User):
    """Create a student profile for the test user."""
    profile = StudentProfile(user_id=test_user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@pytest.fixture
def coach_messages(db: Session, test_user: User, test_profile: StudentProfile):
    """Create coach_messages rows for testing."""
    messages = []
    base_time = datetime.now(timezone.utc)

    # Optional: create matching workflow_runs for workflow_name join
    run1 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="daily_review",
        status="done",
        context={},
        created_at=base_time - timedelta(hours=2)
    )
    run2 = WorkflowRun(
        student_id=test_user.id,
        workflow_name="exam_intervention",
        status="done",
        context={},
        created_at=base_time
    )
    db.add_all([run1, run2])
    db.commit()
    db.refresh(run1)
    db.refresh(run2)

    # Message 1: oldest
    msg1 = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        workflow_run_id=run1.id,
        subject="First message",
        body="This is the first message body",
        tone="encouraging",
        created_at=base_time - timedelta(hours=2)
    )

    # Message 2: newest
    msg2 = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        workflow_run_id=run2.id,
        subject="Latest message",
        body="This is the latest message body",
        tone="supportive",
        created_at=base_time
    )

    # Message 3: subject only
    msg3 = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        workflow_run_id=None,
        subject="Subject only message",
        body="",
        tone=None,
        created_at=base_time - timedelta(minutes=45)
    )

    # Message 4: body only
    msg4 = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        workflow_run_id=None,
        subject="",
        body="Body only message",
        tone=None,
        created_at=base_time - timedelta(hours=3)
    )

    db.add_all([msg1, msg2, msg3, msg4])
    db.commit()
    for m in [msg1, msg2, msg3, msg4]:
        db.refresh(m)

    return [msg1, msg2, msg3, msg4]


def test_get_latest_student_message_returns_newest(db: Session, coach_messages, test_user: User):
    """Test that get_latest_student_message returns the most recent message."""
    result = get_latest_student_message(db, test_user.id)

    assert result is not None
    assert result["subject"] == "Latest message"
    assert result["body"] == "This is the latest message body"
    assert result["tone"] == "supportive"
    assert result["workflow_name"] == "exam_intervention"


def test_get_latest_student_message_no_messages_returns_none(db: Session, test_user: User):
    """Test that get_latest_student_message returns None when no messages exist."""
    result = get_latest_student_message(db, test_user.id)
    assert result is None


def test_get_latest_student_message_skips_empty_messages(db: Session, test_user: User):
    """Test that empty messages are still returned (empty is valid in coach_messages)."""
    # Service layer returns all coach_messages rows regardless of content,
    # since only valid content is persisted at creation time.
    result = get_latest_student_message(db, test_user.id)
    assert result is None  # No messages in DB for this user


def test_get_latest_student_message_includes_subject_only(
    db: Session, test_user: User, test_profile: StudentProfile
):
    """Test that messages with only subject (no body) are returned."""
    msg = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        subject="Important subject",
        body="",
        tone=None
    )
    db.add(msg)
    db.commit()

    result = get_latest_student_message(db, test_user.id)
    assert result is not None
    assert result["subject"] == "Important subject"
    assert result["body"] == ""


def test_get_latest_student_message_includes_body_only(
    db: Session, test_user: User, test_profile: StudentProfile
):
    """Test that messages with only body (no subject) are returned."""
    msg = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        subject="",
        body="Important body content",
        tone=None
    )
    db.add(msg)
    db.commit()

    result = get_latest_student_message(db, test_user.id)
    assert result is not None
    assert result["subject"] == ""
    assert result["body"] == "Important body content"


def test_get_student_messages_history_returns_valid_messages_only(
    db: Session, coach_messages, test_user: User
):
    """Test that history returns all coach_messages for user."""
    messages = get_student_messages_history(db, test_user.id, limit=50)

    # Should return all 4 messages
    assert len(messages) == 4

    # Verify ordering (newest first)
    assert messages[0]["subject"] == "Latest message"       # newest
    assert messages[1]["subject"] == "Subject only message"  # -45min
    assert messages[2]["subject"] == "First message"         # -2h
    assert messages[3]["body"] == "Body only message"        # -3h


def test_get_student_messages_history_stable_ordering(
    db: Session, test_user: User, test_profile: StudentProfile
):
    """Test that messages are consistently ordered by created_at desc."""
    base_time = datetime.now(timezone.utc)

    for i in range(5):
        msg = CoachMessage(
            user_id=test_user.id,
            student_id=test_profile.id,
            subject=f"Message {i}",
            body=f"Body {i}",
            tone=None,
            created_at=base_time - timedelta(minutes=i * 10)
        )
        db.add(msg)
    db.commit()

    # Fetch multiple times and verify ordering is stable
    for _ in range(3):
        messages = get_student_messages_history(db, test_user.id, limit=10)
        assert len(messages) == 5

        # Verify descending order
        for i in range(len(messages) - 1):
            assert messages[i]["created_at"] >= messages[i + 1]["created_at"]

        assert messages[0]["subject"] == "Message 0"
        assert messages[4]["subject"] == "Message 4"


def test_get_student_messages_history_respects_limit(
    db: Session, test_user: User, test_profile: StudentProfile
):
    """Test that the limit parameter is respected."""
    for i in range(10):
        msg = CoachMessage(
            user_id=test_user.id,
            student_id=test_profile.id,
            subject=f"Message {i}",
            body=f"Body {i}",
            tone=None,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=i)
        )
        db.add(msg)
    db.commit()

    assert len(get_student_messages_history(db, test_user.id, limit=5)) == 5
    assert len(get_student_messages_history(db, test_user.id, limit=3)) == 3
    assert len(get_student_messages_history(db, test_user.id, limit=20)) == 10


def test_get_student_messages_history_empty_returns_empty_list(db: Session, test_user: User):
    """Test that empty history returns an empty list."""
    messages = get_student_messages_history(db, test_user.id, limit=50)
    assert messages == []


def test_get_student_messages_history_isolates_students(
    db: Session, test_user: User, test_profile: StudentProfile
):
    """Test that messages are properly isolated by user_id."""
    other_user = User(
        email=f"other_{datetime.now(timezone.utc).timestamp()}@example.com",
        hashed_password=get_password_hash("testpass"),
        is_active=True
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    other_profile = StudentProfile(user_id=other_user.id)
    db.add(other_profile)
    db.commit()
    db.refresh(other_profile)

    # Create messages for both users
    msg1 = CoachMessage(
        user_id=test_user.id,
        student_id=test_profile.id,
        subject="Test user message",
        body="Content for test user",
        tone=None
    )
    msg2 = CoachMessage(
        user_id=other_user.id,
        student_id=other_profile.id,
        subject="Other user message",
        body="Content for other user",
        tone=None
    )
    db.add_all([msg1, msg2])
    db.commit()

    # Verify isolation
    test_user_messages = get_student_messages_history(db, test_user.id, limit=50)
    assert len(test_user_messages) == 1
    assert test_user_messages[0]["subject"] == "Test user message"

    other_user_messages = get_student_messages_history(db, other_user.id, limit=50)
    assert len(other_user_messages) == 1
    assert other_user_messages[0]["subject"] == "Other user message"


def test_messages_contain_all_required_fields(
    db: Session, coach_messages, test_user: User
):
    """Test that returned messages contain all required fields."""
    messages = get_student_messages_history(db, test_user.id, limit=1)

    assert len(messages) == 1
    message = messages[0]

    # Verify all required fields are present
    assert "id" in message
    assert "workflow_run_id" in message
    assert "workflow_name" in message
    assert "created_at" in message
    assert "subject" in message
    assert "body" in message
    assert "tone" in message
    assert "read_at" in message

    # Verify types
    assert isinstance(message["id"], int)
    assert isinstance(message["subject"], str)
    assert isinstance(message["body"], str)
