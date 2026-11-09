#!/usr/bin/env python
"""
Calibrate exam-length bands from the ingested question corpus.

Reads existing questions from the DB, measures stem length (in words) grouped by
(test, subject, difficulty) and writes percentile-based bands to
scripts/corpus_stats.json. The generator loads this file to target realistic
TUS length per subject/difficulty and to flag out-of-band drafts.

Run from backend/:
    ../venv/bin/python scripts/calibrate_corpus.py
    ../venv/bin/python scripts/calibrate_corpus.py --status approved --min-samples 5
"""
import argparse
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import SessionLocal
from app.models.qbank import Question

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus_stats.json")


def _percentile(sorted_vals, pct):
    if not sorted_vals:
        return 0
    k = (len(sorted_vals) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = k - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def _band(word_counts, min_samples):
    """(lo, hi) word-count band from p15..p85, widened slightly; None if sparse."""
    if len(word_counts) < min_samples:
        return None
    sv = sorted(word_counts)
    lo = _percentile(sv, 0.15)
    hi = _percentile(sv, 0.85)
    # Widen by ~15% so the band is a target, not a straitjacket.
    span = max(hi - lo, 1)
    lo = max(1, int(round(lo - span * 0.15)))
    hi = int(round(hi + span * 0.15))
    return {"lo": lo, "hi": hi, "n": len(word_counts), "median": int(round(_percentile(sv, 0.5)))}


def parse_args():
    p = argparse.ArgumentParser(description="Derive exam-length bands from the question corpus")
    p.add_argument("--status", default=None, help="Only use questions with this status (default: all)")
    p.add_argument("--min-samples", type=int, default=4, help="Min questions to form a band (default: 4)")
    p.add_argument("--out", default=OUT_PATH)
    return p.parse_args()


def main():
    args = parse_args()
    db = SessionLocal()
    try:
        q = db.query(Question)
        if args.status:
            q = q.filter(Question.status == args.status)
        rows = q.all()
    finally:
        db.close()

    if not rows:
        print("No questions found — nothing to calibrate.", file=sys.stderr)
        sys.exit(1)

    by_subj_diff = defaultdict(list)
    by_subj = defaultdict(list)
    all_counts = []

    for r in rows:
        wc = len((r.stem or "").split())
        if wc == 0:
            continue
        diff = r.difficulty_label or "?"
        by_subj_diff[f"{r.test}|{r.subject}|{diff}"].append(wc)
        by_subj[f"{r.test}|{r.subject}"].append(wc)
        all_counts.append(wc)

    stats = {}
    for key, counts in by_subj_diff.items():
        band = _band(counts, args.min_samples)
        if band:
            stats[key] = band
    for key, counts in by_subj.items():
        band = _band(counts, args.min_samples)
        if band:
            stats[key] = band
    glob = _band(all_counts, 1)
    if glob:
        stats["__global__"] = glob

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"Calibrated {len(rows)} questions → {len(stats)} bands written to {args.out}", file=sys.stderr)
    if "__global__" in stats:
        g = stats["__global__"]
        print(f"  global stem length: {g['lo']}-{g['hi']} words (median {g['median']}, n={g['n']})", file=sys.stderr)


if __name__ == "__main__":
    main()
