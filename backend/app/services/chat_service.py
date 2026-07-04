"""
Chat orchestrator service.

Handles thread management, system prompt building, LLM calls with
tool-calling, and message persistence.

Guardrails:
- Input truncation (CHAT_MAX_INPUT_CHARS)
- History limited to CHAT_HISTORY_LIMIT messages for LLM context
- Safety instructions in system prompt
- Token usage logged in chat_messages.meta
"""
import json
import logging
from datetime import date, datetime, timezone
from typing import Generator, Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.chat import ChatThread, ChatMessage
from app.models.user import User, StudentProfile
from app.services.chat_tools import TOOL_SPECS, TOOL_EXECUTORS

logger = logging.getLogger(__name__)

STUB_REPLY = (
    "Ben TUS Koç çalışma asistanınızım! İlerlemenizi takip etmenize, "
    "çalışma planınızı gözden geçirmenize ve motivasyonunuzu yüksek tutmanıza yardımcı olabilirim. "
    "Yapay zeka entegrasyonu henüz yapılandırılmadı — tam sohbeti etkinleştirmek için LLM_API_KEY ayarlanmalıdır."
)

SAFETY_BLOCK = (
    "\n\nÖNEMLİ KURALLAR:\n"
    "- Sadece bir çalışma koçusun. Öğrencilerin etkili öğrenmesine yardımcı ol.\n"
    "- Asla gerçek sınav cevapları, sızdırılmış sorular veya kopya yolları verme.\n"
    "- Sınav cevapları veya hile stratejileri istenirse, kibarca reddet ve "
    "meşru çalışma tekniklerine yönlendir.\n"
    "- Dürüst hazırlığı teşvik et: aralıklı tekrar, pratik sorular, "
    "ezberleme yerine kavramları anlama.\n"
    "- Konudan sapma: TUS sınavına hazırlık, çalışma planlaması, motivasyon "
    "ve öğrenme stratejileri."
)


def _truncate_input(text: str) -> str:
    """Truncate user input to configured max length."""
    settings = get_settings()
    limit = settings.CHAT_MAX_INPUT_CHARS
    if len(text) > limit:
        return text[:limit] + "..."
    return text


def get_or_create_thread(db: Session, user_id: int, student_id: int) -> ChatThread:
    """Find existing thread or create a new one."""
    thread = (
        db.query(ChatThread)
        .filter_by(user_id=user_id, student_id=student_id)
        .first()
    )
    if thread:
        return thread

    thread = ChatThread(user_id=user_id, student_id=student_id)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def build_system_prompt(db: Session, user_id: int) -> str:
    """Build the TusCoach personality system prompt with safety guardrails."""
    from app.models.study import StudyPlan

    user = db.query(User).filter(User.id == user_id).first()
    profile = db.query(StudentProfile).filter_by(user_id=user_id).first()

    email = user.email if user else "Student"

    # Exam date context
    exam_date_str = ""
    prefs_str = ""
    if profile and profile.preferences_rel:
        prefs = profile.preferences_rel
        if prefs.exam_date:
            days_left = (prefs.exam_date - date.today()).days
            exam_date_str = (
                f"\nÖğrencinin sınav tarihi: {prefs.exam_date} "
                f"({days_left} gün kaldı)."
            )
        if prefs.daily_target_minutes_weekday or prefs.daily_target_minutes_weekend:
            prefs_str = (
                f"\nGünlük hedefler: hafta içi {prefs.daily_target_minutes_weekday or '-'} dk, "
                f"hafta sonu {prefs.daily_target_minutes_weekend or '-'} dk."
            )

    # Active plan context
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.student_id == user_id, StudyPlan.status == "active")
        .first()
    )
    plan_str = ""
    if plan:
        total_tasks = len(plan.tasks) if plan.tasks else 0
        completed = sum(1 for t in plan.tasks if t.status == "done") if plan.tasks else 0
        plan_str = (
            f"\nÖğrencinin aktif çalışma planı var: "
            f"{plan.start_date} - {plan.end_date}, "
            f"toplam {total_tasks} görev, {completed} tamamlandı."
        )
    else:
        plan_str = "\nÖğrencinin henüz bir çalışma planı yok."

    return (
        "Sen TUS Koç'sun — TUS (Tıpta Uzmanlık Sınavı) sınavına hazırlanan tıp öğrencileri için "
        "samimi ve motive edici bir çalışma koçusun. "
        "Sıcak ve cesaretlendirici bir tonda konuş. Cevapları kısa ve öz tut. "
        "Her zaman Türkçe yanıt ver.\n"
        f"Bugün {date.today()}.{exam_date_str}{prefs_str}{plan_str}\n"
        f"Öğrenci e-posta: {email}\n\n"
        "Öğrencinin çalışma istatistiklerini, günlük planını ve günlük ilerlemesini "
        "sorgulamak için araçlara erişimin var. Öğrenci performansı veya programı hakkında "
        "sorduğunda bunları kullan. "
        "Öğrenci çalıştığını söylediğinde çalışma oturumlarını da kaydedebilirsin.\n"
        "Öğrencinin çalışma planı oluşturmasına da yardımcı olabilirsin. "
        "Öğrenci plan istediğinde veya mevcut planını yenilemek istediğinde "
        "generate_study_plan aracını kullan. Plan, tüm 11 TUS dersini kapsayacak "
        "şekilde, öğrencinin tercihlerine ve performansına göre kişiselleştirilir."
        + SAFETY_BLOCK
    )


