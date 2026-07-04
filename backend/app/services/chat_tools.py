"""
Chat tool definitions for LLM function calling.

Each tool has:
- A spec dict (OpenAI function-calling format)
- An executor function: (db, user_id, args) -> dict
"""
import json
from datetime import date
from typing import Callable, Dict

from sqlalchemy.orm import Session

from app.services.stats_service import get_stats_summary, get_daily_stats
from app.services.plan_service import get_tasks_by_date, enrich_tasks
from app.models.study import StudySession, Topic


# ── Tool executors ──

def _get_study_stats(db: Session, user_id: int, args: dict) -> dict:
    """Return dashboard summary stats."""
    result = get_stats_summary(db, user_id)
    # Convert date objects to strings for JSON
    if result.get("last_session_date"):
        result["last_session_date"] = str(result["last_session_date"])
    return result


def _get_todays_plan(db: Session, user_id: int, args: dict) -> dict:
    """Return today's plan tasks (enriched with subject info)."""
    tasks = get_tasks_by_date(db, user_id, date.today())
    enriched = enrich_tasks(db, tasks)
    # Convert date objects to strings for JSON
    for t in enriched:
        t["date"] = str(t["date"])
    return {
        "date": str(date.today()),
        "tasks": enriched,
    }


def _get_daily_progress(db: Session, user_id: int, args: dict) -> dict:
    """Return last 7 days of daily stats."""
    days = args.get("days", 7)
    result = get_daily_stats(db, user_id, days=days)
    # Convert date objects to strings
    for entry in result:
        entry["date"] = str(entry["date"])
    return {"days": result}


def _log_study_session(db: Session, user_id: int, args: dict) -> dict:
    """Log a study session for the student."""
    topic_id = args.get("topic_id")
    minutes = args.get("minutes")
    session_date = args.get("date", str(date.today()))

    if not topic_id or not minutes:
        return {"error": "topic_id and minutes are required"}

    # Verify topic exists
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        return {"error": f"Topic {topic_id} not found"}

    session = StudySession(
        student_id=user_id,
        topic_id=topic_id,
        date=date.fromisoformat(session_date),
        minutes=minutes,
    )
    db.add(session)
    db.commit()

    return {
        "logged": True,
        "topic_id": topic_id,
        "minutes": minutes,
        "date": session_date,
    }


def _generate_study_plan_tool(db: Session, user_id: int, args: dict) -> dict:
    """Generate a new study plan via the chat interface."""
    from app.services.plan_service import generate_study_plan
    from app.core.constants import compute_tur_duration

    tur_number = args.get("tur_number", 1)
    tur_number = max(1, min(tur_number, 4))
    days = compute_tur_duration(tur_number)
    try:
        plan = generate_study_plan(db, user_id, tur_number=tur_number)
        return {
            "success": True,
            "plan_id": plan.id,
            "tur_number": tur_number,
            "start_date": str(plan.start_date),
            "end_date": str(plan.end_date),
            "total_tasks": len(plan.tasks) if plan.tasks else 0,
            "message": f"{tur_number}. tur çalışma planı ({days} gün) oluşturuldu. Plan sekmesinden görüntüleyebilirsiniz.",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Tool specs (OpenAI function-calling format) ──

TOOL_SPECS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_study_stats",
            "description": "Get the student's dashboard summary: today's minutes, weekly minutes, streak, exam countdown.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_todays_plan",
            "description": "Get the student's study plan tasks for today.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_progress",
            "description": "Get the student's daily study minutes for the last N days (default 7).",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back (default 7)",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_study_session",
            "description": "Log a study session for the student. Requires topic_id and minutes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic_id": {
                        "type": "integer",
                        "description": "The ID of the topic studied",
                    },
                    "minutes": {
                        "type": "integer",
                        "description": "Duration in minutes",
                    },
                    "date": {
                        "type": "string",
                        "description": "Date of session (YYYY-MM-DD). Defaults to today.",
                    },
                },
                "required": ["topic_id", "minutes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_study_plan",
            "description": (
                "Generate a new tur-based personalized study plan for the student. "
                "Creates a plan covering all 11 TUS subjects in focused blocks (one subject at a time) "
                "based on preferences and study history. Archives any existing active plan. "
                "Call when the student asks for a study plan or wants to regenerate."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tur_number": {
                        "type": "integer",
                        "description": "Study round number (1=Yeni Başlayan ~72 gün, 2=2.Tur ~55 gün, 3=3.Tur ~38 gün, 4=4.Tur ~25 gün)",
                    }
                },
                "required": [],
            },
        },
    },
]

# ── Executor registry ──

TOOL_EXECUTORS: Dict[str, Callable] = {
    "get_study_stats": _get_study_stats,
    "get_todays_plan": _get_todays_plan,
    "get_daily_progress": _get_daily_progress,
    "log_study_session": _log_study_session,
    "generate_study_plan": _generate_study_plan_tool,
}
