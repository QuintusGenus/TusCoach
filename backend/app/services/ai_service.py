"""
AI Service
Generates human-readable messages from workflow context.
Supports stub mode (local) and future LLM integration.
"""
import os
import json
import logging
from sqlalchemy.orm import Session
from app.schemas.ai import StudentMessageOut, CoachReportOut
from app.models.message import CoachMessage

logger = logging.getLogger(__name__)

# ── TUS question generation prompts ──────────────────────────────────────────

_QUESTION_SYSTEM_PROMPT = """\
Sen uzman bir TUS (Tıpta Uzmanlık Sınavı) soru yazarısın.
Görevin: Türkiye tıp uzmanlık sınavı formatında, yüksek kaliteli Türkçe soru üretmek.

SORU YAZIM KURALLARI:
1. Soru gövdesi (stem) klinisyen ya da temel bilim senaryo tarzında olmalıdır.
2. Tam olarak 5 seçenek (A, B, C, D, E) bulunmalıdır.
3. Sadece bir seçenek kesinlikle doğru olmalıdır; diğerleri makul ama yanlış olmalıdır.
4. Açıklama (explanation) doğru cevabı ve neden diğerlerinin yanlış olduğunu kısaca belirtmelidir.
5. Tüm metin Türkçe olmalıdır.

ÇIKTI FORMATI — geçerli JSON, başka hiçbir şey ekleme:
{
  "stem": "<soru gövdesi>",
  "options": {
    "A": "<seçenek A>",
    "B": "<seçenek B>",
    "C": "<seçenek C>",
    "D": "<seçenek D>",
    "E": "<seçenek E>"
  },
  "correct_key": "<A|B|C|D|E>",
  "explanation": "<kısa açıklama, 2-3 cümle>"
}"""

_QUESTION_USER_TEMPLATE = """\
Lütfen şu parametrelerle bir TUS sorusu üret:
- Sınav türü: {test_type} ({test_type_label})
- Ders: {subject}
- Konu: {subtopic}
- Zorluk: {difficulty_label} ({difficulty_desc})

Sadece JSON döndür."""

_TEST_TYPE_LABELS = {
    "temel": "Temel Tıp Bilimleri",
    "klinik": "Klinik Tıp Bilimleri",
}
_DIFFICULTY_DESCRIPTIONS = {
    "kolay": "sınava yeni başlayan öğrenciler için temel kavramlar",
    "orta": "standart TUS soru zorluğu, konsept uygulaması",
    "zor": "ileri analiz, ayırıcı tanı veya karmaşık senaryo",
}

# Simple stub logic
def _stub_student_message(workflow_name: str, context: dict) -> StudentMessageOut:
    if workflow_name == "daily_review":
        risk = context.get("risk_score", 0)
        tasks = context.get("tasks_created", 0)
        tone = "warm" if risk < 50 else "urgent"
        return StudentMessageOut(
            subject="Your Daily Plan is Ready",
            body=f"Good morning! Your risk score is currently {risk}. We have scheduled {tasks} tasks for you tomorrow. Keep it up!",
            tone=tone
        )
    elif workflow_name == "inactivity_rescue":
        hours = context.get("inactivity_hours", 0)
        return StudentMessageOut(
            subject="We Miss You!",
            body=f"It's been {hours} hours since your last session. We've prepared a quick recovery session for you.",
            tone="warm"
        )
    elif workflow_name == "exam_intervention":
        subjects = context.get("top_subjects", [])
        accuracy = context.get("top_accuracy", 0)
        subject_list = " ve ".join(subjects) if subjects else "bazı konular"
        next_step = f"Bu hafta {subjects[0]} konusuna öncelik ver." if subjects else "Zayıf konulara odaklanmaya devam et."
        return StudentMessageOut(
            subject="Deneme Sınavı Analizi",
            body=(
                f"Sınavında genel doğruluk oranın %{accuracy:.0f} olarak hesaplandı. "
                f"En zayıf konuların: {subject_list}. "
                f"{next_step} Başarılar! 💪"
            ),
            tone="supportive"
        )
    return StudentMessageOut(subject="Update", body="Workflow completed.", tone="neutral")

def _stub_coach_report(workflow_name: str, context: dict) -> CoachReportOut:
    if workflow_name == "daily_review":
        risk = context.get("risk_score", 0)
        level = "high" if risk > 70 else "medium" if risk > 30 else "low"
        return CoachReportOut(
            summary=f"Daily Review run. Risk Score: {risk}.",
            risk_level=level,
            action_items=["Check student adherence", "Review upcoming tasks"]
        )
    return CoachReportOut(summary="Workflow run", risk_level="low", action_items=[])

