"""
Tests for the chat orchestrator service.
"""
import json
import os
import pytest
from unittest.mock import patch, MagicMock
from datetime import date

from app.models.chat import ChatThread, ChatMessage
from app.models.user import User, StudentProfile
from app.models.study import Topic, StudySession
from app.services import chat_service
from app.services.chat_tools import TOOL_EXECUTORS


@pytest.fixture
def student_with_profile(db):
    """Create a user + student profile for chat tests."""
    from app.core.security import get_password_hash

    user = User(
        email="chat@test.com",
        hashed_password=get_password_hash("testpass"),
        role="student",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = StudentProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return user, profile


class TestGetOrCreateThread:
    def test_creates_new_thread(self, db, student_with_profile):
        user, profile = student_with_profile
        thread = chat_service.get_or_create_thread(db, user.id, profile.id)

        assert thread.id is not None
        assert thread.user_id == user.id
        assert thread.student_id == profile.id

    def test_idempotent(self, db, student_with_profile):
        user, profile = student_with_profile
        t1 = chat_service.get_or_create_thread(db, user.id, profile.id)
        t2 = chat_service.get_or_create_thread(db, user.id, profile.id)

        assert t1.id == t2.id


class TestBuildSystemPrompt:
    def test_contains_today(self, db, student_with_profile):
        user, _ = student_with_profile
        prompt = chat_service.build_system_prompt(db, user.id)

        assert "TUS Koç" in prompt
        assert str(date.today()) in prompt

    def test_contains_student_email(self, db, student_with_profile):
        user, _ = student_with_profile
        prompt = chat_service.build_system_prompt(db, user.id)

        assert user.email in prompt

    def test_contains_safety_guardrails(self, db, student_with_profile):
        """System prompt must include anti-cheating guidelines."""
        user, _ = student_with_profile
        prompt = chat_service.build_system_prompt(db, user.id)

        assert "sınav cevapları" in prompt.lower()
        assert "hile" in prompt.lower()
        assert "çalışma koçusun" in prompt


class TestSendMessageStub:
    def test_stub_mode_returns_reply(self, db, student_with_profile):
        """With no LLM key, should return a stub reply and no tool_events."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            thread_id, reply, tool_events = chat_service.send_message(
                db, user.id, profile.id, "How am I doing?"
            )

        assert thread_id is not None
        assert reply.role == "assistant"
        assert "LLM_API_KEY" in reply.content
        assert reply.meta == {"stub": True}
        assert tool_events is None

    def test_user_message_persisted(self, db, student_with_profile):
        """User message should be saved to DB."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            chat_service.send_message(db, user.id, profile.id, "Hello there")

        messages = db.query(ChatMessage).all()
        assert len(messages) == 2  # user + assistant
        assert messages[0].role == "user"
        assert messages[0].content == "Hello there"
        assert messages[1].role == "assistant"


class TestInputTruncation:
    def test_short_input_unchanged(self, db, student_with_profile):
        """Input within limit should not be truncated."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            chat_service.send_message(db, user.id, profile.id, "Short text")

        msg = db.query(ChatMessage).filter_by(role="user").first()
        assert msg.content == "Short text"

    def test_long_input_truncated(self, db, student_with_profile):
        """Input exceeding CHAT_MAX_INPUT_CHARS should be truncated."""
        user, profile = student_with_profile
        long_text = "x" * 3000

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            chat_service.send_message(db, user.id, profile.id, long_text)

        msg = db.query(ChatMessage).filter_by(role="user").first()
        # Default CHAT_MAX_INPUT_CHARS = 2000, plus "..."
        assert len(msg.content) == 2003
        assert msg.content.endswith("...")

    def test_truncation_function_directly(self):
        """Test _truncate_input directly."""
        result = chat_service._truncate_input("hello")
        assert result == "hello"

        long = "a" * 5000
        result = chat_service._truncate_input(long)
        assert len(result) == 2003
        assert result.endswith("...")


class TestMessagePersistence:
    def test_multiple_messages_ordered(self, db, student_with_profile):
        """Multiple messages should be retrievable in order."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            chat_service.send_message(db, user.id, profile.id, "First")
            chat_service.send_message(db, user.id, profile.id, "Second")

        thread_id, messages = chat_service.get_history(db, user.id, profile.id)
        assert thread_id is not None
        assert len(messages) == 4  # 2 sends × 2 messages

        user_msgs = [m for m in messages if m.role == "user"]
        assert user_msgs[0].content == "First"
        assert user_msgs[1].content == "Second"


class TestChatHistory:
    def test_empty_history(self, db, student_with_profile):
        """No thread yet → empty result."""
        user, profile = student_with_profile
        thread_id, messages = chat_service.get_history(db, user.id, profile.id)

        assert thread_id is None
        assert messages == []

    def test_history_limit(self, db, student_with_profile):
        """Limit parameter should cap returned messages."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            for i in range(5):
                chat_service.send_message(db, user.id, profile.id, f"msg {i}")

        thread_id, messages = chat_service.get_history(
            db, user.id, profile.id, limit=4
        )
        assert len(messages) == 4


class TestToolExecutors:
    def test_get_study_stats(self, db, student_with_profile):
        """get_study_stats executor should return a dict."""
        user, _ = student_with_profile
        executor = TOOL_EXECUTORS["get_study_stats"]
        result = executor(db, user.id, {})

        assert isinstance(result, dict)
        assert "today_minutes" in result
        assert "streak_days" in result

    def test_get_todays_plan(self, db, student_with_profile):
        """get_todays_plan executor should return tasks list."""
        user, _ = student_with_profile
        executor = TOOL_EXECUTORS["get_todays_plan"]
        result = executor(db, user.id, {})

        assert isinstance(result, dict)
        assert "tasks" in result
        assert "date" in result

    def test_get_daily_progress(self, db, student_with_profile):
        """get_daily_progress executor should return days list."""
        user, _ = student_with_profile
        executor = TOOL_EXECUTORS["get_daily_progress"]
        result = executor(db, user.id, {})

        assert isinstance(result, dict)
        assert "days" in result
        assert isinstance(result["days"], list)

    def test_log_study_session_missing_args(self, db, student_with_profile):
        """log_study_session should error on missing args."""
        user, _ = student_with_profile
        executor = TOOL_EXECUTORS["log_study_session"]
        result = executor(db, user.id, {})

        assert "error" in result

    def test_log_study_session_success(self, db, student_with_profile):
        """log_study_session should create a study session."""
        user, _ = student_with_profile

        topic = Topic(name="Anatomy", subject="Basic Sciences")
        db.add(topic)
        db.commit()
        db.refresh(topic)

        executor = TOOL_EXECUTORS["log_study_session"]
        result = executor(
            db, user.id, {"topic_id": topic.id, "minutes": 45}
        )

        assert result["logged"] is True
        assert result["minutes"] == 45

        session = db.query(StudySession).first()
        assert session is not None
        assert session.minutes == 45


class TestSendMessageWithLLM:
    def test_tool_call_round_trip_with_usage(self, db, student_with_profile):
        """Simulates LLM with tool call. Verifies tool_events and token usage in meta."""
        user, profile = student_with_profile

        mock_tool_call = MagicMock()
        mock_tool_call.id = "call_123"
        mock_tool_call.function.name = "get_study_stats"
        mock_tool_call.function.arguments = "{}"

        # First response: tool call
        first_msg = MagicMock()
        first_msg.content = None
        first_msg.tool_calls = [mock_tool_call]
        first_msg.model_dump.return_value = {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {"name": "get_study_stats", "arguments": "{}"},
                }
            ],
        }

        first_response = MagicMock()
        first_response.choices = [MagicMock(message=first_msg)]
        first_response.usage = MagicMock(
            prompt_tokens=100, completion_tokens=20, total_tokens=120
        )

        # Second response: synthesis
        second_msg = MagicMock()
        second_msg.content = "You've studied 0 minutes today. Let's get started!"
        second_msg.tool_calls = None

        second_response = MagicMock()
        second_response.choices = [MagicMock(message=second_msg)]
        second_response.usage = MagicMock(
            prompt_tokens=200, completion_tokens=30, total_tokens=230
        )

        call_count = 0

        def mock_call_llm(messages, use_tools=True):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return first_response
            return second_response

        with patch(
            "app.services.chat_service.get_settings"
        ) as mock_settings:
            mock_settings.return_value.LLM_API_KEY = "test-key"
            mock_settings.return_value.LLM_MODEL = "gemini-2.0-flash"
            mock_settings.return_value.LLM_BASE_URL = "https://example.com"
            mock_settings.return_value.CHAT_MAX_INPUT_CHARS = 2000
            mock_settings.return_value.CHAT_HISTORY_LIMIT = 20
            with patch(
                "app.services.chat_service._call_llm", side_effect=mock_call_llm
            ):
                thread_id, reply, tool_events = chat_service.send_message(
                    db, user.id, profile.id, "How am I doing?"
                )

        assert call_count == 2
        assert reply.role == "assistant"
        assert "studied" in reply.content

        # tool_events
        assert tool_events is not None
        assert len(tool_events) == 1
        assert tool_events[0]["name"] == "get_study_stats"

        # Token usage summed across both calls
        assert reply.meta is not None
        assert "usage" in reply.meta
        assert reply.meta["usage"]["prompt_tokens"] == 300
        assert reply.meta["usage"]["completion_tokens"] == 50
        assert reply.meta["usage"]["total_tokens"] == 350


class TestSendMessageStream:
    def test_stub_stream(self, db, student_with_profile):
        """Stub mode stream should yield token + done events."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            events = list(
                chat_service.send_message_stream(
                    db, user.id, profile.id, "Hi"
                )
            )

        assert len(events) == 2
        token_event = json.loads(events[0])
        done_event = json.loads(events[1])

        assert token_event["type"] == "token"
        assert "LLM_API_KEY" in token_event["content"]
        assert done_event["type"] == "done"
        assert "thread_id" in done_event
        assert "message_id" in done_event

    def test_stub_stream_persists(self, db, student_with_profile):
        """Stream should persist both user and assistant messages."""
        user, profile = student_with_profile

        with patch.dict(os.environ, {"LLM_API_KEY": ""}, clear=False):
            list(
                chat_service.send_message_stream(
                    db, user.id, profile.id, "Test stream"
                )
            )

        messages = db.query(ChatMessage).all()
        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[0].content == "Test stream"
        assert messages[1].role == "assistant"


