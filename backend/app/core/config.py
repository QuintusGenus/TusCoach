"""
Application configuration settings
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    app_name: str = "TUS Coaching App"
    debug: bool = True
    secret_key: str = "dev-secret-key-change-in-production"
    
    # Database
    database_url: str = "sqlite:///./tuscoach.db"
    
    # CORS
    allowed_origins: list[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
