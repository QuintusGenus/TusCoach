"""
Plan Service — Tur-based LLM-powered study plan generation and CRUD operations.
"""
import json
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.constants import (
    TUS_SUBJECTS,
    TUS_SUBJECT_ORDER,
    TUR_CONFIGS,
    compute_tur_duration,
)
from app.models.study import PlanTask, StudyPlan, StudySession, Topic
from app.models.exams import MockExam, MockExamBreakdown

logger = logging.getLogger(__name__)


# ── Existing CRUD functions ──

def get_tasks_by_date(db: Session, student_id: int, query_date: date) -> List[PlanTask]:
    """Get plan tasks for a specific student and date (active plan only)."""
    return (
        db.query(PlanTask)
        .join(StudyPlan)
        .filter(StudyPlan.student_id == student_id)
        .filter(StudyPlan.status == "active")
        .filter(PlanTask.date == query_date)
        .all()
    )


def complete_task(db: Session, task_id: int, student_id: int) -> Optional[PlanTask]:
    """Mark a task as done. Verifies ownership."""
    task = (
        db.query(PlanTask)
        .join(StudyPlan)
        .filter(PlanTask.id == task_id)
        .filter(StudyPlan.student_id == student_id)
        .first()
    )
    if not task:
        return None
    task.status = "done"
    db.commit()
    db.refresh(task)
    return task


def get_active_plan(db: Session, student_id: int) -> Optional[StudyPlan]:
    """Get the current active plan."""
    return (
        db.query(StudyPlan)
        .filter(StudyPlan.student_id == student_id, StudyPlan.status == "active")
        .first()
    )


