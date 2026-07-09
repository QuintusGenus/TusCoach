"""
QBank business logic:
- Today's question queue (SRS reviews + adaptive new questions)
- Attempt recording + SRS update
- Per-subject mastery
- QBank exam session management
"""
import uuid
import random
from datetime import date, datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func, distinct, Integer

from app.models.qbank import Question, QuestionAttempt, SRSState, QBankExamSession
from app.services import srs_service
from app.schemas.qbank import AttemptResult, MasteryOut, SubjectListOut, SubtopicMasteryOut

SRS_REVIEW_LIMIT = 4    # max SRS reviews per day queue
QUEUE_TOTAL = 10        # total questions per daily queue
EXAM_MAX_QUESTIONS = 100


# ─── Today's Queue ────────────────────────────────────────────────────────────

def get_due_srs_questions(db: Session, student_id: int) -> list[Question]:
    """Return approved questions with SRS state due today, up to SRS_REVIEW_LIMIT."""
    today = date.today()
    stmt = (
        select(Question)
        .join(SRSState, SRSState.question_id == Question.id)
        .where(
            SRSState.student_id == student_id,
            SRSState.next_review <= today,
            Question.status == "approved",
        )
        .limit(SRS_REVIEW_LIMIT)
    )
    return list(db.execute(stmt).scalars().all())


def _get_subtopic_accuracy(db: Session, student_id: int) -> dict[str, float]:
    """
    Return per-subtopic attempt accuracy as {subtopic: rate} where rate is 0.0–1.0.
    Used to bias new-question sampling toward weak subtopics.
    """
    stmt = (
        select(
            Question.subtopic,
            func.count(QuestionAttempt.id).label("total"),
            func.sum(QuestionAttempt.is_correct.cast(Integer)).label("correct"),
        )
        .join(Question, QuestionAttempt.question_id == Question.id)
        .where(QuestionAttempt.student_id == student_id)
        .group_by(Question.subtopic)
    )
    rows = db.execute(stmt).all()
    return {
        r.subtopic: (r.correct / r.total) if r.total else 1.0
        for r in rows
        if r.subtopic
    }


def _weighted_sample(questions: list[Question], subtopic_accuracy: dict[str, float], k: int) -> list[Question]:
    """
    Sample k questions without replacement, biased toward weak subtopics.
    rate 0.0 → weight 3.0, rate 1.0 → weight 0.3, no history → weight 1.0.
    """
    if not questions:
        return []
    k = min(k, len(questions))

    def weight(q: Question) -> float:
        if q.subtopic and q.subtopic in subtopic_accuracy:
            rate = subtopic_accuracy[q.subtopic]
            return 3.0 - 2.7 * rate
        return 1.0

    weights = [weight(q) for q in questions]
    return random.choices(questions, weights=weights, k=k)


def get_new_questions(
    db: Session, student_id: int, k: int, exclude_ids: set
) -> list[Question]:
    """Return k approved questions not yet seen by this student, weighted by weak subtopics."""
    stmt = (
        select(Question)
        .where(
            Question.status == "approved",
            Question.id.not_in(list(exclude_ids)) if exclude_ids else True,
        )
        .order_by(func.random())      # shuffle pool before sampling
        .limit(k * 5)                 # fetch a bigger pool for weighted sampling
    )
    pool = list(db.execute(stmt).scalars().all())
    subtopic_acc = _get_subtopic_accuracy(db, student_id)
    return _weighted_sample(pool, subtopic_acc, k)


def build_today_queue(db: Session, student_id: int) -> tuple[list[Question], int]:
    """
    Build today's question queue: up to SRS_REVIEW_LIMIT reviews, then fill to QUEUE_TOTAL with new questions.
    Returns (questions, srs_due_count).
    """
    srs_qs = get_due_srs_questions(db, student_id)
    srs_due_count = len(srs_qs)
    remaining = QUEUE_TOTAL - srs_due_count
    exclude = {q.id for q in srs_qs}
    new_qs = get_new_questions(db, student_id, remaining, exclude) if remaining > 0 else []
    return srs_qs + new_qs, srs_due_count


# ─── Attempt Recording ────────────────────────────────────────────────────────

def record_attempt(
    db: Session, student_id: int, question_id: uuid.UUID, selected_key: str
) -> AttemptResult:
    """
    Save attempt, update or create SRS state, return result with correct_key + explanation.
    """
    question = db.get(Question, question_id)
    if not question:
        raise ValueError(f"Question {question_id} not found")

    is_correct = selected_key.upper() == question.correct_key.upper()

    attempt = QuestionAttempt(
        student_id=student_id,
        question_id=question_id,
        is_correct=is_correct,
    )
    db.add(attempt)

    # Only enter SRS on first wrong answer; subsequent updates always apply
    srs = db.get(SRSState, (student_id, question_id))
    if srs is None and not is_correct:
        # First wrong answer — initialise SRS state
        srs = SRSState(
            student_id=student_id,
            question_id=question_id,
            next_review=date.today(),
        )
        db.add(srs)
        db.flush()

    if srs is not None:
        srs_service.review(srs, is_correct)

    db.commit()
    return AttemptResult(
        is_correct=is_correct,
        correct_key=question.correct_key,
        explanation=question.explanation,
    )


# ─── Mastery ──────────────────────────────────────────────────────────────────