def generate_student_message(db: Session, student_id: int, run_id: int, workflow_name: str, context: dict) -> StudentMessageOut:  # noqa: E501
    """
    Generates a message for the student based on workflow context AND saves it to CoachMessage table.

    NOTE: student_id here is actually users.id (from workflow_runs).
    CoachMessage.student_id expects student_profiles.id, so we look it up.
    """
    from app.models.user import StudentProfile

    # Enrich context with QBank stats for the AI prompt
    qbank_block = build_qbank_context_block(db, student_id)
    if qbank_block:
        context = {**context, "qbank_context": qbank_block}

    api_key = os.getenv("LLM_API_KEY")
    if not api_key or api_key == "your-api-key-here":
        msg = _stub_student_message(workflow_name, context)
    else:
        # Future: Call LLM here with context (including qbank_context)
        msg = _stub_student_message(workflow_name, context)

    # Look up student_profiles.id from users.id
    profile = db.query(StudentProfile).filter_by(user_id=student_id).first()
    profile_id = profile.id if profile else None

    # Save to DB
    db_msg = CoachMessage(
        student_id=profile_id,
        user_id=student_id,
        workflow_run_id=run_id,
        subject=msg.subject,
        body=msg.body,
        tone=msg.tone
    )
    db.add(db_msg)
    db.commit()

    return msg

def build_qbank_context_block(db: Session, student_id: int) -> str:
    """
    Build a QBank performance summary string suitable for injection into AI prompts.
    Returns an empty string if there is no QBank data yet.
    """
    from datetime import datetime, timedelta, date
    from sqlalchemy import select, func, Integer
    from app.models.qbank import QuestionAttempt, Question, SRSState

    try:
        week_ago = datetime.utcnow() - timedelta(days=7)

        # Total attempts this week
        weekly_total = db.execute(
            select(func.count(QuestionAttempt.id)).where(
                QuestionAttempt.student_id == student_id,
                QuestionAttempt.answered_at >= week_ago,
            )
        ).scalar() or 0

        if weekly_total == 0:
            return ""

        # Per-subject accuracy (all time) — top 3 weakest
        subject_stats = db.execute(
            select(
                Question.subject,
                func.count(QuestionAttempt.id).label("attempts"),
                func.sum(QuestionAttempt.is_correct.cast(Integer)).label("correct"),
            )
            .join(Question, QuestionAttempt.question_id == Question.id)
            .where(QuestionAttempt.student_id == student_id)
            .group_by(Question.subject)
            .having(func.count(QuestionAttempt.id) >= 3)
        ).all()

        weakest = sorted(subject_stats, key=lambda r: (r.correct or 0) / r.attempts)[:3]

        # SRS backlog
        srs_due = db.execute(
            select(func.count(SRSState.question_id)).where(
                SRSState.student_id == student_id,
                SRSState.next_review <= date.today(),
            )
        ).scalar() or 0

        weak_lines = "\n".join(
            f"  - {r.subject} (%{round((r.correct or 0) / r.attempts * 100):.0f} doğruluk)"
            for r in weakest
        )
        return (
            f"\nQBank (bu haftaki performans):\n"
            f"  - Toplam soru: {weekly_total}\n"
            f"  - En zayıf konular:\n{weak_lines}\n"
            f"  - Tekrar bekleyen soru: {srs_due}\n"
        )
    except Exception:
        return ""


def generate_tus_question(
    subject: str,
    subtopic: str,
    test_type: str,
    difficulty_label: str,
) -> "Question":
    """
    Generate one TUS-style question via Gemini and return an unsaved Question ORM
    object with status='draft'. Raises ValueError on parse/validation failure.
    Raises RuntimeError if LLM_API_KEY is not configured.
    """
    from openai import OpenAI
    from app.core.config import get_settings
    from app.models.qbank import Question

    settings = get_settings()
    api_key = settings.LLM_API_KEY
    if not api_key:
        raise RuntimeError(
            "LLM_API_KEY is not configured. Set it in backend/.env to generate questions."
        )

    client = OpenAI(api_key=api_key, base_url=settings.LLM_BASE_URL)

    user_prompt = _QUESTION_USER_TEMPLATE.format(
        test_type=test_type,
        test_type_label=_TEST_TYPE_LABELS.get(test_type, test_type),
        subject=subject,
        subtopic=subtopic or subject,
        difficulty_label=difficulty_label,
        difficulty_desc=_DIFFICULTY_DESCRIPTIONS.get(difficulty_label, ""),
    )

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": _QUESTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    if not response.choices:
        raise ValueError("LLM returned empty choices")

    raw = response.choices[0].message.content or ""
    # Strip markdown fences if the model wraps its output despite json_object mode
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rstrip("`").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM did not return valid JSON: {exc}\nRaw: {raw[:500]}")

    stem = (data.get("stem") or "").strip()
    options = data.get("options") or {}
    correct_key = (data.get("correct_key") or "").strip().upper()
    explanation = (data.get("explanation") or "").strip() or None

    if not stem:
        raise ValueError("LLM response missing 'stem'")
    expected_keys = {"A", "B", "C", "D", "E"}
    actual_keys = {k.upper() for k in options}
    if actual_keys != expected_keys:
        raise ValueError(
            f"LLM options must have exactly keys A-E, got: {actual_keys}"
        )
    if correct_key not in expected_keys:
        raise ValueError(f"LLM 'correct_key' must be A-E, got: {correct_key!r}")

    options = {k.upper(): v for k, v in options.items()}

    return Question(
        test=test_type,
        subject=subject,
        subtopic=subtopic or None,
        difficulty_label=difficulty_label,
        stem=stem,
        options=options,
        correct_key=correct_key,
        explanation=explanation,
        status="draft",
    )


def generate_coach_report(workflow_name: str, context: dict) -> CoachReportOut:
    """
    Generates a report for the coach.
    """
    # Same logic for provider fallback
    return _stub_coach_report(workflow_name, context)
