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
Görevin: Türkiye Tıpta Uzmanlık Sınavı formatına tam uygun, yüksek kaliteli sorular üretmektir.

ZORUNLU KURALLAR:
1. DİL: Tüm metin Türkçe olmalıdır. İSTİSNA: Türkçeye çevrilemeyen veya çevrildiğinde tıbbi anlamını yitiren terimler (örn. "Vmax", "Km", "HbA1c", "PCR", "pH") orijinal haliyle kullanılabilir.
2. FORMAT: Tam olarak 5 seçenek (A, B, C, D, E) içeren çoktan seçmeli format. Yalnızca bir seçenek kesinlikle doğru olmalı; diğerleri medikal açıdan makul ama yanlış olmalıdır.
3. TUS UYUMU: Soru gövdesi (stem) gerçek TUS sınavı tarzında olmalıdır — klinik vaka sunumu, laboratuvar bulgusu yorumu veya temel bilim mekanizması sorusu şeklinde.
4. AÇIKLAMA: Explanation alanı şu formatta olmalıdır:
   "Doğru Cevap: [A/B/C/D/E]\nAçıklama: [tıbbi gerçeklere dayalı, doğru seçeneği ve diğerlerinin neden yanlış olduğunu açıklayan 3-4 cümle]"
5. ZORLUK: İstenen zorluk seviyesine (1-5) kesinlikle uyulmalıdır.

ÇIKTI FORMATI — yalnızca geçerli JSON, başka hiçbir şey ekleme:
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
  "explanation": "Doğru Cevap: <harf>\\nAçıklama: <açıklama metni>"
}"""

_QUESTION_USER_TEMPLATE = """\
Lütfen şu parametrelerle bir TUS sorusu üret:
- Sınav türü: {test_type} ({test_type_label})
- Ders: {subject}
- Konu: {subtopic}
- Zorluk seviyesi: {difficulty_label}/5 — {difficulty_desc}

Sadece JSON döndür."""

_TEST_TYPE_LABELS = {
    "temel": "Temel Tıp Bilimleri",
    "klinik": "Klinik Tıp Bilimleri",
}
_DIFFICULTY_DESCRIPTIONS = {
    "1": "çok kolay — temel tanımlar ve ezber bilgi, sınava yeni başlayanlar için",
    "2": "kolay — kavram anlama, basit mekanizma soruları",
    "3": "orta — standart TUS zorluk seviyesi, konsept uygulaması ve yorum",
    "4": "zor — ileri analiz, ayırıcı tanı, çok adımlı klinik akıl yürütme",
    "5": "çok zor — nadir durumlar, karmaşık senaryo, birden fazla kavramın entegrasyonu",
}

# Instruction appended to the generation prompt to enforce ORIGINALITY —
# resemble the reference style, never reproduce a reference question.
_ORIGINALITY_INSTRUCTION = """\
ÖZGÜNLÜK KURALI (ÇOK ÖNEMLİ):
- Referans sorular yalnızca TARZ, UZUNLUK ve ZORLUK örneğidir. ASLA kopyalanmaz.
- Aynı klinik senaryoyu, aynı hasta verilerini, aynı sayısal değerleri veya aynı
  cümle yapılarını tekrar KULLANMA. Özgün bir vaka, özgün değerler ve özgün ifade kur.
- Aynı tıbbi kavramı farklı bir sunum, farklı bir hasta ve farklı sayılarla sorabilirsin;
  bu normaldir. Yasak olan, mevcut bir sorunun yeniden ifade edilmiş (reworded) halidir."""

# ── Medical/logical verification (reviewer) prompt ────────────────────────────

_VERIFY_SYSTEM_PROMPT = """\
Sen kıdemli bir TUS soru denetçisisin (tıp fakültesi öğretim üyesi).
Görevin: Sana verilen TUS sorusunu TIBBİ ve MANTIKSAL açıdan denetlemek.

Kontrol listesi:
1. TIBBİ DOĞRULUK: Soru gövdesindeki tüm tıbbi bilgiler güncel ve doğru mu?
2. TEK DOĞRU CEVAP: Belirtilen correct_key gerçekten TEK doğru seçenek mi?
   Başka bir seçenek de doğru/kısmen doğru olabiliyorsa bu bir HATADIR.
