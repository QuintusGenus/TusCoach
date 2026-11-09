#!/usr/bin/env python
"""
Generate ORIGINAL, exam-calibrated TUS questions via LLM and optionally insert
them as drafts.

Pipeline per question: generate → structural validation → originality guard
(lexical, vs. ingested questions) → medical/logical verifier pass → retry.

Run from backend/:
    # Dry-run (prints JSON), verifier ON by default:
    ../venv/bin/python scripts/generate_questions.py \\
        --test-type klinik --subject Dahiliye \\
        --subtopic "Kalp Yetmezliği" --difficulty 3 --count 5

    # Persist drafts to DB, also scan raw extracted PDFs for near-duplicates:
    ../venv/bin/python scripts/generate_questions.py \\
        --test-type temel --subject Biyokimya --difficulty 3 --count 10 \\
        --commit --scan-raw scripts/biyokimya_final.json

    # Fast/cheap drafts without the medical reviewer pass:
    ../venv/bin/python scripts/generate_questions.py ... --no-verify
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.models.qbank import Question
from app.services.ai_service import generate_tus_question

VALID_TEST_TYPES = ("temel", "klinik")
VALID_DIFFICULTIES = ("1", "2", "3", "4", "5")


def parse_args():
    parser = argparse.ArgumentParser(description="Generate original TUS draft questions via LLM")
    parser.add_argument("--test-type", required=True, choices=VALID_TEST_TYPES, dest="test_type")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--subtopic", default=None)
    parser.add_argument("--difficulty", required=True, choices=VALID_DIFFICULTIES,
                        dest="difficulty_label", help="Difficulty 1 (easiest) to 5 (hardest)")
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--commit", action="store_true",
                        help="Insert into DB as drafts (default: dry-run, prints JSON)")
    # Quality controls
    parser.add_argument("--verify", dest="verify", action="store_true", default=True,
                        help="Run the medical/logical reviewer pass (default: ON)")
    parser.add_argument("--no-verify", dest="verify", action="store_false",
                        help="Skip the reviewer pass (faster/cheaper)")
    parser.add_argument("--no-originality", dest="originality", action="store_false", default=True,
                        help="Skip the lexical originality guard")
    parser.add_argument("--max-retries", type=int, default=3,
                        help="Regeneration attempts per question on failure (default: 3)")
    parser.add_argument("--similarity-threshold", type=float, default=None,
                        help="Override 4-gram Jaccard reject threshold (0-1, default 0.35)")
    parser.add_argument("--scan-raw", nargs="+", default=None, metavar="JSON",
                        help="Extra JSON files of source questions to check originality against")
    return parser.parse_args()


def _build_corpus(db, test_type, subject, scan_raw):
    """Questions to check originality against: ingested same-subject + raw files."""
    corpus = []
    rows = (
        db.query(Question)
        .filter(Question.test == test_type, Question.subject == subject)
        .all()
    )
    for r in rows:
        corpus.append({"id": str(r.id), "stem": r.stem, "options": r.options})

    for path in scan_raw or []:
        try:
            data = json.load(open(path, encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"  [warn] could not read {path}: {exc}", file=sys.stderr)
            continue
        items = data if isinstance(data, list) else data.get("questions", [])
        for i, it in enumerate(items):
            if it.get("stem"):
                corpus.append({"id": f"{os.path.basename(path)}#{i}", "stem": it["stem"],
                               "options": it.get("options") or {}})
    return corpus


def _log_meta(idx, total, q):
    bits = [f"key={q.correct_key}",
            f"orig={getattr(q, '_originality_score', '?')}",
            f"review={getattr(q, '_review_verdict', '?')}",
            f"tries={getattr(q, '_attempts', '?')}"]
    print(f"  OK [{idx}/{total}] " + " ".join(bits), file=sys.stderr)
    for w in getattr(q, "_quality_warnings", []) or []:
        print(f"      ⚠ {w}", file=sys.stderr)
    for i in getattr(q, "_review_issues", []) or []:
        print(f"      ✎ fixed: {i}", file=sys.stderr)


def main():
    args = parse_args()

    db = SessionLocal()
    corpus = _build_corpus(db, args.test_type, args.subject, args.scan_raw) if args.originality else []
    if args.originality:
        print(f"Originality corpus: {len(corpus)} reference question(s).", file=sys.stderr)

    thresholds = None
    if args.similarity_threshold is not None:
        thresholds = {"stem_jaccard": args.similarity_threshold}

    generated, errors = [], []
    for i in range(args.count):
        print(f"[{i+1}/{args.count}] Generating...", file=sys.stderr)
        try:
            q = generate_tus_question(
                subject=args.subject,
                subtopic=args.subtopic or args.subject,
                test_type=args.test_type,
                difficulty_label=args.difficulty_label,
                db=db,
                verify=args.verify,
                originality_corpus=corpus,
                originality_thresholds=thresholds,
                max_retries=args.max_retries,
            )
            generated.append(q)
            _log_meta(i + 1, args.count, q)
            # Newly accepted questions join the corpus so we don't emit near-dupes
            # of each other within a single run.
            corpus.append({"id": f"session#{i}", "stem": q.stem, "options": q.options})
        except (ValueError, RuntimeError) as exc:
            print(f"  FAILED: {exc}", file=sys.stderr)
            errors.append({"index": i + 1, "error": str(exc)})
        except Exception as exc:
            print(f"  FAILED (unexpected): {exc}", file=sys.stderr)
            errors.append({"index": i + 1, "error": str(exc)})

    db.close()

    if not args.commit:
        out = [
            {
                "test": q.test, "subject": q.subject, "subtopic": q.subtopic,
                "difficulty_label": q.difficulty_label, "stem": q.stem,
                "options": q.options, "correct_key": q.correct_key,
                "explanation": q.explanation, "status": q.status,
                "_originality_score": getattr(q, "_originality_score", None),
                "_review_verdict": getattr(q, "_review_verdict", None),
            }
            for q in generated
        ]
        print(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"\n{len(generated)} generated, {len(errors)} failed (not committed).", file=sys.stderr)
        return

    if not generated:
        print("Nothing to commit — all generations failed.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        for q in generated:
            db.add(q)
        db.commit()
        print(f"Inserted {len(generated)} draft question(s).", file=sys.stderr)
    except Exception as exc:
        db.rollback()
        print(f"DB error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

    if errors:
        print(f"{len(errors)} generation error(s) skipped.", file=sys.stderr)
        sys.exit(1 if len(errors) == args.count else 0)


if __name__ == "__main__":
    main()
