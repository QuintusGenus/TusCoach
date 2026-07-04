"""
Chat schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ChatSendRequest(BaseModel):
    text: str


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    meta: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class ToolEvent(BaseModel):
    name: str
    result: dict


class ChatSendResponse(BaseModel):
    thread_id: int
    assistant_message: ChatMessageOut
    tool_events: Optional[list[ToolEvent]] = None


class ChatHistoryResponse(BaseModel):
    thread_id: int
    messages: list[ChatMessageOut]
