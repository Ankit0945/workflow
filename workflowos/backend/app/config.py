"""
Central application configuration.
Reads from environment variables / .env file.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/workflowos"
    ENVIRONMENT: str = "development"
    BACKEND_PORT: int = 8000

    # CORS - allow the Vite dev server by default
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
