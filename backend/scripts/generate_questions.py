#!/usr/bin/env python
"""
Generate TUS questions via LLM and optionally insert them as drafts.

Run from backend/:
    python scripts/generate_questions.py \\
        --test-type klinik --subject Dahiliye \\
        --subtopic "Kalp Yetmezliği" --difficulty orta \\
        --count 5

Add --commit to persist to DB (default is dry-run, prints JSON to stdout).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.services.ai_service import generate_tus_question

VALID_TEST_TYPES = ("temel", "klinik")
VALID_DIFFICULTIES = ("kolay", "orta", "zor")


def parse_args():
    parser = argparse.ArgumentParser(description="Generate TUS draft questions via LLM")
    parser.add_argument("--test-type", required=True, choices=VALID_TEST_TYPES,
                        dest="test_type")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--subtopic", default=None)
    parser.add_argument("--difficulty", required=True, choices=VALID_DIFFICULTIES,
                        dest="difficulty_label")
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--commit", action="store_true",
                        help="Insert into DB as drafts (default: dry-run, prints JSON)")
    return parser.parse_args()


def main():
    args = parse_args()

    generated = []
    errors = []

    for i in range(args.count):
        print(f"[{i+1}/{args.count}] Generating...", file=sys.stderr)
        try:
            question = generate_tus_question(
                subject=args.subject,
                subtopic=args.subtopic or args.subject,
                test_type=args.test_type,
                difficulty_label=args.difficulty_label,
            )
            generated.append(question)
            print(f"  OK — correct_key={question.correct_key}", file=sys.stderr)
        except (ValueError, RuntimeError) as exc:
            print(f"  FAILED: {exc}", file=sys.stderr)
            errors.append({"index": i + 1, "error": str(exc)})
        except Exception as exc:
            print(f"  FAILED (unexpected): {exc}", file=sys.stderr)
            errors.append({"index": i + 1, "error": str(exc)})

    if not args.commit:
        out = [
            {
                "test": q.test,
                "subject": q.subject,
                "subtopic": q.subtopic,
                "difficulty_label": q.difficulty_label,
                "stem": q.stem,
                "options": q.options,
                "correct_key": q.correct_key,
                "explanation": q.explanation,
                "status": q.status,
            }
            for q in generated
        ]
        print(json.dumps(out, ensure_ascii=False, indent=2))
        if errors:
            print(f"\n{len(errors)} error(s) encountered (not committed).", file=sys.stderr)
        return

    # --commit: insert into DB
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