class TestRateLimiter:
    def test_user_rate_limiter_allows_under_limit(self):
        """Requests under the limit should pass."""
        from app.core.rate_limit import UserRateLimiter

        limiter = UserRateLimiter(max_calls=3, window_seconds=60)

        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.user = MagicMock(id=42)
        mock_request.client = MagicMock(host="127.0.0.1")

        # Should not raise for first 3 calls
        for _ in range(3):
            limiter(mock_request)

    def test_user_rate_limiter_blocks_over_limit(self):
        """Requests over the limit should raise 429."""
        from fastapi import HTTPException
        from app.core.rate_limit import UserRateLimiter

        limiter = UserRateLimiter(max_calls=2, window_seconds=60)

        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.user = MagicMock(id=99)
        mock_request.client = MagicMock(host="127.0.0.1")

        limiter(mock_request)
        limiter(mock_request)

        with pytest.raises(HTTPException) as exc_info:
            limiter(mock_request)

        assert exc_info.value.status_code == 429
        assert "rate limit" in exc_info.value.detail.lower()

    def test_different_users_independent(self):
        """Different users should have independent limits."""
        from app.core.rate_limit import UserRateLimiter

        limiter = UserRateLimiter(max_calls=1, window_seconds=60)

        req_a = MagicMock()
        req_a.state = MagicMock()
        req_a.state.user = MagicMock(id=1)
        req_a.client = MagicMock(host="127.0.0.1")

        req_b = MagicMock()
        req_b.state = MagicMock()
        req_b.state.user = MagicMock(id=2)
        req_b.client = MagicMock(host="127.0.0.1")

        # Both should pass (different users)
        limiter(req_a)
        limiter(req_b)
