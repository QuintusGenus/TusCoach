#!/usr/bin/env python
"""
Batch ingest TUS questions from an entire directory of PDFs.

Scans all PDFs recursively, extracts questions from each page using:
  - pdfplumber for text-based PDFs (no API call for extraction itself)
  - Gemini vision API for scanned/image-based PDFs

Uses the folder name as a subject hint to improve classification accuracy.
Saves progress to a manifest so interrupted runs can be resumed.

RATE LIMITS (free tier):
  - 5 requests/minute, 20 requests/day per model
  - Use --text-only to skip scanned pages and stay well within limits
  - For full batch processing, a paid Gemini API key is recommended

Run from backend/:
    # See what would be processed (no API calls)
    ../venv/bin/python scripts/batch_ingest.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS --dry-run

    # Text-only extraction (stays within free tier, skip scanned PDFs)
    ../venv/bin/python scripts/batch_ingest.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS \\
        --output scripts/batch_extracted.json \\
        --text-only

    # Specific folders only
    ../venv/bin/python scripts/batch_ingest.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS \\
        --folders Biyokimya Farmakoloji \\
        --output scripts/batch_extracted.json \\
        --text-only

    # Resume an interrupted run
    ../venv/bin/python scripts/batch_ingest.py \\
        --dir /Users/burakozer/Desktop/BKO/TUS \\
        --output scripts/batch_extracted.json \\
        --text-only --resume

    # After extraction, classify and insert into DB
    ../venv/bin/python scripts/classify_questions.py \\
        --input scripts/batch_extracted.json --commit
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pdfplumber
except ImportError:
    print("ERROR: Run: ../venv/bin/pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

# ── Prompts ───────────────────────────────────────────────────────────────────

_EXTRACT_SYSTEM = """\
Sen bir TUS (Tıpta Uzmanlık Sınavı) soru çıkarma uzmanısın.
Verilen sayfadan TÜM TUS sorularını tespit edip JSON formatında döndür.

KURALLAR:
1. Sayfada bulunan TÜM soruları çıkar. Hiçbirini atlama.
2. Seçenekler A'dan E'ye kadar tam olmalı. Eksikse o soruyu atla.
3. Cevap anahtarı sayfada verilmişse correct_key'e yaz. Yoksa boş bırak ("").
4. Açıklama varsa ekle, yoksa boş bırak ("").
5. Soru yoksa (içindekiler, kapak, konu anlatımı vb.) boş liste döndür.
6. HINT: Bu sayfa büyük olasılıkla "{subject}" konusundaki bir TUS soru kitabından alınmıştır.

