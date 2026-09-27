"""
WorkFlowOS backend entrypoint.

Creates the FastAPI app, sets up CORS, auto-creates database tables on
startup (dev-friendly, no Alembic needed for the hackathon), and mounts all
API routers.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.models import models  # noqa: F401 — ensures models are registered on Base
from app.api import activity, demo, workflows, executions, dashboard, ai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("workflowos")

settings = get_settings()

app = FastAPI(
    title="WorkFlowOS API",
    description="AI-powered OS-level workflow automation — hackathon MVP backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")
    if not settings.GEMINI_API_KEY:
        logger.warning(
            "GEMINI_API_KEY is not set. AI endpoints will use deterministic "
            "fallback responses instead of calling Gemini."
        )


@app.get("/")
def root():
    return {"service": "WorkFlowOS API", "status": "running"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "environment": settings.ENVIRONMENT,
    }


app.include_router(activity.router)
app.include_router(demo.router)
app.include_router(workflows.router)
app.include_router(executions.router)
app.include_router(dashboard.router)
app.include_router(ai.router)