3. ÇELDİRİCİ KALİTESİ: Diğer seçenekler tıbben makul ama kesin yanlış mı?
   (Saçma/alakasız çeldirici → düşük kalite.)
4. AÇIKLAMA TUTARLILIĞI: Açıklama, belirtilen doğru cevabı destekliyor mu?
   Açıklama ile correct_key çelişiyorsa HATADIR.
5. MANTIK: Soru kendi içinde tutarlı mı; eksik/çelişkili veri var mı?

ÇIKTI — yalnızca geçerli JSON:
{
  "verdict": "pass | fix | reject",
  "issues": ["<bulunan sorunlar, yoksa boş liste>"],
  "corrected": null  // veya düzeltilmiş tam soru {stem, options{A..E}, correct_key, explanation}
}
Kurallar:
- Soru tıbben ve mantıken doğruysa → "pass", corrected=null.
- Küçük düzeltmelerle kurtarılabiliyorsa → "fix" ve corrected içinde DÜZELTİLMİŞ tam soru.
- Temelden hatalıysa (yanlış cevap anahtarı mantığı, birden fazla doğru, yanlış tıbbi önerme) → "reject"."""

# ── Classification prompt ─────────────────────────────────────────────────────

_CLASSIFY_SYSTEM_PROMPT = """\
Sen uzman bir TUS (Tıpta Uzmanlık Sınavı) sorusu analiz uzmanısın.
Görevin: Verilen TUS sorusunu analiz edip sınıflandırmak.

ÇIKTI FORMATI — yalnızca geçerli JSON:
{
  "test_type": "temel veya klinik",
  "subject": "Ders adı (örn. Biyokimya, Fizyoloji, Dahiliye, Kardiyoloji)",
  "subtopic": "Alt konu / konu başlığı (örn. Enzim Kinetiği, Kalp Yetmezliği)",
  "difficulty": "1-5 arası rakam (1=çok kolay, 5=çok zor)",
  "difficulty_reason": "Bu zorluğu seçme gerekçesi (1-2 cümle)",
  "style": "soru tarzı özeti (örn. klinik vaka, mekanizma sorusu, laboratuvar yorumu)"
}

