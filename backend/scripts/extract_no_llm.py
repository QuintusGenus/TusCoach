#!/usr/bin/env python
"""
Extract TUS questions from text-based PDFs using pure regex — no API calls.

Reads each text page, applies heuristic patterns to find numbered multiple-choice
questions with A-E options. Uses the folder name as the subject tag.

Run from backend/:
    # Dry-run: print extracted JSON
    ../venv/bin/python scripts/extract_no_llm.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS

    # Write to file without inserting to DB
    ../venv/bin/python scripts/extract_no_llm.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS \\
        --output scripts/regex_extracted.json

    # Insert directly into DB as approved reference questions
    ../venv/bin/python scripts/extract_no_llm.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS --commit

    # Specific subject folders only
    ../venv/bin/python scripts/extract_no_llm.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS \\
        --folders Biyokimya Farmakoloji --commit
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pdfplumber
except ImportError:
    print("ERROR: Run: ../venv/bin/pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

# ── Subject / test-type mappings ──────────────────────────────────────────────

FOLDER_TO_SUBJECT = {
    "Anatomi":       ("Anatomi",                              "temel"),
    "Biyokimya":     ("Biyokimya",                            "temel"),
    "Dahiliye":      ("İç Hastalıkları",                      "klinik"),
    "Denemeler":     (None,                                   "klinik"),
    "Farmakoloji":   ("Farmakoloji",                          "temel"),
    "FizyoHisto":    ("Fizyoloji",                            "temel"),
    "Genel Cerrahi": ("Genel Cerrahi",                        "klinik"),
    "Genel":         (None,                                   "klinik"),
    "Kadın Doğum":   ("Kadın Hastalıkları ve Doğum",          "klinik"),
    "Küçük Stajlar": (None,                                   "klinik"),
    "Mikrobiyoloji": ("Mikrobiyoloji",                        "temel"),
    "Patoloji":      ("Patoloji",                             "temel"),
    "Pediatri":      ("Pediatri",                             "klinik"),
    "TUS":           (None,                                   "klinik"),
}

# ── Regex patterns ─────────────────────────────────────────────────────────────

# Question start: "1." / "1-" / "1)" / "Soru 1." — at least 20 chars of stem after
_Q_START = re.compile(
    r'^(?:(?:soru\s+)?\d{1,3}[\.\-\)]\s*|(?:soru|SORU)\s*\d{1,3}\s*[:\.]?\s*)(.{20,})',
    re.IGNORECASE,
)

# Option line: "A)" / "A." / "A-" / "(A)" — captures letter and text
_OPT = re.compile(
    r'^[\(\s]*([A-Ea-e])[\)\.\-\s]+(.+)',
)

# Answer-key section header
_ANS_HEADER = re.compile(
    r'(?:cevap(?:lar)?|yanıt(?:lar)?|doğru cevap)',
    re.IGNORECASE,
)

# Inline answer key entry: "1. A" / "1- A" / "1.A" / "1-A" (at line start)
_ANS_ENTRY = re.compile(
    r'^(\d{1,3})[\.\-]\s*([A-Ea-e])\b',
    re.IGNORECASE,
)

# "Cevap: C" or "Doğru Cevap: C" appearing after an option block
_CEVAP_INLINE = re.compile(
    r'(?:doğru\s+)?cevap\s*[:=]\s*([A-Ea-e])',
    re.IGNORECASE,
)


def _normalize_opts(opts: dict) -> dict:
    return {k.upper(): v.strip() for k, v in opts.items()}


def parse_answer_keys(lines: list[str]) -> dict[int, str]:
    """Extract answer key mapping {q_num: letter} from a lines block."""
    keys: dict[int, str] = {}
    in_key_section = False
    for line in lines:
        line = line.strip()
        if _ANS_HEADER.search(line):
            in_key_section = True
            continue
        m = _ANS_ENTRY.match(line)
        if m:
            keys[int(m.group(1))] = m.group(2).upper()
    return keys


def parse_page(text: str) -> list[dict]:
    """
    Parse a single page's text into question dicts.
    Returns list of {stem, options, correct_key, explanation}.
    """
    lines = text.splitlines()

    # Pre-scan for answer keys (often at bottom of page / dedicated key page)
    answer_keys = parse_answer_keys(lines)

    questions: list[dict] = []
    current: dict | None = None
    current_num: int | None = None
    current_opt_letter: str | None = None

    def flush():
        nonlocal current, current_num, current_opt_letter
        if current is None:
            return
        opts = _normalize_opts(current.get("options", {}))
        stem = current.get("stem", "").strip()
        if stem and len(opts) == 5:
            correct = current.get("correct_key", "")
            if not correct and current_num and current_num in answer_keys:
                correct = answer_keys[current_num]
            questions.append({
                "stem": stem,
                "options": opts,
                "correct_key": correct.upper() if correct else "",
                "explanation": "",
            })
        current = None
        current_num = None
        current_opt_letter = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        # Inline "Doğru cevap: B" — capture answer and move on (BEFORE ANS_HEADER check)
        if _CEVAP_INLINE.search(line) and current is not None and len(current.get("options", {})) >= 5:
            cm = _CEVAP_INLINE.search(line)
            current["correct_key"] = cm.group(1).upper()
            continue

        # Check for answer key section header — flush current question
        if _ANS_HEADER.search(line) and not _CEVAP_INLINE.search(line):
            flush()
            continue

        # Check for new question
        qm = _Q_START.match(line)
        if qm:
            flush()
            # Extract question number
            num_m = re.match(r'^(?:soru\s+)?(\d{1,3})', line, re.IGNORECASE)
            current_num = int(num_m.group(1)) if num_m else None
            stem_text = qm.group(1).strip()
            # Extract inline answer "(B)" from end of stem line
            correct_from_stem = ""
            paren_m = re.search(r'\(([A-Ea-e])\)\s*$', stem_text)
            if paren_m:
                correct_from_stem = paren_m.group(1).upper()
                stem_text = stem_text[:paren_m.start()].strip()
            current = {"stem": stem_text, "options": {}, "correct_key": correct_from_stem}
            current_opt_letter = None
            continue

        if current is None:
            continue

        # Check for option line
        om = _OPT.match(line)
        if om:
            letter = om.group(1).upper()
            text = om.group(2).strip()
            current["options"][letter] = text
            current_opt_letter = letter
            continue

        # All 5 options found: stop appending continuation text
        if len(current.get("options", {})) >= 5:
            continue

        # Check for inline "Cevap: X"
        cm = _CEVAP_INLINE.search(line)
        if cm:
            current["correct_key"] = cm.group(1).upper()
            continue

        # Continuation line: append to current option or stem (only pre-5-opts)
        if current_opt_letter and current_opt_letter in current["options"]:
            current["options"][current_opt_letter] += " " + line
        elif "stem" in current and not current["options"]:
            current["stem"] += " " + line

    flush()
    return questions


def _find_column_split(page) -> float | None:
    """
    Find the x-coordinate of the column gutter by looking for the x-position
    bucket with the fewest words in the 30–70% width range.
    Returns the split x-coordinate if a clear gap is found, else None.
    """
    try:
        words = page.extract_words()
    except Exception:
        return None
    if len(words) < 30:
        return None

    n_buckets = 20
    buckets = [0] * n_buckets
    for w in words:
        b = min(n_buckets - 1, int(w["x0"] / page.width * n_buckets))
        buckets[b] += 1

    # Search only the middle third for a gap
    lo, hi = int(n_buckets * 0.3), int(n_buckets * 0.7)
    mid_min_idx = min(range(lo, hi), key=lambda i: buckets[i])

    avg = sum(buckets) / n_buckets
    # Gap qualifies if minimum bucket has < 50% of average density
    if buckets[mid_min_idx] < avg * 0.5:
        return (mid_min_idx + 0.5) / n_buckets * page.width
    return None


def _extract_left_column_text(page, split_x: float) -> str:
    """Extract text from the left column up to split_x."""
    try:
        cropped = page.within_bbox((0, 0, split_x - 5, page.height))
        return (cropped.extract_text() or "").strip()
    except Exception:
        return ""


def extract_from_pdf(pdf_path: str) -> list[dict]:
    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        print(f"    Cannot open: {e}", file=sys.stderr)
        return []

    all_questions = []
    with pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages, 1):
            split_x = _find_column_split(page)
            if split_x is not None:
                text = _extract_left_column_text(page, split_x)
                col_flag = f"2col@{split_x:.0f}"
            else:
                text = (page.extract_text() or "").strip()
                col_flag = "txt"
            if len(text) < 100:
                print(f"    p{i}/{total} skip(no text)", file=sys.stderr, flush=True)
                continue
            found = parse_page(text)
            print(f"    p{i}/{total} {col_flag} → {len(found)}q", file=sys.stderr, flush=True)
            all_questions.extend(found)
    return all_questions


def discover_pdfs(base_dir: str, folders: list[str] | None) -> list[tuple]:
    results = []
    for root, dirs, files in os.walk(base_dir):
        dirs.sort()
        rel = os.path.relpath(root, base_dir)
        folder = rel.split(os.sep)[0]
        if folders and folder not in folders:
            continue
        for fname in sorted(files):
            if not fname.lower().endswith(".pdf"):
                continue
            path = os.path.join(root, fname)
            subject, test_type = FOLDER_TO_SUBJECT.get(folder, (None, "klinik"))
            results.append((folder, fname, path, subject, test_type))
    return results


def parse_args():
    p = argparse.ArgumentParser(
        description="Extract TUS questions from text PDFs using regex (no API calls)"
    )
    p.add_argument("--dir", default=None,
                   help="Root directory of PDFs (required unless --from-json)")
    p.add_argument("--from-json", default=None, metavar="FILE",
                   help="Skip PDF extraction; read questions directly from a JSON file and commit")
    p.add_argument("--output", default=None)
    p.add_argument("--folders", nargs="+", default=None)
    p.add_argument("--commit", action="store_true",
                   help="Insert into DB")
    p.add_argument("--status", default="draft", choices=["draft", "approved"],
                   help="Status for committed questions (default: draft — use approved only after manual review)")
    p.add_argument("--min-options", type=int, default=5,
                   help="Minimum options required to keep a question (default 5)")
    return p.parse_args()


def is_quality_question(q: dict) -> bool:
    """Basic quality gate: stem must contain '?', options must be non-trivial."""
    stem = q.get("stem", "")
    if "?" not in stem:
        return False
    opts = q.get("options", {})
    if len(opts) < 5:
        return False
    if any(len(v.strip()) < 3 for v in opts.values()):
        return False
    return True


def main():
    args = parse_args()

    all_questions = []
    low_quality = 0

    if args.from_json:
        # Read from pre-extracted JSON, skip PDF scanning
        with open(args.from_json, encoding="utf-8") as f:
            all_questions = json.load(f)
        print(f"Loaded {len(all_questions)} question(s) from {args.from_json}", file=sys.stderr)
    else:
        if not args.dir:
            print("ERROR: --dir is required unless --from-json is specified", file=sys.stderr)
            sys.exit(1)
        pdfs = discover_pdfs(args.dir, args.folders)
        print(f"Found {len(pdfs)} PDF(s)", file=sys.stderr)

        for idx, (folder, fname, path, subject, test_type) in enumerate(pdfs, 1):
            print(f"\n[{idx}/{len(pdfs)}] [{folder}] {fname}", file=sys.stderr)
            found = extract_from_pdf(path)
            tagged = []
            for q in found:
                q["subject"] = subject or folder
                q["test_type"] = test_type
                q["difficulty"] = "3"
                if is_quality_question(q):
                    tagged.append(q)
                else:
                    low_quality += 1
            print(f"  → {len(tagged)} question(s) ({len(found)-len(tagged)} filtered)", file=sys.stderr)
            all_questions.extend(tagged)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total: {len(all_questions)} question(s)", file=sys.stderr)

    if not args.commit:
        out = json.dumps(all_questions, ensure_ascii=False, indent=2)
        if args.output:
            os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(out)
            print(f"Saved to: {args.output}", file=sys.stderr)
        else:
            print(out)
        return

    # --commit: insert into DB directly
    from app.core.db import SessionLocal
    from app.models.qbank import Question

    if not all_questions:
        print("Nothing to commit.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    added = 0
    skipped = 0
    try:
        for q in all_questions:
            if not q.get("stem") or len(q.get("options", {})) < args.min_options:
                skipped += 1
                continue
            opts = q["options"]
            if not all(k in opts for k in ("A", "B", "C", "D", "E")):
                skipped += 1
                continue
            row = Question(
                test=q["test_type"],
                subject=q["subject"],
                subtopic=None,
                difficulty_label=q.get("difficulty", "3"),
                stem=q["stem"],
                options=opts,
                correct_key=q.get("correct_key", "") or "",
                explanation=q.get("explanation") or None,
                status=args.status,
            )
            db.add(row)
            added += 1
        db.commit()
        print(f"Inserted {added} question(s) as '{args.status}' ({skipped} skipped — malformed).", file=sys.stderr)
        if args.status == "draft":
            print(f"Review via: GET /v1/admin/questions?status=draft", file=sys.stderr)
            print(f"Approve one: POST /v1/admin/questions/{{id}}/approve", file=sys.stderr)
            print(f"Bulk approve: POST /v1/admin/questions/bulk-approve", file=sys.stderr)
    except Exception as exc:
        db.rollback()
        print(f"DB error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