def _get_llm_client():
    """Get configured LLM client (OpenAI SDK with Gemini-compatible endpoint)."""
    from openai import OpenAI

    settings = get_settings()
    return OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)


def _call_llm(messages: list[dict], use_tools: bool = True):
    """Call LLM chat completions API. Returns the full response object."""
    client = _get_llm_client()
    settings = get_settings()

    kwargs: dict = {
        "model": settings.LLM_MODEL,
        "messages": messages,
    }
    if use_tools:
        kwargs["tools"] = TOOL_SPECS

    response = client.chat.completions.create(**kwargs)
    return response


def _extract_usage(response) -> dict | None:
    """Extract token usage from OpenAI response if available."""
    usage = getattr(response, "usage", None)
    if usage is None:
        return None
    return {
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
        "total_tokens": usage.total_tokens,
    }


def _call_llm_stream(messages: list[dict]):
    """Call LLM with stream=True. Returns an iterable of deltas."""
    client = _get_llm_client()
    settings = get_settings()

    return client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
        stream=True,
    )


def _execute_tool_calls(db: Session, user_id: int, tool_calls) -> list[dict]:
    """Execute tool calls and return results list."""
    tool_results = []
    for tc in tool_calls:
        fn_name = tc.function.name
        fn_args = json.loads(tc.function.arguments)
        executor = TOOL_EXECUTORS.get(fn_name)
        if executor:
            result = executor(db, user_id, fn_args)
        else:
            result = {"error": f"Unknown tool: {fn_name}"}
        tool_results.append(
            {"tool_call_id": tc.id, "name": fn_name, "result": result}
        )
    return tool_results


