"""
Tests for message API endpoints.

Verifies that all mobile-facing message endpoints work correctly with auth and access control.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import get_db
from app.models import CoachMessage, User, StudentProfile
from app.core.security import create_access_token, get_password_hash


@pytest.fixture
def client(db):
    """FastAPI test client that uses the test DB session."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db, test_user):
    """Create auth headers with JWT token for test_user."""
    token = create_access_token(subject=test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_messages(db, test_user, test_student_profile):
    """Create test messages for the user with explicit timestamps for ordering."""
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)

    messages = [
        CoachMessage(
            user_id=test_user.id,
            student_id=test_student_profile.id,
            workflow_run_id=None,
            subject="Message 1",
            body="First test message",
            tone="encouraging",
            created_at=now - timedelta(hours=2),
            read_at=now - timedelta(hours=1),
        ),
        CoachMessage(
            user_id=test_user.id,
            student_id=test_student_profile.id,
            workflow_run_id=None,
            subject="Message 2",
            body="Second test message",
            tone="neutral",
            created_at=now - timedelta(hours=1),
            read_at=now - timedelta(minutes=30),
        ),
        CoachMessage(
            user_id=test_user.id,
            student_id=test_student_profile.id,
            workflow_run_id=None,
            subject="Message 3",
            body="Third test message (unread)",
            tone="supportive",
            created_at=now,
        ),
    ]

    for msg in messages:
        db.add(msg)
    db.commit()

    for msg in messages:
        db.refresh(msg)

    return messages


