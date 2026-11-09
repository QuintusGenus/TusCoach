#!/usr/bin/env python
"""
Classify approved DB questions that lack subtopics, using batch LLM calls.

Each LLM call classifies up to BATCH_SIZE questions → 20 req/day covers 200 questions.

Run from backend/:
    # Dry-run (shows what would be updated):
    ../venv/bin/python scripts/classify_db_questions.py

    # Update DB in-place:
    ../venv/bin/python scripts/classify_db_questions.py --commit

    # Limit how many questions to process (respects daily quota):
    ../venv/bin/python scripts/classify_db_questions.py --commit --max-batches 5
"""
import argparse
import sys
import time
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.models.qbank import Question
from app.services.ai_service import classify_questions_batch

BATCH_SIZE = 10  # questions per LLM call
DELAY = 13       # seconds between calls (free tier: 5 req/min)


def parse_args():
    p = argparse.ArgumentParser(description="Batch-classify DB questions missing subtopics")
    p.add_argument("--commit", action="store_true", help="Write subtopics/difficulty back to DB")
    p.add_argument("--max-batches", type=int, default=None,
                   help="Stop after N LLM calls (default: process all)")
    p.add_argument("--subject", default=None, help="Only classify this subject")
    p.add_argument("--status", default="approved", choices=["approved", "draft"],
                   help="Which status to process (default: approved)")
    return p.parse_args()


def main():
    args = parse_args()

    db = SessionLocal()
    try:
        q_filter = db.query(Question).filter(
            Question.status == args.status,
            Question.subtopic == None,
        )
        if args.subject:
            q_filter = q_filter.filter(Question.subject == args.subject)
        questions = q_filter.order_by(Question.id).all()
    finally:
        db.close()

    total = len(questions)
    print(f"Found {total} questions without subtopics (status={args.status})", file=sys.stderr)
    if total == 0:
        print("Nothing to do.", file=sys.stderr)
        return

    batches = [questions[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    if args.max_batches:
        batches = batches[:args.max_batches]
    print(
        f"Will run {len(batches)} batch(es) × {BATCH_SIZE} = up to {len(batches)*BATCH_SIZE} questions",
        file=sys.stderr,
    )

    updated_total = 0
    error_total = 0

    for bi, batch in enumerate(batches):
        print(f"\n[Batch {bi+1}/{len(batches)}] {len(batch)} questions", file=sys.stderr)
        raw = [
            {"stem": q.stem, "options": q.options, "correct_key": q.correct_key or "?"}
            for q in batch
        ]
        try:
            tags_list = classify_questions_batch(raw)
        except Exception as e:
            err = str(e)
            print(f"  LLM FAILED: {err}", file=sys.stderr)
            if "quota" in err.lower() or "429" in err:
                print("  Quota exhausted — stopping.", file=sys.stderr)
                break
            error_total += len(batch)
            if bi < len(batches) - 1:
                time.sleep(DELAY)
            continue

        db = SessionLocal()
        try:
            for qi, (q, tags) in enumerate(zip(batch, tags_list)):
                subtopic = tags.get("subtopic") or None
                diff = str(tags.get("difficulty", "")) or None
                print(
                    f"  [{qi}] id={str(q.id)[:8]} → subtopic={subtopic!r} difficulty={diff}",
                    file=sys.stderr,
                )
                if args.commit and (subtopic or diff):
                    row = db.query(Question).filter(Question.id == q.id).first()
                    if row:
                        if subtopic:
                            row.subtopic = subtopic
                        if diff:
                            row.difficulty_label = diff
                        updated_total += 1
            if args.commit:
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"  DB error: {e}", file=sys.stderr)
            error_total += len(batch)
        finally:
            db.close()

        if bi < len(batches) - 1:
            time.sleep(DELAY)

    print(
        f"\nDone: {updated_total} updated, {error_total} errors"
        + (" (dry-run, use --commit to write)" if not args.commit else ""),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
