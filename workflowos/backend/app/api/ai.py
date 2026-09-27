from fastapi import APIRouter
from pydantic import BaseModel

from app.ai import gemini_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AIAnalyzeRequest(BaseModel):
    event_sequence: list[dict]


@router.post("/analyze")
def analyze_events(payload: AIAnalyzeRequest):
    """Standalone endpoint to run just the intent-understanding step on an
    arbitrary event sequence (useful for debugging / the AI layer in isolation)."""
    intent = gemini_service.understand_intent(payload.event_sequence)
    generated = gemini_service.generate_workflow(intent, payload.event_sequence)
    return {
        "intent": intent.model_dump(),
        "workflow": generated.model_dump(by_alias=True),
    }
