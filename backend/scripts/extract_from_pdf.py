#!/usr/bin/env python
"""
Extract TUS questions from one or more PDF files.

Reads each page of the PDF(s), sends the raw text to the LLM to identify
and structure all questions found, then writes a JSON file compatible with
classify_questions.py.

Run from backend/:
    # Single PDF
    ../venv/bin/python scripts/extract_from_pdf.py \\
        --input /path/to/questions.pdf \\
        --output scripts/extracted.json

    # Multiple PDFs (glob supported)
    ../venv/bin/python scripts/extract_from_pdf.py \\
        --input /path/to/pdf1.pdf /path/to/pdf2.pdf \\
        --output scripts/extracted.json

Then classify and ingest:
    ../venv/bin/python scripts/classify_questions.py \\
        --input scripts/extracted.json --commit
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pdfplumber
except ImportError:
    print("ERROR: pdfplumber not installed. Run: ../venv/bin/pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

# ── Extraction prompt ─────────────────────────────────────────────────────────

_EXTRACT_SYSTEM_PROMPT = """\
Sen bir TUS (Tıpta Uzmanlık Sınavı) sorusu çıkarma uzmanısın.
Sana bir PDF sayfasından alınan ham metin verilecek. Bu metinden TUS sorularını tespit edip yapılandırman gerekiyor.

KURALLAR:
1. Sayfada bulunan TÜM soruları çıkar.
2. Her soru için stem (soru gövdesi), seçenekler (A-E) ve doğru cevabı belirle.
3. Eğer sayfada hiç soru yoksa (içindekiler, açıklama sayfası vb.) boş liste döndür.
4. Seçenekler A'dan E'ye kadar olmalı. Eğer sayfada daha az seçenek varsa veya format farklıysa atla.
5. Doğru cevap sayfada verilmişse kullan. Verilmemişse correct_key alanını boş bırak ("").
6. Açıklama (explanation) varsa ekle, yoksa boş bırak.

ÇIKTI FORMATI — yalnızca geçerli JSON listesi, başka hiçbir şey ekleme:
[
  {
    "stem": "Soru gövdesi...",
    "options": {
      "A": "Seçenek A",
      "B": "Seçenek B",
      "C": "Seçenek C",
      "D": "Seçenek D",
      "E": "Seçenek E"
    },
    "correct_key": "A",
    "explanation": "Açıklama (varsa)"
  }
]"""

_EXTRACT_USER_TEMPLATE = """\
Aşağıdaki PDF sayfasından TUS sorularını çıkar:

--- SAYFA METNİ ---
{page_text}
--- SAYFA METNİ SONU ---

JSON listesi olarak döndür. Soru yoksa [] döndür."""


def extract_text_from_pdf(pdf_path: str) -> list[tuple[int, str]]:
    """Returns list of (page_number, text) tuples. Skips blank pages."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            text = text.strip()
            if len(text) < 50:  # skip near-blank pages
                continue
            pages.append((i, text))
    return pages


def extract_questions_from_page(client, model: str, page_text: str) -> list[dict]:
    """Call LLM to extract questions from a single page's text."""
    user_content = _EXTRACT_USER_TEMPLATE.format(page_text=page_text[:6000])  # cap tokens

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _EXTRACT_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )

    raw = (response.choices[0].message.content or "").strip()

    # The model may return a dict wrapper like {"questions": [...]} or directly a list
    # Since json_object mode requires an object, we wrap the list expectation:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []

    # Handle {"questions": [...]} wrapper
    if isinstance(data, dict):
        for key in ("questions", "sorular", "items", "results"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
        else:
            return []

    if not isinstance(data, list):
        return []

    # Filter out malformed entries
    valid = []
    for q in data:
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


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract TUS questions from PDF files into JSON"
    )
    parser.add_argument("--input", nargs="+", required=True,
                        help="One or more PDF file paths")
    parser.add_argument("--output", required=True,
                        help="Output JSON file path (e.g. scripts/extracted.json)")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Seconds between LLM calls per page (default: 0.5)")
    parser.add_argument("--pages", type=str, default=None,
                        help="Page range to process, e.g. '1-10' or '5' (per PDF)")
    return parser.parse_args()


def parse_page_range(spec: str, total: int) -> range:
    if not spec:
        return range(total)
    if "-" in spec:
        start, end = spec.split("-", 1)
        return range(int(start) - 1, min(int(end), total))
    return range(int(spec) - 1, min(int(spec), total))


def main():
    args = parse_args()

    from openai import OpenAI
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.LLM_API_KEY:
        print("ERROR: LLM_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)
    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)

    all_questions = []
    total_pages_processed = 0

    for pdf_path in args.input:
        if not os.path.exists(pdf_path):
            print(f"WARN: File not found, skipping: {pdf_path}", file=sys.stderr)
            continue

        print(f"\nProcessing: {pdf_path}", file=sys.stderr)
        try:
            pages = extract_text_from_pdf(pdf_path)
        except Exception as exc:
            print(f"  ERROR reading PDF: {exc}", file=sys.stderr)
            continue

        print(f"  {len(pages)} non-blank page(s) found", file=sys.stderr)

        if args.pages:
            page_range = parse_page_range(args.pages, len(pages))
            pages = [pages[i] for i in page_range if i < len(pages)]
            print(f"  Filtered to {len(pages)} page(s) per --pages {args.pages}", file=sys.stderr)

        for page_num, page_text in pages:
            print(f"  Page {page_num}: extracting...", file=sys.stderr, end=" ")
            try:
                questions = extract_questions_from_page(client, settings.LLM_MODEL, page_text)
                print(f"{len(questions)} question(s) found", file=sys.stderr)
                all_questions.extend(questions)
                total_pages_processed += 1
            except Exception as exc:
                print(f"FAILED — {exc}", file=sys.stderr)

            if args.delay:
                time.sleep(args.delay)

    print(
        f"\nTotal: {len(all_questions)} question(s) extracted from {total_pages_processed} page(s)",
        file=sys.stderr,
    )

    if not all_questions:
        print("No questions extracted. Check PDF text quality (scanned images won't work).", file=sys.stderr)
        sys.exit(1)

    output_path = args.output
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"Saved to: {output_path}", file=sys.stderr)
    print(f"\nNext step — classify and ingest:", file=sys.stderr)
    print(f"  ../venv/bin/python scripts/classify_questions.py --input {output_path} --commit", file=sys.stderr)


if __name__ == "__main__":
    main()
