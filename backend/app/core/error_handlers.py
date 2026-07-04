"""
Central exception handlers.

- HTTPException: pass through (FastAPI default) but log 5xx.
- RequestValidationError: 422 with clean body.
- Unhandled Exception: 500 with safe response, full stack trace in logs.
"""
import logging

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("tuscoach.error")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.warning(
            "Validation error on %s %s",
            request.method,
            request.url.path,
            extra={"request_id": request_id},
        )
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Validation error",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        if exc.status_code >= 500:
            logger.error(
                "HTTP %s on %s %s: %s",
                exc.status_code,
                request.method,
                request.url.path,
                exc.detail,
                extra={"request_id": request_id},
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "Unhandled error on %s %s",
            request.method,
            request.url.path,
            extra={"request_id": request_id},
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