def update_task(
    db: Session,
    task_id: int,
    student_id: int,
    target_minutes: Optional[int] = None,
    task_type: Optional[str] = None,
    new_date: Optional[date] = None,
) -> Optional[PlanTask]:
    """Update a task's target_minutes, task_type, and/or date. Verifies ownership."""
    task = (
        db.query(PlanTask)
        .join(StudyPlan)
        .filter(PlanTask.id == task_id, StudyPlan.student_id == student_id)
        .first()
    )
    if not task:
        return None

    plan = task.plan

    if target_minutes is not None:
        if target_minutes < 5 or target_minutes > 180:
            raise ValueError("target_minutes must be between 5 and 180")
        task.target_minutes = target_minutes

    # Determine the effective task_type for constraint checks
    effective_type = task_type if task_type is not None else task.task_type

    if task_type is not None:
        if task_type not in ("review", "question", "video", "note"):
            raise ValueError(f"Invalid task_type: {task_type}")
        conflict = db.query(PlanTask).filter(
            PlanTask.plan_id == task.plan_id,
            PlanTask.date == task.date,
            PlanTask.topic_id == task.topic_id,
            PlanTask.task_type == task_type,
            PlanTask.id != task.id,
        ).first()
        if conflict:
            raise ValueError("Bu tarihte aynı türde görev zaten var")
        task.task_type = task_type

    if new_date is not None:
        if new_date < plan.start_date or new_date > plan.end_date:
            raise ValueError("Tarih plan aralığında olmalı")
        conflict = db.query(PlanTask).filter(
            PlanTask.plan_id == task.plan_id,
            PlanTask.date == new_date,
            PlanTask.topic_id == task.topic_id,
            PlanTask.task_type == effective_type,
            PlanTask.id != task.id,
        ).first()
        if conflict:
            raise ValueError("Hedef tarihte aynı türde görev zaten var")
        task.date = new_date
        block_info = _get_block_for_date(plan, new_date)
        if block_info:
            task.phase = block_info["phase"]
            task.subject_block_order = block_info["block_order"]
            topic = db.query(Topic).filter(
                Topic.subject == block_info["subject"],
                Topic.parent_id.is_(None),
            ).first()
            if topic:
                task.topic_id = topic.id

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int, student_id: int) -> bool:
    """Delete a task. Verifies ownership. Returns True if deleted."""
    task = (
        db.query(PlanTask)
        .join(StudyPlan)
        .filter(PlanTask.id == task_id, StudyPlan.student_id == student_id)
        .first()
    )
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def create_task(
    db: Session,
    student_id: int,
    task_date: date,
    task_type: str,
    target_minutes: int,
) -> PlanTask:
    """Create a new task on a specific date within the active plan."""
    plan = get_active_plan(db, student_id)
    if not plan:
        raise ValueError("Aktif plan bulunamadı")

    if task_date < plan.start_date or task_date > plan.end_date:
        raise ValueError("Tarih plan aralığında olmalı")

    if task_type not in ("review", "question", "video", "note"):
        raise ValueError(f"Geçersiz görev türü: {task_type}")

    if target_minutes < 5 or target_minutes > 180:
        raise ValueError("Süre 5-180 dakika arasında olmalı")

    block_info = _get_block_for_date(plan, task_date)
    if not block_info:
        raise ValueError("Bu tarih için plan yapısında blok bulunamadı")

    subject = block_info["subject"]
    topic = db.query(Topic).filter(
        Topic.subject == subject,
        Topic.parent_id.is_(None),
    ).first()
    if not topic:
        subject_map = ensure_tus_topics(db)
        topic_id = subject_map.get(subject)
    else:
        topic_id = topic.id

    if not topic_id:
        raise ValueError(f"Ders için konu bulunamadı: {subject}")

    conflict = db.query(PlanTask).filter(
        PlanTask.plan_id == plan.id,
        PlanTask.date == task_date,
        PlanTask.topic_id == topic_id,
        PlanTask.task_type == task_type,
    ).first()
    if conflict:
        raise ValueError("Bu tarihte aynı türde görev zaten var")

    task = PlanTask(
        plan_id=plan.id,
        date=task_date,
        topic_id=topic_id,
        task_type=task_type,
        target_minutes=target_minutes,
        status="pending",
        phase=block_info["phase"],
        subject_block_order=block_info["block_order"],
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


# ── Topic seeding ──

def ensure_tus_topics(db: Session) -> Dict[str, int]:
    """
    Ensure a Topic row exists for each TUS subject.
    Returns {subject_name: topic_id} mapping.
    """
    existing = db.query(Topic).filter(Topic.parent_id.is_(None)).all()
    existing_map = {t.subject: t.id for t in existing}

    for subj in TUS_SUBJECTS:
        if subj not in existing_map:
            t = Topic(name="Genel", subject=subj, sort_order=0)
            db.add(t)
            db.flush()
            existing_map[subj] = t.id

    db.commit()
    return existing_map


# ── Task enrichment ──

def enrich_tasks(db: Session, tasks: List[PlanTask]) -> List[dict]:
    """Add subject, topic_name, phase, and block order to task dicts for API response."""
    if not tasks:
        return []
    topic_ids = {t.topic_id for t in tasks}
    topics = db.query(Topic).filter(Topic.id.in_(topic_ids)).all()
    topic_map = {t.id: t for t in topics}

    result = []
    for t in tasks:
        topic = topic_map.get(t.topic_id)
        result.append({
            "id": t.id,
            "task_type": t.task_type,
            "target_minutes": t.target_minutes,
            "status": t.status,
            "date": t.date,
            "subject": topic.subject if topic else None,
            "topic_name": topic.name if topic else None,
            "phase": t.phase,
            "subject_block_order": t.subject_block_order,
        })
    return result


# ── Tur skeleton builder ──

def _build_tur_skeleton(tur_number: int, start_date: date) -> List[dict]:
    """
    Build a deterministic day-by-day skeleton for a tur.
    Returns list of dicts with date, subject, phase, block_order, day_in_phase, total_phase_days.
    """
    config = TUR_CONFIGS[tur_number]
    skeleton = []
    current_date = start_date

    for block_order, subject in enumerate(TUS_SUBJECT_ORDER, 1):
        if subject in config["large_subjects"]:
            reading_days = config["large_reading_days"]
            question_days = config["large_question_days"]
        else:
            reading_days = config["default_reading_days"]
            question_days = config["default_question_days"]

        for day_num in range(reading_days):
            skeleton.append({
                "date": current_date,
                "subject": subject,
                "phase": "reading",
                "block_order": block_order,
                "day_in_phase": day_num + 1,
                "total_phase_days": reading_days,
            })
            current_date += timedelta(days=1)

        for day_num in range(question_days):
            skeleton.append({
                "date": current_date,
                "subject": subject,
                "phase": "question",
                "block_order": block_order,
                "day_in_phase": day_num + 1,
                "total_phase_days": question_days,
            })
            current_date += timedelta(days=1)

    return skeleton


# ── Block config helpers ──

def _get_block_config(plan: StudyPlan) -> List[dict]:
    """Return the block config for a plan — from custom_block_config or TUR_CONFIGS defaults."""
    if plan.custom_block_config:
        return json.loads(plan.custom_block_config)

    if not plan.tur_number or plan.tur_number not in TUR_CONFIGS:
        return []

    config = TUR_CONFIGS[plan.tur_number]
    result = []
    for order, subject in enumerate(TUS_SUBJECT_ORDER, 1):
        if subject in config["large_subjects"]:
            rd = config["large_reading_days"]
            qd = config["large_question_days"]
        else:
            rd = config["default_reading_days"]
            qd = config["default_question_days"]
        result.append({
            "subject": subject,
            "order": order,
            "reading_days": rd,
            "question_days": qd,
        })
    return result


def _build_plan_skeleton(plan: StudyPlan) -> List[dict]:
    """Build skeleton from plan's block config (custom or default)."""
    block_config = _get_block_config(plan)
    skeleton = []
    current_date = plan.start_date

    for block in block_config:
        subject = block["subject"]
        order = block["order"]
        reading_days = block["reading_days"]
        question_days = block["question_days"]

        for day_num in range(reading_days):
            skeleton.append({
                "date": current_date,
                "subject": subject,
                "phase": "reading",
                "block_order": order,
                "day_in_phase": day_num + 1,
                "total_phase_days": reading_days,
            })
            current_date += timedelta(days=1)

        for day_num in range(question_days):
            skeleton.append({
                "date": current_date,
                "subject": subject,
                "phase": "question",
                "block_order": order,
                "day_in_phase": day_num + 1,
                "total_phase_days": question_days,
            })
            current_date += timedelta(days=1)

    return skeleton


def _get_block_for_date(plan: StudyPlan, query_date: date) -> Optional[dict]:
    """Return {subject, phase, block_order} for a given date in the plan."""
    skeleton = _build_plan_skeleton(plan)
    for entry in skeleton:
        if entry["date"] == query_date:
            return {
                "subject": entry["subject"],
                "phase": entry["phase"],
                "block_order": entry["block_order"],
            }
    return None


# ── Block restructuring ──

def reorder_blocks(db: Session, student_id: int, new_order: List[str]) -> StudyPlan:
    """Reorder subject blocks and reassign all task dates."""
    plan = get_active_plan(db, student_id)
    if not plan:
        raise ValueError("Aktif plan bulunamadı")

    if len(new_order) != len(TUS_SUBJECT_ORDER) or set(new_order) != set(TUS_SUBJECT_ORDER):
        raise ValueError("Tam olarak 11 benzersiz TUS dersi belirtilmeli")

    current_config = _get_block_config(plan)
    config_by_subject = {b["subject"]: b for b in current_config}

    new_config = []
    for i, subject in enumerate(new_order, 1):
        block = config_by_subject[subject]
        new_config.append({
            "subject": subject,
            "order": i,
            "reading_days": block["reading_days"],
            "question_days": block["question_days"],
        })

    _apply_restructure(db, plan, new_config)
    return plan


def update_block_days(
    db: Session,
    student_id: int,
    subject: str,
    reading_days: int,
    question_days: int,
) -> StudyPlan:
    """Change reading/question days for a block; cascade to subsequent blocks."""
    plan = get_active_plan(db, student_id)
    if not plan:
        raise ValueError("Aktif plan bulunamadı")

    if subject not in TUS_SUBJECTS:
        raise ValueError(f"Geçersiz ders: {subject}")
    if reading_days < 1 or question_days < 1:
        raise ValueError("Gün sayısı en az 1 olmalı")
    if reading_days > 14 or question_days > 14:
        raise ValueError("Gün sayısı en fazla 14 olabilir")

    current_config = _get_block_config(plan)

    found = False
    for block in current_config:
        if block["subject"] == subject:
            block["reading_days"] = reading_days
            block["question_days"] = question_days
            found = True
            break

    if not found:
        raise ValueError(f"Ders plan bloklarında bulunamadı: {subject}")

    _apply_restructure(db, plan, current_config)
    return plan


def _apply_restructure(db: Session, plan: StudyPlan, new_config: List[dict]) -> None:
    """
    Apply a new block config to a plan. Reassigns all task dates.
    Preserves task details and completion status.
    """
    plan.custom_block_config = json.dumps(new_config, ensure_ascii=False)

    # Build new skeleton
    new_skeleton = []
    current_date = plan.start_date
    for block in new_config:
        subject = block["subject"]
        order = block["order"]
        for _ in range(block["reading_days"]):
            new_skeleton.append({
                "date": current_date,
                "subject": subject,
                "phase": "reading",
                "block_order": order,
            })
            current_date += timedelta(days=1)
        for _ in range(block["question_days"]):
            new_skeleton.append({
                "date": current_date,
                "subject": subject,
                "phase": "question",
                "block_order": order,
            })
            current_date += timedelta(days=1)

    new_end_date = current_date - timedelta(days=1)

    # Load all existing tasks
    all_tasks = (
        db.query(PlanTask)
        .filter(PlanTask.plan_id == plan.id)
        .order_by(PlanTask.date, PlanTask.id)
        .all()
    )

    # Build topic lookup
    topic_ids = {t.topic_id for t in all_tasks}
    topics = db.query(Topic).filter(Topic.id.in_(topic_ids)).all() if topic_ids else []
    topic_map = {t.id: t for t in topics}

    # Group tasks by (subject, phase) → ordered by date
    tasks_by_key: Dict[tuple, List[List[PlanTask]]] = defaultdict(list)
    temp_by_key: Dict[tuple, Dict[date, List[PlanTask]]] = defaultdict(lambda: defaultdict(list))
    for task in all_tasks:
        topic = topic_map.get(task.topic_id)
        subj = topic.subject if topic else None
        key = (subj, task.phase)
        temp_by_key[key][task.date].append(task)

    for key, date_groups in temp_by_key.items():
        for d in sorted(date_groups.keys()):
            tasks_by_key[key].append(date_groups[d])

    # Group skeleton days by (subject, phase)
    skeleton_days: Dict[tuple, List[dict]] = defaultdict(list)
    for entry in new_skeleton:
        skeleton_days[(entry["subject"], entry["phase"])].append(entry)

    # Ensure topic IDs exist
    subject_topic_map = ensure_tus_topics(db)

    # Reassign tasks
    used_task_ids = set()
    for key, skel_entries in skeleton_days.items():
        subject, phase = key
        existing_day_groups = tasks_by_key.get(key, [])

        for i, skel_entry in enumerate(skel_entries):
            new_date = skel_entry["date"]
            block_order = skel_entry["block_order"]

            if i < len(existing_day_groups):
                for task in existing_day_groups[i]:
                    task.date = new_date
                    task.subject_block_order = block_order
                    task.phase = phase
                    used_task_ids.add(task.id)
            else:
                # New day — create stub task
                topic_id = subject_topic_map.get(subject)
                if topic_id:
                    stub_type = "review" if phase == "reading" else "question"
                    new_task = PlanTask(
                        plan_id=plan.id,
                        date=new_date,
                        topic_id=topic_id,
                        task_type=stub_type,
                        target_minutes=60,
                        status="pending",
                        phase=phase,
                        subject_block_order=block_order,
                    )
                    db.add(new_task)

    # Delete excess tasks (from blocks that shrunk)
    for task in all_tasks:
        if task.id not in used_task_ids:
            db.delete(task)

    plan.end_date = new_end_date
    plan.version += 1

    db.commit()
    db.refresh(plan)
    logger.info(
        f"Restructured plan {plan.id}: {len(new_config)} blocks, "
        f"end_date={new_end_date}, version={plan.version}"
    )


# ── Plan structure ──

def get_plan_structure(db: Session, plan: StudyPlan) -> Optional[dict]:
    """Build the subject block structure from plan tasks."""
    if not plan.tur_number:
        return None

    tasks = (
        db.query(PlanTask)
        .filter(PlanTask.plan_id == plan.id)
        .order_by(PlanTask.date)
        .all()
    )

    # Group tasks by subject_block_order
    blocks_data: Dict[int, dict] = {}
    for t in tasks:
        order = t.subject_block_order
        if order is None:
            continue
        if order not in blocks_data:
            topic = db.query(Topic).filter(Topic.id == t.topic_id).first()
            blocks_data[order] = {
                "subject": topic.subject if topic else "?",
                "order": order,
                "min_date": t.date,
                "max_date": t.date,
                "reading_days": set(),
                "question_days": set(),
                "all_done": True,
            }
        bd = blocks_data[order]
        if t.date < bd["min_date"]:
            bd["min_date"] = t.date
        if t.date > bd["max_date"]:
            bd["max_date"] = t.date
        if t.phase == "reading":
            bd["reading_days"].add(t.date)
        elif t.phase == "question":
            bd["question_days"].add(t.date)
        if t.status != "done":
            bd["all_done"] = False

    today = date.today()
    blocks = []
    current_block_index = None

    for order in sorted(blocks_data.keys()):
        bd = blocks_data[order]
        # Determine phase status
        if bd["all_done"]:
            phase_status = "completed"
        elif bd["min_date"] <= today <= bd["max_date"]:
            phase_status = "active"
            current_block_index = len(blocks)
        elif bd["min_date"] > today:
            phase_status = "pending"
        else:
            # Past but not all done
            phase_status = "active"
            if current_block_index is None:
                current_block_index = len(blocks)

        blocks.append({
            "subject": bd["subject"],
            "order": bd["order"],
            "start_date": bd["min_date"],
            "end_date": bd["max_date"],
            "reading_days": len(bd["reading_days"]),
            "question_days": len(bd["question_days"]),
            "phase": phase_status,
        })

    return {
        "id": plan.id,
        "tur_number": plan.tur_number,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "blocks": blocks,
        "current_block_index": current_block_index,
    }


# ── Plan generation context ──

def _gather_plan_context(db: Session, user_id: int) -> dict:
    """Collect all data needed for LLM plan generation."""
    from app.services.preferences_service import get_preferences

    prefs = get_preferences(db, user_id)

    # Study history: per-subject minutes over last 30 days
    sessions = (
        db.query(StudySession.subject, func.sum(StudySession.minutes))
        .filter(
            StudySession.student_id == user_id,
            StudySession.date >= date.today() - timedelta(days=30),
        )
        .group_by(StudySession.subject)
        .all()
    )
    subject_minutes = {s: int(m) for s, m in sessions if s}

    # Latest mock exam breakdown
    latest_exam = (
        db.query(MockExam)
        .filter(MockExam.student_id == user_id)
        .order_by(MockExam.date.desc())
        .first()
    )
    exam_breakdown = []
    if latest_exam:
        breakdowns = (
            db.query(MockExamBreakdown)
            .filter(MockExamBreakdown.exam_id == latest_exam.id)
            .all()
        )
        exam_breakdown = [
            {
                "subject": b.subject,
                "correct": b.correct,
                "wrong": b.wrong,
                "blank": b.blank,
            }
            for b in breakdowns
        ]

    return {
        "exam_date": prefs.exam_date.isoformat() if prefs.exam_date else None,
        "days_until_exam": (prefs.exam_date - date.today()).days if prefs.exam_date else None,
        "daily_target_weekday": prefs.daily_target_minutes_weekday or 120,
        "daily_target_weekend": prefs.daily_target_minutes_weekend or 90,
        "subject_minutes_last_30d": subject_minutes,
        "latest_exam_breakdown": exam_breakdown,
    }


# ── LLM call ──

PLAN_SYSTEM_PROMPT = """Sen TUS sınavına hazırlanan öğrenciler için çalışma planı detaylandıran bir uzman eğitim planlayıcısısın.

TUS hafıza ağırlıklı bir sınavdır. Öğrenciler bir seferde TEK bir derse odaklanır (ders bloğu sistemi).
Günlük çalışma planında o gün hangi ders çalışılacağı ve faz (okuma/soru) bilgisi zaten belirlenmiştir.
Senin görevin her gün için uygun görevleri (task) ve sürelerini belirlemektir.

ÖĞRENCİNİN TURU: {tur_number}. Tur ({tur_label})

DERS BLOĞU YAPISI:
{subject_blocks}

KURALLAR:
1. Her günün dersi ve fazı SABITTIR — değiştirme
2. "reading" fazında task_type değerleri: "review" (konu okuma), "video" (video izleme), "note" (not çıkarma)
3. "question" fazında task_type değerleri: "question" (soru çözümü), "review" (kısa tekrar)
4. Her gün için hedef dakikayı (hafta içi/sonu farklı) aşma
5. Günde 1-3 task planla (hepsi aynı ders olacak)
6. target_minutes en az 15, en fazla 120 olsun
7. Zayıf konulara (az çalışılmış veya deneme puanı düşük) daha fazla süre ayır
8. Öğrenciye sıralamayı, süreleri ve yapıyı ihtiyaçlarına göre değiştirebileceğini hatırlat

SADECE JSON formatında cevap ver, başka hiçbir metin ekleme:
{{"days": [{{"date": "YYYY-MM-DD", "subject": "DersAdı", "phase": "reading", "tasks": [{{"task_type": "review", "target_minutes": 60}}]}}]}}"""


def _build_subject_blocks_text(skeleton: List[dict]) -> str:
    """Format the skeleton into human-readable text for the LLM prompt."""
    lines = []
    current_subject = None
    block_start = None
    block_order = 0
    reading_count = 0
    question_count = 0

    for entry in skeleton:
        if entry["subject"] != current_subject:
            if current_subject:
                lines.append(
                    f"  {block_order}. {current_subject}: "
                    f"{block_start} - {prev_date} "
                    f"({reading_count} gün okuma + {question_count} gün soru)"
                )
            current_subject = entry["subject"]
            block_start = entry["date"].isoformat()
            block_order = entry["block_order"]
            reading_count = 0
            question_count = 0

        if entry["phase"] == "reading":
            reading_count += 1
        else:
            question_count += 1
        prev_date = entry["date"].isoformat()

    if current_subject:
        lines.append(
            f"  {block_order}. {current_subject}: "
            f"{block_start} - {prev_date} "
            f"({reading_count} gün okuma + {question_count} gün soru)"
        )

    return "\n".join(lines)


def _call_llm_for_plan(
    context: dict,
    skeleton: List[dict],
    tur_number: int,
) -> list:
    """Call Gemini to generate study plan tasks for each day in the skeleton."""
    from openai import OpenAI
    from app.core.config import get_settings

    settings = get_settings()

    # Check for stub mode
    api_key = settings.LLM_API_KEY
    if not api_key or api_key == "your-api-key-here":
        return _generate_stub_plan(context, skeleton)

    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)

    tur_config = TUR_CONFIGS[tur_number]
    subject_blocks_text = _build_subject_blocks_text(skeleton)

    # Build date info
    weekday_count = sum(1 for e in skeleton if e["date"].weekday() < 5)
    weekend_count = len(skeleton) - weekday_count

    user_prompt = (
        f"Öğrenci bilgileri:\n"
        f"- Sınav tarihi: {context['exam_date'] or 'Belirlenmedi'}\n"
        f"- Sınava kalan gün: {context['days_until_exam'] or 'Bilinmiyor'}\n"
        f"- Hafta içi hedef: {context['daily_target_weekday']} dakika/gün\n"
        f"- Hafta sonu hedef: {context['daily_target_weekend']} dakika/gün\n"
        f"- Son 30 gündeki çalışmalar (ders bazlı dakika): "
        f"{json.dumps(context['subject_minutes_last_30d'], ensure_ascii=False)}\n"
        f"- Son deneme sonuçları: "
        f"{json.dumps(context['latest_exam_breakdown'], ensure_ascii=False)}\n\n"
        f"Plan: {len(skeleton)} gün ({weekday_count} hafta içi, {weekend_count} hafta sonu)\n"
        f"Tarih aralığı: {skeleton[0]['date'].isoformat()} - {skeleton[-1]['date'].isoformat()}\n\n"
        f"Her gün için belirlenen ders ve fazı:\n"
    )

    # Add daily skeleton to prompt
    for entry in skeleton:
        day_name = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][entry["date"].weekday()]
        target = context["daily_target_weekend"] if entry["date"].weekday() >= 5 else context["daily_target_weekday"]
        user_prompt += (
            f"  {entry['date'].isoformat()} ({day_name}): "
            f"{entry['subject']} - {entry['phase']} fazı "
            f"(gün {entry['day_in_phase']}/{entry['total_phase_days']}) "
            f"- hedef {target} dk\n"
        )

    user_prompt += "\nLütfen her gün için uygun görevleri ve sürelerini belirle."

    try:
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": PLAN_SYSTEM_PROMPT.format(
                        tur_number=tur_number,
                        tur_label=tur_config["label"],
                        subject_blocks=subject_blocks_text,
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        if not response.choices:
            raise ValueError("LLM returned empty choices for plan generation")

        content = response.choices[0].message.content
        parsed = json.loads(content)
        days = parsed.get("days", [])
        if not days:
            raise ValueError("LLM returned empty days list")
        return days
    except Exception as e:
        logger.warning("LLM plan generation failed, falling back to stub: %s", e)
        return _generate_stub_plan(context, skeleton)