SINIFLANDIRMA KILAVUZU:
- test_type: Temel bilimleri (anatomi, biyokimya, fizyoloji, histoloji, mikrobiyoloji, patoloji, farmakoloji, biyofizik) → "temel"; Klinik branşları → "klinik"
- difficulty 1: Direkt tanım/ezber sorusu
- difficulty 2: Basit kavram uygulama, tek adım
- difficulty 3: Standart TUS — klinik vaka + 1-2 adım yorumlama
- difficulty 4: Karmaşık vaka, ayırıcı tanı, birden fazla kavram
- difficulty 5: Nadir durum, çok adımlı akıl yürütme, entegrasyon sorusu"""

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


def _build_few_shot_block(db: Session, subject: str, subtopic: str, test_type: str, n: int = 3) -> str:
    """
    Fetch up to N approved questions matching the target subject/type and format
    them as a few-shot example block to inject into the generation prompt.
    Returns an empty string if no examples are found.
    """
    from app.models.qbank import Question as Q
    from sqlalchemy import func

    if db is None:
        return ""

    try:
        base = db.query(Q).filter(Q.status == "approved", Q.test == test_type, Q.subject == subject)

        # Prefer exact subtopic match; pad with other subtopics from same subject
        examples = []
        if subtopic:
            exact = base.filter(Q.subtopic == subtopic).order_by(func.random()).limit(n).all()
            examples.extend(exact)
            if len(examples) < n:
                ids_used = [e.id for e in examples]
                others = (
                    base.filter(Q.id.notin_(ids_used))
                    .order_by(func.random())
                    .limit(n - len(examples))
                    .all()
                )
                examples.extend(others)
        else:
            examples = base.order_by(func.random()).limit(n).all()

        if not examples:
            return ""

        lines = ["\nREFERANS TUS SORULARI (aşağıdaki soru tarzı, format ve zorluk seviyesini incele ve benzer kalitede yeni bir soru yaz — aynı soruyu kopyalama):\n"]
        for i, ex in enumerate(examples, 1):
            opts = "\n".join(f"  {k}) {v}" for k, v in sorted(ex.options.items()))
            lines.append(f"--- ÖRNEK {i} ---")
            lines.append(f"Ders: {ex.subject} | Konu: {ex.subtopic or '-'} | Zorluk: {ex.difficulty_label or '?'}/5")
            lines.append(ex.stem)
            lines.append(opts)
            if ex.explanation:
                lines.append(ex.explanation)
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        logger.warning("Few-shot fetch failed: %s", exc)
        return ""


def _parse_llm_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rstrip("`").strip()
    return json.loads(raw)


def _get_llm_client():
    from openai import OpenAI
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.LLM_API_KEY:
        raise RuntimeError("LLM_API_KEY is not configured. Set it in backend/.env.")
    return OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL), settings


# ── Exam-length calibration (populated by scripts/calibrate_corpus.py) ─────────

_CORPUS_STATS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "scripts", "corpus_stats.json",
)


def _load_corpus_stats(path: str = None) -> dict:
    """Load per-subject/difficulty length bands; empty dict if not calibrated."""
    try:
        with open(path or _CORPUS_STATS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def length_band_for(stats: dict, test_type: str, subject: str, difficulty_label: str):
    """Most specific (lo, hi) stem word-count band available, else None."""
    if not stats:
        return None
    for key in (f"{test_type}|{subject}|{difficulty_label}", f"{test_type}|{subject}", "__global__"):
        band = stats.get(key)
        if band and "lo" in band and "hi" in band:
            return (band["lo"], band["hi"])
    return None


def _generate_raw_question(
    subject, subtopic, test_type, difficulty_label, db=None, length_band=None,
) -> dict:
    """One LLM generation call → normalized raw question dict (no validation)."""
    client, settings = _get_llm_client()

    few_shot = _build_few_shot_block(db, subject, subtopic, test_type)
    system_prompt = _QUESTION_SYSTEM_PROMPT + "\n" + _ORIGINALITY_INSTRUCTION
    if few_shot:
        system_prompt += "\n" + few_shot

    user_prompt = _QUESTION_USER_TEMPLATE.format(
        test_type=test_type,
        test_type_label=_TEST_TYPE_LABELS.get(test_type, test_type),
        subject=subject,
        subtopic=subtopic or subject,
        difficulty_label=difficulty_label,
        difficulty_desc=_DIFFICULTY_DESCRIPTIONS.get(difficulty_label, ""),
    )
    if length_band:
        user_prompt += f"\n- Hedef gövde uzunluğu: yaklaşık {length_band[0]}-{length_band[1]} kelime."

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )
    if not response.choices:
        raise ValueError("LLM returned empty choices")
    try:
        data = _parse_llm_json(response.choices[0].message.content or "")
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM did not return valid JSON: {exc}")

    options = data.get("options") or {}
    return {
        "stem": (data.get("stem") or "").strip(),
        "options": {str(k).upper(): str(v).strip() for k, v in options.items()},
        "correct_key": (data.get("correct_key") or "").strip().upper(),
        "explanation": (data.get("explanation") or "").strip() or None,
    }


def verify_question(question: dict) -> dict:
    """
    Medical/logical review of a raw question via a second LLM pass.
    Returns {"verdict": "pass|fix|reject", "issues": [...], "corrected": dict|None}.
    """
    client, settings = _get_llm_client()

    opts = "\n".join(f"  {k}) {v}" for k, v in sorted((question.get("options") or {}).items()))
    user_content = (
        f"Aşağıdaki soruyu denetle:\n\n"
        f"{question.get('stem', '')}\n{opts}\n"
        f"Belirtilen doğru cevap: {question.get('correct_key', '?')}\n"
        f"Açıklama: {question.get('explanation') or '-'}"
    )
    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": _VERIFY_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )
    if not response.choices:
        raise ValueError("Verifier returned empty choices")
    data = _parse_llm_json(response.choices[0].message.content or "")

    verdict = str(data.get("verdict") or "").strip().lower()
    if verdict not in {"pass", "fix", "reject"}:
        verdict = "reject"
    return {
        "verdict": verdict,
        "issues": data.get("issues") or [],
        "corrected": data.get("corrected"),
    }


def _normalize_raw(raw: dict, fallback: dict) -> dict:
    """Normalize a (possibly corrected) raw question, filling from fallback."""
    options = raw.get("options") or fallback.get("options") or {}
    return {
        "stem": (raw.get("stem") or fallback.get("stem") or "").strip(),
        "options": {str(k).upper(): str(v).strip() for k, v in options.items()},
        "correct_key": (raw.get("correct_key") or fallback.get("correct_key") or "").strip().upper(),
        "explanation": (raw.get("explanation") or fallback.get("explanation") or "").strip() or None,
    }


def generate_tus_question(
    subject: str,
    subtopic: str,
    test_type: str,
    difficulty_label: str,
    db: Session = None,
    *,
    verify: bool = False,
    originality_corpus=None,
    originality_thresholds: dict = None,
    length_band=None,
    max_retries: int = 3,
) -> "Question":
    """
    Generate one original, exam-calibrated TUS question and return an unsaved
    Question ORM object (status='draft').

    Pipeline per attempt: generate → structural validation → originality guard
    (if `originality_corpus` given) → medical/logical verification (if `verify`),
    retrying up to `max_retries` times on any failure.

    When `db` is provided, approved questions guide style via few-shot examples.
    `length_band` defaults to the calibrated band for this subject/difficulty.

    The returned object carries transient (non-persisted) attributes for logging:
    `_originality_score`, `_review_verdict`, `_review_issues`,
    `_quality_warnings`, `_attempts`.
    """
    from app.models.qbank import Question
    from app.services import question_quality as qq

    if length_band is None:
        length_band = length_band_for(_load_corpus_stats(), test_type, subject, difficulty_label)

    corpus = list(originality_corpus or [])
    last_error = None
    attempts = 0

    for attempt in range(1, max_retries + 2):   # 1 initial try + max_retries
        attempts = attempt
        try:
            raw = _generate_raw_question(
                subject, subtopic, test_type, difficulty_label, db=db, length_band=length_band,
            )
        except (ValueError, RuntimeError) as exc:
            last_error = f"generation: {exc}"
            logger.warning("Attempt %d generation failed: %s", attempt, exc)
            continue

        sv = qq.structural_validate(raw, length_band=length_band)
        if not sv["valid"]:
            last_error = "structural: " + "; ".join(sv["errors"])
            logger.info("Attempt %d rejected (%s)", attempt, last_error)
            continue
        warnings_acc = sv["warnings"]

        orig = {"is_original": True, "score": 0.0, "reason": None}
        if corpus:
            orig = qq.originality_check(raw, corpus, thresholds=originality_thresholds)
            if not orig["is_original"]:
                last_error = "originality: " + (orig["reason"] or "")
                logger.info("Attempt %d rejected (%s)", attempt, last_error)
                continue

        review_verdict, review_issues = "skipped", []
        if verify:
            try:
                review = verify_question(raw)
            except (ValueError, RuntimeError) as exc:
                last_error = f"verify-error: {exc}"
                logger.warning("Attempt %d verify failed: %s", attempt, exc)
                continue
            review_verdict, review_issues = review["verdict"], review["issues"]

            if review_verdict == "reject":
                last_error = "verify-reject: " + "; ".join(str(i) for i in review_issues)
                logger.info("Attempt %d rejected (%s)", attempt, last_error)
                continue

            if review_verdict == "fix" and review.get("corrected"):
                fixed = _normalize_raw(review["corrected"], raw)
                sv2 = qq.structural_validate(fixed, length_band=length_band)
                if not sv2["valid"]:
                    last_error = "verify-fix-invalid: " + "; ".join(sv2["errors"])
                    continue
                if corpus:
                    orig2 = qq.originality_check(fixed, corpus, thresholds=originality_thresholds)
                    if not orig2["is_original"]:
                        last_error = "originality-after-fix: " + (orig2["reason"] or "")
                        continue
                    orig = orig2
                raw, warnings_acc = fixed, sv2["warnings"]

        q = Question(
            test=test_type,
            subject=subject,
            subtopic=subtopic or None,
            difficulty_label=difficulty_label,
            stem=raw["stem"],
            options=raw["options"],
            correct_key=raw["correct_key"],
            explanation=raw["explanation"],
            status="draft",
        )
        q._originality_score = round(orig.get("score", 0.0), 3)
        q._review_verdict = review_verdict
        q._review_issues = review_issues
        q._quality_warnings = warnings_acc
        q._attempts = attempts
        return q

    raise ValueError(
        f"Failed to produce an acceptable question after {attempts} attempt(s). "
        f"Last issue: {last_error}"
    )


def classify_question(raw_question: dict) -> dict:
    """
    Classify a raw question (stem + options + correct_key) via LLM.
    Returns a dict with: test_type, subject, subtopic, difficulty, difficulty_reason, style.
    """
    client, settings = _get_llm_client()

    opts = "\n".join(
        f"  {k}) {v}" for k, v in sorted((raw_question.get("options") or {}).items())
    )
    user_content = (
        f"Soruyu analiz et ve sınıflandır:\n\n"
        f"{raw_question.get('stem', '')}\n{opts}\n"
        f"Doğru cevap: {raw_question.get('correct_key', '?')}\n"
        + (f"Mevcut açıklama: {raw_question['explanation']}" if raw_question.get("explanation") else "")
    )

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": _CLASSIFY_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )

    if not response.choices:
        raise ValueError("LLM returned empty choices during classification")

    try:
        return _parse_llm_json(response.choices[0].message.content or "")
    except json.JSONDecodeError as exc:
        raise ValueError(f"Classification JSON parse failed: {exc}")


_CLASSIFY_BATCH_SYSTEM_PROMPT = """\
Sen uzman bir TUS (Tıpta Uzmanlık Sınavı) sorusu analiz uzmanısın.
Görevin: Verilen birden fazla TUS sorusunu tek seferde analiz edip sınıflandırmak.