def send_message(
    db: Session, user_id: int, student_id: int, user_text: str
) -> tuple[int, ChatMessage, list[dict] | None]:
    """
    Main orchestrator flow.
    Returns (thread_id, assistant_message, tool_events_or_none).
    """
    settings = get_settings()
    user_text = _truncate_input(user_text)
    thread = get_or_create_thread(db, user_id, student_id)

    # Save user message
    user_msg = ChatMessage(
        thread_id=thread.id, role="user", content=user_text
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Stub mode
    api_key = get_settings().LLM_API_KEY
    if not api_key or api_key == "your-api-key-here":
        assistant_msg = ChatMessage(
            thread_id=thread.id,
            role="assistant",
            content=STUB_REPLY,
            meta={"stub": True},
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        return thread.id, assistant_msg, None

    # Build LLM messages
    system_prompt = build_system_prompt(db, user_id)
    history = _load_history(db, thread.id, limit=settings.CHAT_HISTORY_LIMIT)

    llm_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        # Skip empty assistant messages (leftover from tool-call-only responses)
        if msg.role == "assistant" and not msg.content:
            continue
        llm_messages.append({"role": msg.role, "content": msg.content})

    # First LLM call (with tools)
    total_usage: dict | None = None
    try:
        response = _call_llm(llm_messages, use_tools=True)
        if not response.choices:
            raise ValueError("LLM returned empty choices")
        response_msg = response.choices[0].message
        total_usage = _extract_usage(response)
    except Exception as e:
        logger.error("LLM call failed: %s", e)
        assistant_msg = ChatMessage(
            thread_id=thread.id,
            role="assistant",
            content="Şu anda bağlantı sorunu yaşıyorum. Lütfen tekrar deneyin.",
            meta={"error": str(e)},
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        return thread.id, assistant_msg, None

    # Handle tool calls (single round-trip)
    tool_events = None
    if response_msg.tool_calls:
        tool_results = _execute_tool_calls(db, user_id, response_msg.tool_calls)
        tool_events = [
            {"name": tr["name"], "result": tr["result"]} for tr in tool_results
        ]

        # Append to context for second call
        # Build assistant message manually — Gemini rejects null content
        assistant_dict = {
            "role": "assistant",
            "content": response_msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in response_msg.tool_calls
            ],
        }
        llm_messages.append(assistant_dict)
        for tr in tool_results:
            llm_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tr["tool_call_id"],
                    "content": json.dumps(tr["result"]),
                }
            )

        try:
            response2 = _call_llm(llm_messages, use_tools=False)
            response_msg = response2.choices[0].message
            usage2 = _extract_usage(response2)
            # Sum usage across both calls
            if total_usage and usage2:
                total_usage = {
                    k: total_usage[k] + usage2[k] for k in total_usage
                }
            elif usage2:
                total_usage = usage2
        except Exception as e:
            logger.error("LLM follow-up call failed: %s", e)
            response_msg = type(
                "Msg", (), {"content": "Verileri aldım ancak yanıtı biçimlendirirken sorun oluştu."}
            )()

    # Save assistant reply
    content = response_msg.content or ""
    meta: dict = {}
    if tool_events:
        meta["tool_calls"] = tool_events
    if total_usage:
        meta["usage"] = total_usage

    assistant_msg = ChatMessage(
        thread_id=thread.id,
        role="assistant",
        content=content,
        meta=meta or None,
    )
    db.add(assistant_msg)
    thread.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant_msg)

    return thread.id, assistant_msg, tool_events