def _generate_stub_plan(context: dict, skeleton: List[dict]) -> list:
    """Generate a deterministic plan following tur skeleton when no LLM is configured."""
    result = []
    for entry in skeleton:
        d = entry["date"]
        is_weekend = d.weekday() >= 5
        daily_budget = (
            context["daily_target_weekend"] if is_weekend
            else context["daily_target_weekday"]
        )

        if entry["phase"] == "reading":
            tasks = [
                {"task_type": "review", "target_minutes": max(15, int(daily_budget * 0.7))},
                {"task_type": "note", "target_minutes": max(15, int(daily_budget * 0.3))},
            ]
        else:  # question phase
            tasks = [
                {"task_type": "question", "target_minutes": max(15, int(daily_budget * 0.8))},
                {"task_type": "review", "target_minutes": max(15, int(daily_budget * 0.2))},
            ]

        result.append({
            "date": d.isoformat(),
            "subject": entry["subject"],
            "phase": entry["phase"],
            "tasks": tasks,
        })
    return result


# ── Main generation ──

def generate_study_plan(
    db: Session, user_id: int, tur_number: int = 1, start_date: Optional[date] = None
) -> StudyPlan:
    """
    Generate a new tur-based study plan.
    Archives any existing active plan, then creates a new one.
    """
    if tur_number not in TUR_CONFIGS:
        raise ValueError(f"Invalid tur_number: {tur_number}. Must be 1-4.")

    if start_date is None:
        start_date = date.today()

    days = compute_tur_duration(tur_number)
    end_date = start_date + timedelta(days=days - 1)

    # 1. Archive old active plans
    old_plans = (
        db.query(StudyPlan)
        .filter(StudyPlan.student_id == user_id, StudyPlan.status == "active")
        .all()
    )
    max_version = 0
    for p in old_plans:
        p.status = "archived"
        if p.version > max_version:
            max_version = p.version

    # 2. Ensure topics
    subject_to_topic_id = ensure_tus_topics(db)

    # 3. Gather context
    context = _gather_plan_context(db, user_id)

    # 4. Build tur skeleton
    skeleton = _build_tur_skeleton(tur_number, start_date)

    # 5. Call LLM (or stub) for task details
    plan_days = _call_llm_for_plan(context, skeleton, tur_number)

    # 6. Create plan
    plan = StudyPlan(
        student_id=user_id,
        start_date=start_date,
        end_date=end_date,
        version=max_version + 1,
        status="active",
        tur_number=tur_number,
    )
    db.add(plan)
    db.flush()

    # Build skeleton lookup for validation
    skeleton_by_date = {entry["date"].isoformat(): entry for entry in skeleton}

    # 7. Create tasks from LLM output
    seen = set()  # track (date, topic_id, task_type) for dedup
    tasks_created = 0
    for day_entry in plan_days:
        try:
            task_date = date.fromisoformat(day_entry["date"])
        except (ValueError, KeyError):
            continue
        if task_date < start_date or task_date > end_date:
            continue

        # Get skeleton entry for this date
        skel = skeleton_by_date.get(day_entry["date"])
        if not skel:
            continue

        # Use skeleton's subject (don't trust LLM to get it right)
        subject = skel["subject"]
        topic_id = subject_to_topic_id.get(subject)
        if not topic_id:
            continue

        phase = skel["phase"]
        block_order = skel["block_order"]

        for task_data in day_entry.get("tasks", []):
            task_type = task_data.get("task_type", "review")
            if task_type not in ("review", "question", "video", "note"):
                task_type = "review"

            minutes = task_data.get("target_minutes", 30)
            minutes = max(5, min(minutes, 180))

            key = (task_date, topic_id, task_type)
            if key in seen:
                continue
            seen.add(key)

            task = PlanTask(
                plan_id=plan.id,
                date=task_date,
                topic_id=topic_id,
                task_type=task_type,
                target_minutes=minutes,
                status="pending",
                phase=phase,
                subject_block_order=block_order,
            )
            db.add(task)
            tasks_created += 1

    db.commit()
    db.refresh(plan)
    logger.info(
        f"Generated tur {tur_number} plan {plan.id} for user {user_id}: "
        f"{tasks_created} tasks over {days} days"
    )
    return plan
