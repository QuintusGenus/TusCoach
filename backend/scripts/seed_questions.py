#!/usr/bin/env python
"""
Load seed questions from seed_questions.json into the database.
Run from the backend/ directory:
    python scripts/seed_questions.py
"""
import json
import os
import sys

# Allow importing app modules from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.models.qbank import Question


def main() -> None:
    seed_path = os.path.join(os.path.dirname(__file__), "seed_questions.json")
    with open(seed_path) as f:
        rows = json.load(f)

    db = SessionLocal()
    try:
        added = 0
        for row in rows:
            q = Question(
                test=row["test"],
                subject=row["subject"],
                subtopic=row.get("subtopic"),
                stem=row["stem"],
                options=row["options"],
                correct_key=row["correct_key"],
                explanation=row.get("explanation"),
                source_citation=row.get("source_citation"),
                predicted_diff=row.get("predicted_diff"),
                status=row.get("status", "approved"),
            )
            db.add(q)
            added += 1
        db.commit()
        print(f"Seeded {added} questions.")
    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
