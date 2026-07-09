"""
Application configuration settings using Pydantic Settings.

All secrets are env-driven. In production, required vars must be set
explicitly — the app will refuse to start with placeholder defaults.
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Application ──
    APP_NAME: str = "TusCoach"
    APP_VERSION: str = "0.1.0"
    ENV: str = "dev"  # dev | prod

    # ── Database ──
    DATABASE_URL: str = "postgresql://tuscoach:tuscoach123@localhost:5433/tuscoach"

    # ── Redis / Celery broker ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Authentication ──
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── LLM ──
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.0-flash"
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"

    # ── CORS ──
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── Push Notifications (Expo) ──
    EXPO_ACCESS_TOKEN: str = ""  # Optional — leave empty to send without auth
    EXPO_PUSH_URL: str = "https://exp.host/--/api/v2/push/send"

    # ── Streak ──
    MIN_DAILY_MINUTES: int = 10

    # ── Chat guardrails ──
    CHAT_RATE_LIMIT: int = 30            # max requests per window
    CHAT_RATE_WINDOW: int = 600          # window in seconds (10 min)
    CHAT_DAILY_LIMIT: int = 20           # max messages per calendar day
    CHAT_MAX_INPUT_CHARS: int = 2000     # truncate user input beyond this
    CHAT_HISTORY_LIMIT: int = 20         # messages sent to LLM context

    # ── Startup validation ──
    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        """In prod, fail fast if required secrets are missing or still placeholder."""
        if self.ENV != "prod":
            return self

        errors: list[str] = []

        # DATABASE_URL must not be the dev default
        if "localhost" in self.DATABASE_URL and "5433" in self.DATABASE_URL:
            errors.append(
                "DATABASE_URL still points to the local dev database. "
                "Set a production connection string."
            )

        # JWT_SECRET must not be the placeholder
        if self.JWT_SECRET == "dev-secret-change-in-production":
            errors.append(
                "JWT_SECRET is still the dev placeholder. "
                "Set a strong, random secret (e.g. openssl rand -hex 32)."
            )

        # REDIS_URL must not be bare localhost default
        if self.REDIS_URL == "redis://localhost:6379/0":
            errors.append(
                "REDIS_URL is still the default localhost value. "
                "Set a production Redis URL."
            )

        if errors:
            joined = "\n  - ".join(errors)
            raise ValueError(
                f"Production startup blocked — fix the following:\n  - {joined}"
            )

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
