"""
Chat API endpoints.

POST /v1/students/me/chat/send          — send message, get full reply
POST /v1/students/me/chat/send/stream   — send message, stream reply via SSE
GET  /v1/students/me/chat/history       — retrieve conversation history

Rate limited: 30 req / 10 min per user (configurable via CHAT_RATE_*)
Daily limit:  20 messages per calendar day per user (configurable via CHAT_DAILY_LIMIT)
"""
import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.rate_limit import UserRateLimiter, _get_redis
from app.models.user import User, StudentProfile
from app.schemas.chat import (
    ChatSendRequest,
    ChatSendResponse,
    ChatMessageOut,
    ChatHistoryResponse,
    ToolEvent,
)
from app.services import chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/students/me/chat")

_settings = get_settings()
_chat_limiter = UserRateLimiter(
    max_calls=_settings.CHAT_RATE_LIMIT,
    window_seconds=_settings.CHAT_RATE_WINDOW,
)

# In-memory fallback for daily limit when Redis is unavailable
_daily_counts: dict[str, int] = {}


def _check_daily_limit(user_id: int) -> None:
    """Enforce a per-user per-calendar-day AI message limit."""
    today = date.today().isoformat()
    key = f"chat_daily:{user_id}:{today}"
    limit = _settings.CHAT_DAILY_LIMIT

    r = _get_redis()
    if r is not None:
        try:
            count = r.incr(key)
            if count == 1:
                r.expire(key, 86400)
            if count > limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Günlük AI sohbet limitine ulaştınız. Yarın tekrar deneyin.",
                )
            return
        except HTTPException:
            raise
        except Exception:
            logger.warning("Redis daily-limit check failed, falling back to in-memory")

    # In-memory fallback (not shared across processes)
    mem_key = f"{user_id}:{today}"
    _daily_counts[mem_key] = _daily_counts.get(mem_key, 0) + 1
    if _daily_counts[mem_key] > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Günlük AI sohbet limitine ulaştınız. Yarın tekrar deneyin.",
        )


def _get_student_id(db: Session, user: User) -> int:
    """Resolve student_profiles.id from the current user."""
    profile = db.query(StudentProfile).filter_by(user_id=user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile.id


@router.post("/send", response_model=ChatSendResponse)
def send_message(
    body: ChatSendRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Send a chat message and get an AI reply."""
    request.state.user = user
    _chat_limiter(request)
    _check_daily_limit(user.id)

    student_id = _get_student_id(db, user)
    thread_id, reply, tool_events = chat_service.send_message(
        db, user.id, student_id, body.text
    )
    return ChatSendResponse(
        thread_id=thread_id,
        assistant_message=ChatMessageOut.model_validate(reply),
        tool_events=(
            [ToolEvent(**te) for te in tool_events] if tool_events else None
        ),
    )


@router.post("/send/stream")
def send_message_stream(
    body: ChatSendRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """
    Stream assistant reply via Server-Sent Events.

    Each SSE `data` line is a JSON object with a `type` field:
      - {"type": "tool_event", "name": "...", "result": {...}}
      - {"type": "token", "content": "..."}
      - {"type": "done", "thread_id": N, "message_id": N}
    """
    request.state.user = user
    _chat_limiter(request)
    _check_daily_limit(user.id)

    student_id = _get_student_id(db, user)
    generator = chat_service.send_message_stream(
        db, user.id, student_id, body.text
    )
    return EventSourceResponse(generator)


@router.get("/history", response_model=ChatHistoryResponse)
def get_history(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=200),
):
    """Get chat history for the current user. Newest-last."""
    student_id = _get_student_id(db, user)
    thread_id, messages = chat_service.get_history(db, user.id, student_id, limit)
    if thread_id is None:
        return ChatHistoryResponse(thread_id=0, messages=[])
    return ChatHistoryResponse(
        thread_id=thread_id,
        messages=[ChatMessageOut.model_validate(m) for m in messages],
    )
