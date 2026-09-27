"""
Gemini AI service.

Wraps all calls to the Google Gemini API (via the google-genai SDK). Every
response is:
  1. Requested as strict JSON only (response_mime_type='application/json').
  2. Parsed defensively (fenced code blocks stripped if present, just in
     case a model ever ignores the mime-type hint).
  3. Validated against a Pydantic schema (app/schemas/schemas.py).

If GEMINI_API_KEY is missing, the API errors, or validation fails, we fall
back to a deterministic mock response so the hackathon demo NEVER breaks
live on stage because of a network hiccup or an API quota issue.

Gemini's free tier (via Google AI Studio, no credit card required) is
generous enough for demo/dev usage — see https://ai.google.dev/pricing.
"""
import json
import logging
from typing import Any

from pydantic import ValidationError

from app.config import get_settings
from app.schemas.schemas import AIWorkflowIntent, AIGeneratedWorkflow
from app.ai import prompts

logger = logging.getLogger("workflowos.ai")

settings = get_settings()

# The free-tier-friendly Gemini model. Swap for "gemini-2.5-pro" if you need
# stronger reasoning and don't mind the lower free-tier rate limits.
GEMINI_MODEL = "gemini-2.5-flash"

_client = None
_client_init_attempted = False


def _get_client():
    """Lazily construct the Gemini client so a missing key/package never
    crashes app startup — only the AI call itself falls back."""
    global _client, _client_init_attempted
    if _client_init_attempted:
        return _client
    _client_init_attempted = True
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — AI service will use deterministic fallbacks.")
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not initialize Gemini client: %s", exc)
        _client = None
    return _client


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    return json.loads(cleaned.strip())


def _call_gemini(prompt: str, max_tokens: int = 600) -> dict[str, Any] | None:
    client = _get_client()
    if client is None:
        return None
    try:
        from google.genai import types
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                response_mime_type="application/json",
            ),
        )
        raw_text = response.text or ""
        return _extract_json(raw_text)
    except Exception as exc:
        logger.warning("Gemini API call failed, using fallback: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public: intent understanding
# ---------------------------------------------------------------------------

def understand_intent(event_sequence: list[dict]) -> AIWorkflowIntent:
    prompt = prompts.INTENT_UNDERSTANDING_PROMPT.format(
        event_sequence=json.dumps(event_sequence, indent=2)
    )
    data = _call_gemini(prompt)

    if data:
        try:
            return AIWorkflowIntent(**data)
        except ValidationError as exc:
            logger.warning("AI intent response failed validation, using fallback: %s", exc)

    return _fallback_intent(event_sequence)


def _fallback_intent(event_sequence: list[dict]) -> AIWorkflowIntent:
    apps = {e.get("application") for e in event_sequence}
    if {"Gmail", "CRM", "Slack"}.issubset(apps):
        return AIWorkflowIntent(
            intent="Process Customer Request",
            description="Process an incoming customer request by updating the CRM and notifying the relevant team.",
            confidence=0.94,
            category="customer_operations",
        )
    return AIWorkflowIntent(
        intent="Repeated Cross-App Task",
        description="A repeated sequence of actions across multiple applications was detected.",
        confidence=0.75,
        category="general_productivity",
    )


# ---------------------------------------------------------------------------
# Public: workflow generation
# ---------------------------------------------------------------------------

def generate_workflow(intent: AIWorkflowIntent, event_sequence: list[dict]) -> AIGeneratedWorkflow:
    prompt = prompts.WORKFLOW_GENERATION_PROMPT.format(
        intent=intent.intent,
        description=intent.description,
        event_sequence=json.dumps(event_sequence, indent=2),
    )
    data = _call_gemini(prompt, max_tokens=900)

    if data:
        try:
            return AIGeneratedWorkflow(**data)
        except ValidationError as exc:
            logger.warning("AI workflow-generation response failed validation, using fallback: %s", exc)

    return _fallback_workflow(intent, event_sequence)


def _fallback_workflow(intent: AIWorkflowIntent, event_sequence: list[dict]) -> AIGeneratedWorkflow:
    action_map = {
        "open_email": {"type": "read_email"},
        "download_attachment": {"type": "download_attachment"},
        "search_customer": {"type": "find_customer", "application": "crm"},
        "update_customer": {"type": "update_customer", "application": "crm"},
        "send_message": {"type": "send_notification", "application": "slack"},
    }
    actions = []
    for event in event_sequence:
        mapped = action_map.get(event.get("action"))
        if mapped:
            actions.append({**mapped, "config": {}})

    if not actions:
        actions = [{"type": "review_manually", "application": None, "config": {}}]

    return AIGeneratedWorkflow(
        name=intent.intent,
        trigger={"type": "new_email", "source": "gmail"},
        actions=actions,
        conditions=[{"if": "customer_not_found", "then": "request_user_intervention"}],
    )


# ---------------------------------------------------------------------------
# Public: repetition summary sentence (used for the notification banner)
# ---------------------------------------------------------------------------

def summarize_repetition(occurrence_count: int, applications: list[str], estimated_time_seconds: float) -> str:
    prompt = prompts.REPETITION_SUMMARY_PROMPT.format(
        occurrence_count=occurrence_count,
        applications=", ".join(applications),
        estimated_time_seconds=round(estimated_time_seconds),
    )
    data = _call_gemini(prompt, max_tokens=150)
    if data and isinstance(data.get("summary"), str):
        return data["summary"]
    return f"You performed a similar customer-request workflow {occurrence_count} times."
