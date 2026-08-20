#!/usr/bin/env python
"""
Classify and ingest real TUS questions as reference material.

Reads a JSON file of raw questions, calls the LLM to classify each one
(subject, subtopic, test_type, difficulty 1-5), then saves them as
status="approved" so they become few-shot references for future generation.

Input JSON format (see reference_questions_template.json):
[
  {
    "stem": "Soru metni...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."},
    "correct_key": "A",
    "explanation": "Açıklama (opsiyonel)"
  },
  ...
]

Run from backend/:
    python scripts/classify_questions.py --input scripts/my_questions.json
    python scripts/classify_questions.py --input scripts/my_questions.json --commit
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.models.qbank import Question
from app.services.ai_service import classify_question


def parse_args():
    parser = argparse.ArgumentParser(
        description="Classify raw TUS questions via LLM and ingest as reference material"
    )
    parser.add_argument("--input", required=True,
                        help="Path to JSON file containing raw questions")
    parser.add_argument("--commit", action="store_true",
                        help="Save classified questions to DB (default: dry-run, prints JSON)")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Seconds to wait between LLM calls (default: 0.5)")
    return parser.parse_args()


def main():
    args = parse_args()

    with open(args.input, encoding="utf-8") as f:
        raw_questions = json.load(f)

    if not isinstance(raw_questions, list):
        print("ERROR: Input JSON must be a list of questions.", file=sys.stderr)
        sys.exit(1)

    print(f"Classifying {len(raw_questions)} question(s)...", file=sys.stderr)

    classified = []
    errors = []

    for i, raw in enumerate(raw_questions):
        print(f"[{i+1}/{len(raw_questions)}] Classifying...", file=sys.stderr)

        # Validate required fields
        missing = [k for k in ("stem", "options", "correct_key") if not raw.get(k)]
        if missing:
            msg = f"Missing required fields: {missing}"
            print(f"  SKIP: {msg}", file=sys.stderr)
            errors.append({"index": i + 1, "error": msg})
            continue

        try:
            tags = classify_question(raw)
            print(
                f"  OK — {tags.get('test_type')} | {tags.get('subject')} | "
                f"{tags.get('subtopic')} | difficulty={tags.get('difficulty')}",
                file=sys.stderr,
            )

            classified.append({
                "raw": raw,
                "tags": tags,
            })
        except Exception as exc:
            print(f"  FAILED: {exc}", file=sys.stderr)
            errors.append({"index": i + 1, "error": str(exc)})

        if args.delay and i < len(raw_questions) - 1:
            time.sleep(args.delay)

    if not args.commit:
        out = []
        for item in classified:
            raw = item["raw"]
            tags = item["tags"]
            out.append({
                "stem": raw["stem"],
                "options": raw["options"],
                "correct_key": raw["correct_key"],
                "explanation": raw.get("explanation"),
                "test": tags.get("test_type"),
                "subject": tags.get("subject"),
                "subtopic": tags.get("subtopic"),
                "difficulty_label": str(tags.get("difficulty", "")),
                "status": "approved",
                "_analysis": {
                    "difficulty_reason": tags.get("difficulty_reason"),
                    "style": tags.get("style"),
                },
            })
        print(json.dumps(out, ensure_ascii=False, indent=2))
        if errors:
            print(f"\n{len(errors)} error(s) encountered (nothing committed).", file=sys.stderr)
        return

    # --commit: insert into DB as approved reference questions
    if not classified:
        print("Nothing to commit — all classifications failed.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        added = 0
        for item in classified:
            raw = item["raw"]
            tags = item["tags"]
            q = Question(
                test=tags.get("test_type", "temel"),
                subject=tags.get("subject", ""),
                subtopic=tags.get("subtopic") or None,
                difficulty_label=str(tags.get("difficulty", "")) or None,
                stem=raw["stem"],
                options={k.upper(): v for k, v in raw["options"].items()},
                correct_key=raw["correct_key"].strip().upper(),
                explanation=raw.get("explanation") or None,
                status="approved",
            )
            db.add(q)
            added += 1
        db.commit()
        print(f"Inserted {added} reference question(s) as approved.", file=sys.stderr)
    except Exception as exc:
        db.rollback()
        print(f"DB error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

    if errors:
        print(f"{len(errors)} classification error(s) skipped.", file=sys.stderr)
        sys.exit(1 if len(errors) == len(raw_questions) else 0)


if __name__ == "__main__":
    main()
