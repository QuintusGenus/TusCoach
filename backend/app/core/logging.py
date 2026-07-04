"""
Structured logging setup.

Produces JSON lines in prod, human-readable in dev.
"""
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings


class JSONFormatter(logging.Formatter):
    """Emit one JSON object per log line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Attach extras injected by middleware / application code
        for key in ("request_id", "user_id", "method", "path", "status_code", "latency_ms"):
            val = getattr(record, key, None)
            if val is not None:
                payload[key] = val

        if record.exc_info and record.exc_info[1] is not None:
            payload["exc"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def setup_logging() -> None:
    """Configure root logger based on ENV."""
    settings = get_settings()
    is_prod = settings.ENV == "prod"
    level = logging.INFO

    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers to avoid duplicates on reload
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if is_prod:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
                datefmt="%H:%M:%S",
            )
        )

    root.addHandler(handler)

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
