"""
Request lifecycle middleware.

- Assigns a unique request_id (or honours X-Request-ID from upstream).
- Extracts user_id from the JWT bearer token (best-effort, no auth failure).
- Logs method, path, status_code, latency_ms as structured fields.
"""
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from jose import jwt, JWTError

from app.core.config import get_settings

logger = logging.getLogger("tuscoach.request")


def _extract_user_id(request: Request) -> int | None:
    """Best-effort user_id from Authorization header. Never raises."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        settings = get_settings()
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except (JWTError, ValueError, Exception):
        return None


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Correlation ID
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id

        # 2. User ID (best-effort)
        user_id = _extract_user_id(request)

        # 3. Timing
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = round((time.perf_counter() - start) * 1000, 1)

        # 4. Log
        logger.info(
            "%s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            },
        )

        # 5. Echo request_id back
        response.headers["X-Request-ID"] = request_id
        return response
