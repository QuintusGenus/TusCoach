"""
Question quality & originality utilities.

Three concerns, all pure-Python (no LLM, no DB) so they are cheap and testable:

1. Originality guard — lexical near-duplicate detection against a corpus of
   source questions. Tuned to catch *near-verbatim reuse* (the copyright risk),
   NOT topical resemblance: two independent questions about the same disease
   should pass; a reworded copy should not.

2. Structural validation — the mechanical correctness a question must have
   regardless of medical content: exactly 5 distinct options A-E, a valid
   answer key, an explanation that points at that key, a stem whose length sits
   in the exam's empirical band, and no "longest option is the answer" giveaway.

3. Length banding helpers used by the generator to target exam-realistic length.

The medical/logical correctness check lives in ai_service.verify_question()
because it needs the LLM; everything here is deterministic.
"""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable, Optional

# ── Normalization ─────────────────────────────────────────────────────────────

# Turkish-specific lowercasing: İ→i, I→ı before a generic casefold so that
# e.g. "İLAÇ" and "ilaç" compare equal.
_TR_UPPER_MAP = str.maketrans({"İ": "i", "I": "ı", "Ş": "ş", "Ğ": "ğ", "Ü": "ü", "Ö": "ö", "Ç": "ç"})

# Very common Turkish function words — stripped so shared filler doesn't inflate
# similarity. Deliberately small: we want to keep medical terms.
_STOPWORDS = {
    "ve", "ile", "bir", "bu", "da", "de", "ki", "mi", "mı", "mu", "mü",
    "için", "olan", "olarak", "en", "daha", "çok", "gibi", "ya", "veya",
    "hangisi", "hangisidir", "aşağıdakilerden", "aşağıdakilerin",
}


def normalize_tr(text: str) -> str:
    """Lowercase (Turkish-aware), strip punctuation, collapse whitespace."""
    if not text:
        return ""
    text = text.translate(_TR_UPPER_MAP).lower()
    # Drop combining marks folding is intentionally NOT applied — ü vs u is a
    # real distinction in Turkish. Just remove punctuation and symbols.
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in ("L", "N"):      # letters, numbers
            out.append(ch)
        elif ch.isspace():
            out.append(" ")
        else:
            out.append(" ")
    return re.sub(r"\s+", " ", "".join(out)).strip()


def tokens(text: str, *, drop_stopwords: bool = True) -> list[str]:
    toks = normalize_tr(text).split()
    if drop_stopwords:
        toks = [t for t in toks if t not in _STOPWORDS]
    return toks


# ── Lexical similarity primitives ───────────────────────────────────────────────

def word_ngrams(toks: list[str], n: int) -> set[tuple]:
    if len(toks) < n:
        return {tuple(toks)} if toks else set()
    return {tuple(toks[i : i + n]) for i in range(len(toks) - n + 1)}


def ngram_jaccard(a: list[str], b: list[str], n: int = 4) -> float:
    """Jaccard overlap of word n-gram (shingle) sets. 0 = disjoint, 1 = identical."""
    ga, gb = word_ngrams(a, n), word_ngrams(b, n)
    if not ga and not gb:
        return 0.0
    inter = len(ga & gb)
    union = len(ga | gb)
    return inter / union if union else 0.0


def longest_common_run(a: list[str], b: list[str]) -> int:
    """Length (in words) of the longest contiguous shared token run."""
    if not a or not b:
        return 0
    # Classic DP for longest common substring, on token sequences.
    prev = [0] * (len(b) + 1)
    best = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best


def char_ratio(a: str, b: str) -> float:
    """difflib similarity on normalized strings (catches reordered wording)."""
    return SequenceMatcher(None, normalize_tr(a), normalize_tr(b)).ratio()


# ── Question-level similarity & originality ────────────────────────────────────

def _opts_values(q: dict) -> list[str]:
    opts = q.get("options") or {}
    return [str(v) for _, v in sorted(opts.items())]


def pair_similarity(a: dict, b: dict, *, ngram: int = 4) -> dict:
    """All similarity signals between two questions. Higher = more similar."""
    a_tok = tokens(a.get("stem", ""))
    b_tok = tokens(b.get("stem", ""))

    # Option-level: how many options are near-identical between the two.
    a_opts = _opts_values(a)
    b_opts = _opts_values(b)
    dup_options = 0
    for ao in a_opts:
        if any(char_ratio(ao, bo) >= 0.90 for bo in b_opts):
            dup_options += 1

    return {
        "stem_jaccard": ngram_jaccard(a_tok, b_tok, ngram),
        "stem_run": longest_common_run(a_tok, b_tok),
        "stem_char_ratio": char_ratio(a.get("stem", ""), b.get("stem", "")),
        "dup_options": dup_options,
    }