def send_message_stream(
    db: Session, user_id: int, student_id: int, user_text: str
) -> Generator[str, None, None]:
    """
    SSE generator: yields JSON lines for each token chunk.

    Flow:
    1. Persist user message (truncated)
    2. First LLM call (non-streaming, with tools)
    3. If tool calls → execute → emit tool_event SSE lines
    4. Second LLM call (streaming, no tools) → emit token deltas
    5. Persist full assistant reply with usage stats, emit [DONE]
    """
    settings = get_settings()
    user_text = _truncate_input(user_text)
    thread = get_or_create_thread(db, user_id, student_id)

    user_msg = ChatMessage(thread_id=thread.id, role="user", content=user_text)
    db.add(user_msg)
    db.commit()

    api_key = get_settings().LLM_API_KEY
    if not api_key or api_key == "your-api-key-here":
        yield json.dumps({"type": "token", "content": STUB_REPLY})
        assistant_msg = ChatMessage(
            thread_id=thread.id, role="assistant",
            content=STUB_REPLY, meta={"stub": True},
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        yield json.dumps({
            "type": "done",
            "thread_id": thread.id,
            "message_id": assistant_msg.id,
        })
        return

    system_prompt = build_system_prompt(db, user_id)
    history = _load_history(db, thread.id, limit=settings.CHAT_HISTORY_LIMIT)

    llm_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        # Skip empty assistant messages (leftover from tool-call-only responses)
        if msg.role == "assistant" and not msg.content:
            continue
        llm_messages.append({"role": msg.role, "content": msg.content})

    # First call: non-streaming with tools
    total_usage: dict | None = None
    try:
        response = _call_llm(llm_messages, use_tools=True)
        if not response.choices:
            raise ValueError("LLM returned empty choices")
        response_msg = response.choices[0].message
        total_usage = _extract_usage(response)
    except Exception as e:
        logger.error("LLM call failed (stream): %s", e)
        fallback = "Şu anda bağlantı sorunu yaşıyorum. Lütfen tekrar deneyin."
        yield json.dumps({"type": "token", "content": fallback})
        assistant_msg = ChatMessage(
            thread_id=thread.id, role="assistant",
            content=fallback, meta={"error": str(e)},
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        yield json.dumps({
            "type": "done", "thread_id": thread.id,
            "message_id": assistant_msg.id,
        })
        return

    tool_events = None
    if response_msg.tool_calls:
        tool_results = _execute_tool_calls(db, user_id, response_msg.tool_calls)
        tool_events = [
            {"name": tr["name"], "result": tr["result"]} for tr in tool_results
        ]

        for te in tool_events:
            yield json.dumps({"type": "tool_event", **te})

        # Build assistant message manually — Gemini rejects null content
        assistant_dict = {
            "role": "assistant",
            "content": response_msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in response_msg.tool_calls
            ],
        }
        llm_messages.append(assistant_dict)
        for tr in tool_results:
            llm_messages.append({
                "role": "tool",
                "tool_call_id": tr["tool_call_id"],
                "content": json.dumps(tr["result"]),
            })

    # Second call (or only call if no tools): streaming
    full_content = ""
    stream_usage: dict | None = None
    try:
        stream = _call_llm_stream(llm_messages)
        for chunk in stream:
            # Capture usage from final chunk (stream_options=include_usage)
            if hasattr(chunk, "usage") and chunk.usage:
                stream_usage = {
                    "prompt_tokens": chunk.usage.prompt_tokens,
                    "completion_tokens": chunk.usage.completion_tokens,
                    "total_tokens": chunk.usage.total_tokens,
                }
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta.content:
                    full_content += delta.content
                    yield json.dumps({"type": "token", "content": delta.content})
    except Exception as e:
        logger.error("LLM stream failed: %s", e)
        if not full_content:
            full_content = "Verileri aldım ancak yanıtı biçimlendirirken sorun oluştu."
            yield json.dumps({"type": "token", "content": full_content})

    # Sum usage
    if total_usage and stream_usage:
        total_usage = {k: total_usage[k] + stream_usage[k] for k in total_usage}
    elif stream_usage:
        total_usage = stream_usage

    # Persist
    meta: dict = {}
    if tool_events:
        meta["tool_calls"] = tool_events
    if total_usage:
        meta["usage"] = total_usage

    assistant_msg = ChatMessage(
        thread_id=thread.id, role="assistant",
        content=full_content, meta=meta or None,
    )
    db.add(assistant_msg)
    thread.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant_msg)

    yield json.dumps({
        "type": "done",
        "thread_id": thread.id,
        "message_id": assistant_msg.id,
    })


def get_history(
    db: Session, user_id: int, student_id: int, limit: int = 50
) -> tuple[Optional[int], list[ChatMessage]]:
    """Load thread messages for display. Newest-last ordering."""
    thread = (
        db.query(ChatThread)
        .filter_by(user_id=user_id, student_id=student_id)
        .first()
    )
    if not thread:
        return None, []

    messages = (
        db.query(ChatMessage)
        .filter_by(thread_id=thread.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return thread.id, messages


def _load_history(db: Session, thread_id: int, limit: int = 20) -> list[ChatMessage]:
    """Load most recent messages for LLM context, in chronological order."""
    # Subquery: get the N most recent, then re-order ascending
    recent = (
        db.query(ChatMessage)
        .filter_by(thread_id=thread_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(recent))
