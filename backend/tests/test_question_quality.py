"""
Unit tests for the question originality guard, structural validation, and the
generate→validate→originality→verify→retry orchestration.

Pure-Python: no DB session and no live LLM. The orchestration tests monkeypatch
the two LLM-calling helpers in ai_service.
"""
from unittest.mock import patch

from app.services import question_quality as qq


# ── Lexical primitives ─────────────────────────────────────────────────────────

def test_ngram_jaccard_bounds():
    a = qq.tokens("glikoliz yolağında hız kısıtlayıcı enzim fosfofruktokinaz")
    assert qq.ngram_jaccard(a, a, n=3) == 1.0
    b = qq.tokens("kardiyak output artışı pulmoner ödem gelişimi")
    assert qq.ngram_jaccard(a, b, n=3) == 0.0


def test_longest_common_run():
    a = qq.tokens("hasta acil servise göğüs ağrısı ile başvurdu troponin yüksek")
    b = qq.tokens("başka bir hasta acil servise göğüs ağrısı ile başvurdu farklı")
    # Stopword "ile" is dropped from both → contiguous run is
    # "hasta acil servise göğüs ağrısı başvurdu" = 6 content words.
    assert qq.longest_common_run(a, b) >= 6


def test_normalize_turkish_casing():
    # İ/I handling: uppercased form must fold to the lowercase token.
    assert qq.normalize_tr("İLAÇ") == qq.normalize_tr("ilaç")


# ── Originality guard ───────────────────────────────────────────────────────────

_SOURCE = {
    "id": "src1",
    "stem": ("Kırk beş yaşında erkek hasta iki saattir devam eden göğüs ağrısı ile "
             "acil servise başvurdu yapılan değerlendirmede troponin düzeyi yüksek saptandı"),
    "options": {"A": "Miyokard enfarktüsü", "B": "Perikardit", "C": "Reflü",
                "D": "Pnömotoraks", "E": "Aort diseksiyonu"},
}


def test_near_verbatim_copy_is_flagged():
    copy = {
        "stem": ("Elli iki yaşında erkek hasta üç saattir devam eden göğüs ağrısı ile "
                 "acil servise başvurdu yapılan değerlendirmede troponin düzeyi yüksek saptandı"),
        "options": _SOURCE["options"],
    }
    result = qq.originality_check(copy, [_SOURCE])
    assert result["is_original"] is False
    assert "src1" in (result["reason"] or "")


def test_topically_similar_but_original_passes():
    # Same subject (cardiology) but a genuinely different question — must pass.
    other = {
        "stem": ("Otuz iki yaşında kadın hasta ani başlayan nefes darlığı ile geldi "
                 "D-dimer yüksek ve BT anjiyografide pulmoner emboli izlendi"),
        "options": {"A": "Antikoagülasyon", "B": "Antibiyotik", "C": "Bronkodilatör",
                    "D": "Steroid", "E": "Diüretik"},
    }
    result = qq.originality_check(other, [_SOURCE])
    assert result["is_original"] is True


def test_completely_different_subject_passes():
    biochem = {
        "stem": "Glikoliz yolağında hız kısıtlayıcı basamağı katalizleyen enzim hangisidir",
        "options": {"A": "Heksokinaz", "B": "Fosfofruktokinaz-1", "C": "Aldolaz",
                    "D": "Enolaz", "E": "Piruvat kinaz"},
    }
    assert qq.originality_check(biochem, [_SOURCE])["is_original"] is True


# ── Structural validation ───────────────────────────────────────────────────────

def _valid_question():
    return {
        "stem": "Aşağıdakilerden hangisi glikolizin hız kısıtlayıcı enzimidir",
        "options": {"A": "Heksokinaz", "B": "Fosfofruktokinaz-1", "C": "Aldolaz",
                    "D": "Enolaz", "E": "Piruvat kinaz"},
        "correct_key": "B",
        "explanation": "Doğru Cevap: B\nAçıklama: PFK-1 glikolizin hız kısıtlayıcı enzimidir.",
    }