def get_mastery(db: Session, student_id: int) -> list[MasteryOut]:
    """Return per-subject attempt statistics across both temel and klinik tracks."""
    stmt = (
        select(
            Question.subject,
            Question.test,
            func.count(QuestionAttempt.id).label("attempts"),
            func.sum(QuestionAttempt.is_correct.cast(Integer)).label("correct"),
        )
        .join(Question, QuestionAttempt.question_id == Question.id)
        .where(QuestionAttempt.student_id == student_id)
        .group_by(Question.subject, Question.test)
        .order_by(Question.test, Question.subject)
    )
    rows = db.execute(stmt).all()
    return [
        MasteryOut(
            subject=r.subject,
            test=r.test,
            attempts=r.attempts,
            correct=r.correct or 0,
            rate=round((r.correct or 0) / r.attempts, 4) if r.attempts else 0.0,
        )
        for r in rows
    ]


# ─── Subjects List ────────────────────────────────────────────────────────────

def get_subjects_list(db: Session) -> list[SubjectListOut]:
    """Return distinct subjects with their subtopics from approved questions."""
    stmt = (
        select(Question.subject, Question.subtopic)
        .where(Question.status == "approved")
        .distinct()
        .order_by(Question.subject, Question.subtopic)
    )
    rows = db.execute(stmt).all()

    # Group subtopics by subject
    grouped: dict[str, list[str]] = {}
    for row in rows:
        subject = row.subject
        subtopic = row.subtopic
        if subject not in grouped:
            grouped[subject] = []
        if subtopic:
            grouped[subject].append(subtopic)

    return [
        SubjectListOut(subject=subject, subtopics=subtopics)
        for subject, subtopics in grouped.items()
    ]


# ─── Drill Mode ───────────────────────────────────────────────────────────────

def get_drill_questions(
    db: Session,
    student_id: int,
    subject: str,
    subtopic: Optional[str] = None,
    limit: int = 10,
) -> list[Question]:
    """
    Return up to `limit` approved questions for the given subject/subtopic,
    excluding questions answered correctly in the last 7 days.
    """
    cutoff = date.today() - timedelta(days=7)

    # Find question IDs answered correctly in the last 7 days
    recent_correct_stmt = (
        select(QuestionAttempt.question_id)
        .join(Question, QuestionAttempt.question_id == Question.id)
        .where(
            QuestionAttempt.student_id == student_id,
            QuestionAttempt.is_correct.is_(True),
            QuestionAttempt.answered_at >= cutoff,
        )
    )
    recent_correct_ids = {row[0] for row in db.execute(recent_correct_stmt).all()}

    filters = [
        Question.status == "approved",
        Question.subject == subject,
    ]
    if subtopic:
        filters.append(Question.subtopic == subtopic)
    if recent_correct_ids:
        filters.append(Question.id.not_in(list(recent_correct_ids)))

    stmt = select(Question).where(*filters).order_by(func.random()).limit(limit)
    return list(db.execute(stmt).scalars().all())


# ─── Subtopic Mastery ─────────────────────────────────────────────────────────

def get_subtopic_mastery(
    db: Session, student_id: int, subject: str
) -> list[SubtopicMasteryOut]:
    """Return per-subtopic attempt accuracy for a given subject."""
    stmt = (
        select(
            Question.subtopic,
            func.count(QuestionAttempt.id).label("attempts"),
            func.sum(QuestionAttempt.is_correct.cast(Integer)).label("correct"),
        )
        .join(Question, QuestionAttempt.question_id == Question.id)
        .where(
            QuestionAttempt.student_id == student_id,
            Question.subject == subject,
            Question.subtopic.is_not(None),
        )
        .group_by(Question.subtopic)
        .order_by(Question.subtopic)
    )
    rows = db.execute(stmt).all()
    return [
        SubtopicMasteryOut(
            subtopic=r.subtopic,
            attempts=r.attempts,
            correct=r.correct or 0,
            rate=round((r.correct or 0) / r.attempts, 4) if r.attempts else 0.0,
        )
        for r in rows
    ]


# ─── QBank Exam Sessions ──────────────────────────────────────────────────────

def start_exam_session(db: Session, student_id: int, test_type: str) -> QBankExamSession:
    """Create a new timed exam session with up to EXAM_MAX_QUESTIONS approved questions."""
    stmt = (
        select(Question.id)
        .where(Question.status == "approved", Question.test == test_type)
        .order_by(func.random())
        .limit(EXAM_MAX_QUESTIONS)
    )
    question_ids = [str(qid) for qid in db.execute(stmt).scalars().all()]

    session = QBankExamSession(
        student_id=student_id,
        test_type=test_type,
        question_ids=question_ids,
        answers={},
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def submit_exam_session(
    db: Session, session: QBankExamSession, answers: dict[str, str]
) -> QBankExamSession:
    """
    Score answers and persist result. Idempotent — double-submit returns the same result.
    answers: {question_id_str: selected_key}
    """
    if session.submitted_at is not None:
        return session

    # Look up correct keys for all questions in one query
    qids = [uuid.UUID(qid) for qid in session.question_ids]
    stmt = select(Question.id, Question.correct_key, Question.subject).where(
        Question.id.in_(qids)
    )
    rows = {str(r.id): (r.correct_key, r.subject) for r in db.execute(stmt).all()}

    total = len(qids)
    correct_count = 0
    by_subject: dict[str, dict] = {}

    for qid_str in session.question_ids:
        correct_key, subject = rows.get(qid_str, (None, "bilinmiyor"))
        if subject not in by_subject:
            by_subject[subject] = {"correct": 0, "total": 0}
        by_subject[subject]["total"] += 1
        selected = answers.get(qid_str, "").upper()
        if correct_key and selected == correct_key.upper():
            correct_count += 1
            by_subject[subject]["correct"] += 1

    session.answers = answers
    session.submitted_at = datetime.utcnow()
    session.score_pct = round(correct_count / total * 100, 2) if total else 0.0
    session.by_subject = by_subject
    db.commit()
    db.refresh(session)
    return session
