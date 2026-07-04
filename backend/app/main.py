"""
TUS Coaching App - FastAPI Application
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestLoggingMiddleware
from app.core.error_handlers import register_error_handlers
from app.api.v1.router import router as v1_router

# ── Bootstrap logging before anything else ──
setup_logging()
logger = logging.getLogger("tuscoach.app")

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="API for Turkish Medical Residency Entrance Exam coaching",
    version=settings.APP_VERSION,
)

# ── Middleware (order matters: first added = outermost) ──
# CORS: in prod restrict to explicit origins; in dev allow broad localhost
cors_origins = settings.ALLOWED_ORIGINS
if settings.ENV == "dev" and cors_origins == ["http://localhost:3000"]:
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:8081",   # Expo dev server
        "http://localhost:19006",  # Expo web
    ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.add_middleware(RequestLoggingMiddleware)

# ── Error handlers ──
register_error_handlers(app)

# ── Routers ──
app.include_router(v1_router)

logger.info("TusCoach %s started (env=%s)", settings.APP_VERSION, settings.ENV)


@app.get("/")
async def root():
    """Root endpoint with app info."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env": settings.ENV,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """
    Liveness / readiness probe.
    Checks DB and Redis connectivity; returns 200 if all ok, 503 otherwise.
    """
    result: dict = {"status": "ok", "version": settings.APP_VERSION}
    healthy = True

    # DB check
    try:
        from app.core.db import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        result["db"] = "ok"
    except Exception as exc:
        result["db"] = "error"
        healthy = False
        logger.error("Health check: DB unreachable — %s", exc)

    # Redis check
    try:
        import redis as _redis
        r = _redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        result["redis"] = "ok"
    except Exception as exc:
        result["redis"] = "error"
        healthy = False
        logger.error("Health check: Redis unreachable — %s", exc)

    if not healthy:
        result["status"] = "degraded"

    status_code = 200 if healthy else 503
    return JSONResponse(content=result, status_code=status_code)