def test_structural_valid():
    assert qq.structural_validate(_valid_question())["valid"] is True


def test_structural_missing_option():
    q = _valid_question()
    del q["options"]["E"]
    res = qq.structural_validate(q)
    assert res["valid"] is False
    assert any("A-E" in e for e in res["errors"])


def test_structural_duplicate_options():
    q = _valid_question()
    q["options"]["C"] = q["options"]["A"]
    res = qq.structural_validate(q)
    assert res["valid"] is False
    assert any("duplicate" in e for e in res["errors"])


def test_structural_bad_key():
    q = _valid_question()
    q["correct_key"] = "F"
    res = qq.structural_validate(q)
    assert res["valid"] is False


def test_structural_explanation_key_warning():
    q = _valid_question()
    q["explanation"] = "Açıklama: enzim hız kısıtlayıcıdır."  # no letter reference
    res = qq.structural_validate(q)
    assert res["valid"] is True
    assert any("answer key" in w for w in res["warnings"])


def test_structural_length_band_warning():
    q = _valid_question()
    res = qq.structural_validate(q, length_band=(50, 80))  # stem is far shorter
    assert any("short" in w for w in res["warnings"])


# ── Orchestration: generate → validate → originality → verify → retry ───────────

def test_generation_retries_past_near_duplicate():
    from app.services import ai_service

    dup = {
        "stem": _SOURCE["stem"],  # exact copy → originality reject
        "options": _SOURCE["options"],
        "correct_key": "A",
        "explanation": "Doğru Cevap: A\nAçıklama: tipik STEMI tablosu.",
    }
    good = _valid_question()
    sequence = [dup, good]

    def fake_generate(*_args, **_kwargs):
        return sequence.pop(0)

    with patch.object(ai_service, "_generate_raw_question", side_effect=fake_generate), \
         patch.object(ai_service, "verify_question", return_value={"verdict": "pass", "issues": [], "corrected": None}):
        q = ai_service.generate_tus_question(
            subject="Biyokimya", subtopic="Glikoliz", test_type="temel",
            difficulty_label="3", db=None, verify=True,
            originality_corpus=[_SOURCE], max_retries=3,
        )

    assert q.correct_key == "B"             # the 'good' question won
    assert q._attempts == 2                 # first attempt was rejected
    assert q._originality_score >= 0.0
    assert q._review_verdict == "pass"


def test_verifier_fix_is_applied():
    from app.services import ai_service

    raw = _valid_question()
    raw["correct_key"] = "A"  # wrong; verifier will correct to B
    corrected = _valid_question()  # correct_key B

    with patch.object(ai_service, "_generate_raw_question", return_value=raw), \
         patch.object(ai_service, "verify_question",
                      return_value={"verdict": "fix", "issues": ["yanlış anahtar"], "corrected": corrected}):
        q = ai_service.generate_tus_question(
            subject="Biyokimya", subtopic="Glikoliz", test_type="temel",
            difficulty_label="3", db=None, verify=True,
            originality_corpus=[], max_retries=1,
        )

    assert q.correct_key == "B"
    assert q._review_verdict == "fix"


def test_generation_gives_up_after_retries():
    from app.services import ai_service
    import pytest

    dup = {
        "stem": _SOURCE["stem"],
        "options": _SOURCE["options"],
        "correct_key": "A",
        "explanation": "Doğru Cevap: A\nAçıklama: x.",
    }
    with patch.object(ai_service, "_generate_raw_question", return_value=dup), \
         patch.object(ai_service, "verify_question", return_value={"verdict": "pass", "issues": [], "corrected": None}):
        with pytest.raises(ValueError, match="acceptable question"):
            ai_service.generate_tus_question(
                subject="Kardiyoloji", subtopic="KAH", test_type="klinik",
                difficulty_label="3", db=None, verify=False,
                originality_corpus=[_SOURCE], max_retries=2,
            )
