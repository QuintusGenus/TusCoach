"""
Sliding-window rate limiters.

RateLimiter        — keyed by client IP  (in-memory, single-process)
UserRateLimiter    — keyed by user ID    (Redis when available, in-memory fallback)
"""
import logging
import time
import threading
from collections import defaultdict
from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Sliding-window rate limiter keyed by client IP.

    Usage as a FastAPI dependency::

        _login_limiter = RateLimiter(max_calls=5, window_seconds=60)

        @router.post("/login")
        def login(request: Request, _=Depends(_login_limiter)):
            ...
    """

    def __init__(self, max_calls: int = 5, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def _cleanup(self, key: str, now: float) -> None:
        cutoff = now - self.window
        timestamps = self._hits[key]
        while timestamps and timestamps[0] < cutoff:
            timestamps.pop(0)

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()

        with self._lock:
            self._cleanup(key, now)
            if len(self._hits[key]) >= self.max_calls:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Try again in {self.window} seconds.",
                )
            self._hits[key].append(now)


# ── Redis helpers (lazy init) ──

_redis_client = None
_redis_checked = False


def _get_redis():
    """Return a Redis client or None if unavailable."""
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    try:
        from app.core.config import get_settings
        import redis as _redis_mod

        settings = get_settings()
        _redis_client = _redis_mod.Redis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1,
        )
        _redis_client.ping()
        logger.info("UserRateLimiter using Redis")
    except Exception:
        _redis_client = None
        logger.info("UserRateLimiter falling back to in-memory")
    return _redis_client


class UserRateLimiter:
    """
    Per-user rate limiter. Uses Redis ZSET if available, else in-memory.

    Usage::

        _chat_limiter = UserRateLimiter(max_calls=30, window_seconds=600)

        @router.post("/chat/send")
        def send(user=Depends(get_current_user), _rl=Depends(_chat_limiter)):
            ...
    """

    def __init__(self, max_calls: int = 30, window_seconds: int = 600):
        self.max_calls = max_calls
        self.window = window_seconds
        # In-memory fallback
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def _check_redis(self, key: str) -> bool:
        """Try Redis. Returns True if handled, False to fall back."""
        r = _get_redis()
        if r is None:
            return False
        try:
            now = time.time()
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, now - self.window)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, self.window)
            results = pipe.execute()
            count = results[1]
            if count >= self.max_calls:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Chat rate limit exceeded. Try again later.",
                )
            return True
        except HTTPException:
            raise
        except Exception:
            return False

    def __call__(self, request: Request) -> None:
        # Extract user_id from already-resolved auth dependency
        user = getattr(request.state, "user", None)
        if user and hasattr(user, "id"):
            uid = str(user.id)
        else:
            uid = request.client.host if request.client else "unknown"

        key = f"chat_rl:{uid}"

        if self._check_redis(key):
            return

        # In-memory fallback
        now = time.monotonic()
        with self._lock:
            cutoff = now - self.window
            timestamps = self._hits[key]
            while timestamps and timestamps[0] < cutoff:
                timestamps.pop(0)
            if len(timestamps) >= self.max_calls:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Chat rate limit exceeded. Try again later.",
                )
            timestamps.append(now)