def test_get_latest_message(client, db, test_user, test_messages, auth_headers):
    """Test GET /v1/students/me/messages/latest"""
    response = client.get("/v1/students/me/messages/latest", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # Should return the most recent message (Message 3)
    assert data["subject"] == "Message 3"
    assert data["body"] == "Third test message (unread)"
    assert data["tone"] == "supportive"
    assert data["read_at"] is None
    assert "id" in data
    assert "created_at" in data


def test_get_latest_message_requires_auth(client, db, test_user, test_messages):
    """Test that endpoint requires authentication."""
    response = client.get("/v1/students/me/messages/latest")
    assert response.status_code == 401


def test_get_latest_message_when_no_messages(client, db, test_user, auth_headers):
    """Test GET /v1/students/me/messages/latest when user has no messages."""
    response = client.get("/v1/students/me/messages/latest", headers=auth_headers)
    assert response.status_code == 404


def test_get_messages_history(client, db, test_user, test_messages, auth_headers):
    """Test GET /v1/students/me/messages"""
    response = client.get("/v1/students/me/messages", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # Should return all messages, newest first
    assert len(data) == 3
    assert data[0]["subject"] == "Message 3"  # Most recent
    assert data[1]["subject"] == "Message 2"
    assert data[2]["subject"] == "Message 1"  # Oldest

    # Verify schema
    for msg in data:
        assert "id" in msg
        assert "subject" in msg
        assert "body" in msg
        assert "tone" in msg
        assert "created_at" in msg
        assert "read_at" in msg
        assert "workflow_run_id" in msg


def test_get_messages_history_with_limit(client, db, test_user, test_messages, auth_headers):
    """Test GET /v1/students/me/messages?limit=2"""
    response = client.get("/v1/students/me/messages?limit=2", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # Should return only 2 messages
    assert len(data) == 2
    assert data[0]["subject"] == "Message 3"
    assert data[1]["subject"] == "Message 2"


def test_get_messages_history_unread_only(client, db, test_user, test_messages, auth_headers):
    """Test GET /v1/students/me/messages?unread_only=true"""
    response = client.get("/v1/students/me/messages?unread_only=true", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # Should return only unread message (Message 3)
    assert len(data) == 1
    assert data[0]["subject"] == "Message 3"
    assert data[0]["read_at"] is None


def test_get_message_by_id(client, db, test_user, test_messages, auth_headers):
    """Test GET /v1/students/me/messages/{message_id}"""
    message_id = test_messages[0].id

    response = client.get(f"/v1/students/me/messages/{message_id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == message_id
    assert data["subject"] == "Message 1"
    assert data["body"] == "First test message"


def test_get_message_by_id_not_found(client, db, test_user, auth_headers):
    """Test GET /v1/students/me/messages/{message_id} with non-existent ID."""
    response = client.get("/v1/students/me/messages/99999", headers=auth_headers)
    assert response.status_code == 404


def test_get_message_by_id_access_control(client, db, test_user, test_messages, auth_headers):
    """Test that users cannot access other users' messages."""
    # Create another user
    other_user = User(
        email="other@example.com",
        hashed_password=get_password_hash("password"),
        is_active=True
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    # Create profile for other user
    other_profile = StudentProfile(user_id=other_user.id)
    db.add(other_profile)
    db.commit()

    # Create message for other user
    other_message = CoachMessage(
        user_id=other_user.id,
        student_id=other_profile.id,
        workflow_run_id=None,
        subject="Other user's message",
        body="This should not be accessible",
        tone="neutral"
    )
    db.add(other_message)
    db.commit()
    db.refresh(other_message)

    # Try to access other user's message with test_user's token
    response = client.get(f"/v1/students/me/messages/{other_message.id}", headers=auth_headers)

    # Should return 404 (not 403) to avoid leaking message IDs
    assert response.status_code == 404


def test_mark_message_read(client, db, test_user, test_messages, auth_headers):
    """Test POST /v1/students/me/messages/{message_id}/read"""
    # Message 3 is unread
    message_id = test_messages[2].id

    response = client.post(f"/v1/students/me/messages/{message_id}/read", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == message_id
    assert data["read_at"] is not None  # Now marked as read

    # Verify in database
    db.refresh(test_messages[2])
    assert test_messages[2].read_at is not None


def test_mark_message_read_idempotent(client, db, test_user, test_messages, auth_headers):
    """Test that marking a message as read multiple times is idempotent."""
    message_id = test_messages[2].id

    # First call
    response1 = client.post(f"/v1/students/me/messages/{message_id}/read", headers=auth_headers)
    assert response1.status_code == 200
    first_read_at = response1.json()["read_at"]

    # Second call (should not change read_at timestamp)
    response2 = client.post(f"/v1/students/me/messages/{message_id}/read", headers=auth_headers)
    assert response2.status_code == 200
    second_read_at = response2.json()["read_at"]

    # read_at should remain the same
    assert first_read_at == second_read_at


def test_mark_already_read_message_read(client, db, test_user, test_messages, auth_headers):
    """Test marking an already-read message as read again."""
    # Message 1 is already read
    message_id = test_messages[0].id
    original_read_at = test_messages[0].read_at

    response = client.post(f"/v1/students/me/messages/{message_id}/read", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # read_at should remain unchanged (compare as parsed datetimes to avoid format differences)
    from datetime import datetime
    response_read_at = datetime.fromisoformat(data["read_at"])
    assert response_read_at.replace(tzinfo=None) == original_read_at.replace(tzinfo=None)


def test_get_unread_count(client, db, test_user, test_messages, auth_headers):
    """Test GET /v1/students/me/messages/unread_count"""
    response = client.get("/v1/students/me/messages/unread_count", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # Only Message 3 is unread
    assert data["unread_count"] == 1


def test_unread_count_after_marking_read(client, db, test_user, test_messages, auth_headers):
    """Test that unread count decreases after marking a message as read."""
    # Initial count
    response1 = client.get("/v1/students/me/messages/unread_count", headers=auth_headers)
    assert response1.json()["unread_count"] == 1

    # Mark the unread message as read
    message_id = test_messages[2].id
    client.post(f"/v1/students/me/messages/{message_id}/read", headers=auth_headers)

    # Count should now be 0
    response2 = client.get("/v1/students/me/messages/unread_count", headers=auth_headers)
    assert response2.json()["unread_count"] == 0


def test_unread_count_when_no_messages(client, db, test_user, auth_headers):
    """Test unread count when user has no messages."""
    response = client.get("/v1/students/me/messages/unread_count", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["unread_count"] == 0


def test_response_schema_stability(client, db, test_user, test_messages, auth_headers):
    """Test that response schema matches expected format."""
    response = client.get("/v1/students/me/messages/latest", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    # Verify all required fields are present
    required_fields = [
        "id",
        "workflow_run_id",
        "created_at",
        "subject",
        "body",
        "tone",
        "read_at"
    ]

    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # Verify types
    assert isinstance(data["id"], int)
    assert isinstance(data["subject"], str)
    assert isinstance(data["body"], str)
    assert isinstance(data["created_at"], str)

    # workflow_run_id can be null
    assert data["workflow_run_id"] is None or isinstance(data["workflow_run_id"], int)

    # tone can be null or string
    assert data["tone"] is None or isinstance(data["tone"], str)

    # read_at can be null or string
    assert data["read_at"] is None or isinstance(data["read_at"], str)