ÇIKTI — yalnızca JSON object içinde "questions" listesi:
{{"questions": [
  {{
    "stem": "Soru gövdesi...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."}},
    "correct_key": "A",
    "explanation": ""
  }}
]}}"""

_EXTRACT_TEXT_USER = "Bu sayfadan TUS sorularını çıkar:\n\n{page_text}\n\nJSON döndür."

# ── Subject mapping ───────────────────────────────────────────────────────────

FOLDER_TO_SUBJECT = {
    "Anatomi": "Anatomi",
    "Biyokimya": "Biyokimya",
    "Dahiliye": "Dahiliye",
    "Denemeler": None,
    "Farmakoloji": "Farmakoloji",
    "FizyoHisto": "Fizyoloji/Histoloji",
    "Genel Cerrahi": "Genel Cerrahi",
    "Genel": None,
    "Kadın Doğum": "Kadın Hastalıkları ve Doğum",
    "Küçük Stajlar": None,
    "Mikrobiyoloji": "Mikrobiyoloji",
    "Patoloji": "Patoloji",
    "Pediatri": "Pediatri",
    "TUS": None,
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def page_to_base64_png(page) -> str:
    img = page.to_image(resolution=150).original
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def parse_llm_response(response) -> list:
    raw = (response.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("questions") or data.get("sorular") or data.get("items") or []
    else:
        return []
    valid = []
    for q in items:
        if not isinstance(q, dict):
            continue
        stem = (q.get("stem") or "").strip()
        options = q.get("options") or {}
        if not stem or len(options) < 5:
            continue
        valid.append({
            "stem": stem,
            "options": {k.upper(): v for k, v in options.items()},
            "correct_key": (q.get("correct_key") or "").strip().upper(),
            "explanation": (q.get("explanation") or "").strip(),
        })
    return valid


def call_llm_extract(client, model: str, messages: list, max_retries: int = 3) -> list:
    """Call LLM with automatic retry on per-minute 429 errors. Stops on daily quota."""
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                timeout=60,
            )
            return parse_llm_response(response)
        except Exception as exc:
            err_str = str(exc)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                if "GenerateRequestsPerDayPerProjectPerModel" in err_str:
                    raise RuntimeError("DAILY_QUOTA_EXHAUSTED") from exc
                wait = 12
                m = re.search(r"retryDelay.*?(\d+)s", err_str)
                if m:
                    wait = int(m.group(1)) + 2
                if attempt < max_retries - 1:
                    print(f"\n    [rate limit — waiting {wait}s]", file=sys.stderr, end=" ", flush=True)
                    time.sleep(wait)
                    continue
            raise
    return []


def extract_from_pdf(client, model: str, pdf_path: str, subject_hint: str,
                     delay: float, text_only: bool = False) -> list:
    questions = []
    system_prompt = _EXTRACT_SYSTEM.format(subject=subject_hint or "bilinmiyor")

    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        print(f"    Cannot open: {e}", file=sys.stderr)
        return []

    with pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages, 1):
            text = (page.extract_text() or "").strip()
            is_text = len(text) > 100

            if not is_text and text_only:
                print(f"    p{i}/{total} scan→skip", file=sys.stderr, flush=True)
                continue

            print(f"    p{i}/{total} {'txt' if is_text else 'img'}", end=" ", file=sys.stderr, flush=True)

            try:
                if is_text:
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": _EXTRACT_TEXT_USER.format(page_text=text[:5000])},
                    ]
                else:
                    b64 = page_to_base64_png(page)
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                            {"type": "text", "text": "Bu sayfadaki TUS sorularını JSON olarak çıkar."},
                        ]},
                    ]
                found = call_llm_extract(client, model, messages)
                print(f"→ {len(found)}q", file=sys.stderr, flush=True)
                questions.extend(found)
            except RuntimeError as e:
                if "DAILY_QUOTA_EXHAUSTED" in str(e):
                    print(f"\n\n  ⚠ Daily quota exhausted. Progress saved. Resume tomorrow with --resume.", file=sys.stderr)
                    return questions  # return what we have so far
                print(f"→ ERR({e})", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"→ ERR({e})", file=sys.stderr, flush=True)

            if delay and i < total:
                time.sleep(delay)

    return questions


def discover_pdfs(base_dir: str, folders: list) -> list:
    results = []
    for root, dirs, files in os.walk(base_dir):
        dirs.sort()
        folder = os.path.relpath(root, base_dir).split(os.sep)[0]
        if folders and folder not in folders:
            continue
        for fname in sorted(files):
            if not fname.lower().endswith(".pdf"):
                continue
            path = os.path.join(root, fname)
            hint = FOLDER_TO_SUBJECT.get(folder)
            results.append((folder, path, hint))
    return results


def load_manifest(path: str) -> set:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_manifest(path: str, done: set):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(done), f, ensure_ascii=False, indent=2)


def parse_args():
    p = argparse.ArgumentParser(description="Batch ingest TUS questions from a PDF directory")
    p.add_argument("--dir", required=True, help="Root directory containing subject folders")
    p.add_argument("--output", default=None, help="Output JSON file path")
    p.add_argument("--folders", nargs="+", default=None,
                   help="Only process these folders (e.g. Biyokimya Farmakoloji)")
    p.add_argument("--text-only", action="store_true",
                   help="Skip scanned/image pages — only process text-based pages (recommended for free tier)")
    p.add_argument("--commit", action="store_true",
                   help="Classify and insert extracted questions into DB after extraction")
    p.add_argument("--delay", type=float, default=12.0,
                   help="Seconds between LLM calls per page (default: 12 — stays within 5 req/min free tier)")
    p.add_argument("--resume", action="store_true",
                   help="Skip PDFs already in the manifest (resume interrupted run)")
    p.add_argument("--dry-run", action="store_true",
                   help="List PDFs that would be processed without calling the LLM")
    return p.parse_args()


def main():
    args = parse_args()

    output_path = args.output or os.path.join(os.path.dirname(__file__), "batch_extracted.json")
    manifest_path = output_path.replace(".json", "_manifest.json")

    pdfs = discover_pdfs(args.dir, args.folders)
    print(f"Found {len(pdfs)} PDF(s) in {len(set(f for f,_,_ in pdfs))} folder(s)", file=sys.stderr)

    if args.dry_run:
        for folder, path, hint in pdfs:
            print(f"  [{folder:15}] {os.path.basename(path)}  (hint: {hint or 'none'})")
        return

    done = load_manifest(manifest_path) if args.resume else set()
    if done:
        print(f"Resuming — {len(done)} PDF(s) already processed", file=sys.stderr)

    all_questions = []
    if args.resume and os.path.exists(output_path):
        with open(output_path, encoding="utf-8") as f:
            all_questions = json.load(f)
        print(f"Loaded {len(all_questions)} previously extracted question(s)", file=sys.stderr)

    from openai import OpenAI
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.LLM_API_KEY:
        print("ERROR: LLM_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)
    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)

    if args.text_only:
        print("Mode: text-only (scanned pages will be skipped)", file=sys.stderr)
    if args.delay < 12:
        print(f"Warning: --delay {args.delay}s may hit the 5 req/min free-tier limit. Recommended: 12s+", file=sys.stderr)

    for idx, (folder, path, hint) in enumerate(pdfs, 1):
        fname = os.path.basename(path)
        if path in done:
            print(f"[{idx}/{len(pdfs)}] SKIP: [{folder}] {fname}", file=sys.stderr)
            continue

        print(f"\n[{idx}/{len(pdfs)}] [{folder}] {fname}", file=sys.stderr)

        found = extract_from_pdf(client, settings.LLM_MODEL, path, hint or folder,
                                  args.delay, text_only=args.text_only)
        print(f"  → {len(found)} question(s)", file=sys.stderr)

        all_questions.extend(found)
        done.add(path)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_questions, f, ensure_ascii=False, indent=2)
        save_manifest(manifest_path, done)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total: {len(all_questions)} question(s) from {len(done)} PDF(s)", file=sys.stderr)
    print(f"Saved: {output_path}", file=sys.stderr)

    if not args.commit:
        print(f"\nNext: classify and insert into DB:", file=sys.stderr)
        print(f"  ../venv/bin/python scripts/classify_questions.py --input {output_path} --commit", file=sys.stderr)
        return

    if not all_questions:
        print("No questions to commit.", file=sys.stderr)
        return

    print(f"\nClassifying {len(all_questions)} question(s)...", file=sys.stderr)
    import subprocess
    subprocess.run([
        sys.executable, "scripts/classify_questions.py",
        "--input", output_path, "--commit"
    ], check=True)


if __name__ == "__main__":
    main()