# Defaults tuned toward "undoubtedly the same", not topical overlap.
#   - jaccard 0.35  : 35% of 4-word shingles shared → heavy phrasing reuse
#   - run 12        : 12+ consecutive identical words → a copied sentence
#   - char_ratio .78: near-identical stems even if lightly reordered
#   - dup_options 3 : 3+ of 5 options essentially verbatim
DEFAULT_THRESHOLDS = {
    "stem_jaccard": 0.35,
    "stem_run": 12,
    "stem_char_ratio": 0.78,
    "dup_options": 3,
}


def originality_check(
    question: dict,
    corpus: Iterable[dict],
    *,
    thresholds: Optional[dict] = None,
    ngram: int = 4,
) -> dict:
    """
    Compare `question` against every item in `corpus`.

    Returns a dict:
      {
        "is_original": bool,
        "score": float,            # worst (max) stem_jaccard seen, for logging
        "reason": str | None,      # why it was rejected, if any
        "closest": dict | None,    # signals + id of the most-similar corpus item
      }
    A question is NON-original if ANY single corpus item trips ANY threshold.
    """
    th = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    worst_score = 0.0
    closest = None
    reject_reason = None

    for item in corpus:
        sig = pair_similarity(question, item, ngram=ngram)
        if sig["stem_jaccard"] > worst_score:
            worst_score = sig["stem_jaccard"]
            closest = {**sig, "id": item.get("id")}

        tripped = []
        if sig["stem_jaccard"] >= th["stem_jaccard"]:
            tripped.append(f"4-gram Jaccard {sig['stem_jaccard']:.2f} ≥ {th['stem_jaccard']}")
        if sig["stem_run"] >= th["stem_run"]:
            tripped.append(f"shared run {sig['stem_run']} words ≥ {th['stem_run']}")
        if sig["stem_char_ratio"] >= th["stem_char_ratio"]:
            tripped.append(f"stem char-ratio {sig['stem_char_ratio']:.2f} ≥ {th['stem_char_ratio']}")
        if sig["dup_options"] >= th["dup_options"]:
            tripped.append(f"{sig['dup_options']} near-identical options ≥ {th['dup_options']}")

        if tripped:
            return {
                "is_original": False,
                "score": max(worst_score, sig["stem_jaccard"]),
                "reason": f"too similar to corpus item {item.get('id')}: " + "; ".join(tripped),
                "closest": {**sig, "id": item.get("id")},
            }

    return {"is_original": True, "score": worst_score, "reason": None, "closest": closest}


# ── Structural validation ──────────────────────────────────────────────────────

_EXPECTED_KEYS = {"A", "B", "C", "D", "E"}


def structural_validate(question: dict, *, length_band: Optional[tuple] = None) -> dict:
    """
    Mechanical, content-free checks. Returns {"valid": bool, "errors": [...],
    "warnings": [...]}. Errors mean the question must be rejected; warnings are
    advisory (e.g. answer-length giveaway) and don't by themselves fail it.
    """
    errors: list[str] = []
    warnings: list[str] = []

    stem = (question.get("stem") or "").strip()
    if not stem:
        errors.append("empty stem")

    options = question.get("options") or {}
    keys = {str(k).upper() for k in options}
    if keys != _EXPECTED_KEYS:
        errors.append(f"options must have exactly keys A-E, got {sorted(keys)}")
    else:
        values = [str(options[k]).strip() for k in sorted(options)]
        if any(not v for v in values):
            errors.append("one or more options are empty")
        # Distinctness on normalized text.
        norm = [normalize_tr(v) for v in values]
        if len(set(norm)) != len(norm):
            errors.append("duplicate option texts")

    correct_key = str(question.get("correct_key") or "").strip().upper()
    if correct_key not in _EXPECTED_KEYS:
        errors.append(f"correct_key must be A-E, got {correct_key!r}")

    explanation = (question.get("explanation") or "").strip()
    if not explanation:
        errors.append("missing explanation")
    elif correct_key in _EXPECTED_KEYS:
        # Explanation should reference the correct letter (prompt format is
        # "Doğru Cevap: <harf>"). Soft but important consistency check.
        if not re.search(rf"\b{correct_key}\b", explanation):
            warnings.append(f"explanation does not mention the answer key '{correct_key}'")

    # Answer-length giveaway: correct option shouldn't be the lone long one.
    if keys == _EXPECTED_KEYS and correct_key in _EXPECTED_KEYS:
        lengths = {k: len(str(options[k]).strip()) for k in _EXPECTED_KEYS}
        others = [v for k, v in lengths.items() if k != correct_key]
        median_other = sorted(others)[len(others) // 2] if others else 0
        if median_other and lengths[correct_key] > 1.6 * median_other:
            warnings.append("correct option is much longer than distractors (length cue)")

    # Length band (word count of stem), from corpus calibration.
    if length_band and stem:
        lo, hi = length_band
        wc = len(stem.split())
        if wc < lo:
            warnings.append(f"stem short for exam band ({wc} words < {lo})")
        elif wc > hi:
            warnings.append(f"stem long for exam band ({wc} words > {hi})")

    return {"valid": not errors, "errors": errors, "warnings": warnings}