ÇIKTI FORMATI — yalnızca geçerli JSON, başka hiçbir şey ekleme:
{
  "results": [
    {
      "index": <sorunun 0-tabanlı sırası>,
      "test_type": "temel veya klinik",
      "subject": "Ders adı",
      "subtopic": "Alt konu / konu başlığı",
      "difficulty": "1-5 arası rakam",
      "difficulty_reason": "Bu zorluğu seçme gerekçesi (1 cümle)",
      "style": "soru tarzı özeti"
    },
    ...
  ]
}

SINIFLANDIRMA KILAVUZU:
- test_type: Temel bilimleri → "temel"; Klinik branşları → "klinik"
- difficulty 1: Direkt tanım/ezber
- difficulty 2: Basit kavram uygulama
- difficulty 3: Standart TUS — klinik vaka + 1-2 adım yorumlama
- difficulty 4: Karmaşık vaka, ayırıcı tanı
- difficulty 5: Nadir durum, çok adımlı akıl yürütme"""


def classify_questions_batch(raw_questions: list[dict]) -> list[dict]:
    """
    Classify a batch of questions in a single LLM call.
    Returns a list of tag dicts in the same order as input.
    Raises ValueError if LLM response can't be parsed.
    """
    if not raw_questions:
        return []

    client, settings = _get_llm_client()

    blocks = []
    for i, q in enumerate(raw_questions):
        opts = "\n".join(
            f"  {k}) {v}" for k, v in sorted((q.get("options") or {}).items())
        )
        blocks.append(
            f"--- SORU {i} ---\n"
            f"{q.get('stem', '')}\n{opts}\n"
            f"Doğru cevap: {q.get('correct_key', '?')}"
        )
    user_content = "\n\n".join(blocks) + "\n\nYukarıdaki tüm soruları tek JSON çıktısıyla sınıflandır."

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": _CLASSIFY_BATCH_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )

    if not response.choices:
        raise ValueError("LLM returned empty choices during batch classification")

    data = _parse_llm_json(response.choices[0].message.content or "")
    results_list = data.get("results", [])

    # Build index-keyed map for safe ordering
    by_index = {r.get("index", i): r for i, r in enumerate(results_list)}
    return [by_index.get(i, {}) for i in range(len(raw_questions))]


def generate_coach_report(workflow_name: str, context: dict) -> CoachReportOut:
    """
    Generates a report for the coach.
    """
    # Same logic for provider fallback
    return _stub_coach_report(workflow_name, context)
