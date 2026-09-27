"""
Dedicated Gemini prompts for WorkFlowOS.

Every prompt instructs Gemini to return ONLY strict JSON matching a known
schema (see app/schemas/schemas.py) — no prose, no markdown fences. The
service layer (gemini_service.py) validates the response with Pydantic and
falls back to a deterministic mock if Gemini is unavailable or returns
something invalid, per the requirement to never depend on free-form AI text
for application logic.
"""

INTENT_UNDERSTANDING_PROMPT = """You are the intent-understanding module inside WorkFlowOS, \
an AI workflow automation system. You are given a sequence of raw activity \
events a user performed across different applications.

Event sequence:
{event_sequence}

Task: infer the high-level human intent behind this sequence.

Respond with ONLY a raw JSON object, no markdown, no commentary, matching \
exactly this schema:
{{
  "intent": string (a short 2-5 word title, e.g. "Process Customer Request"),
  "description": string (one sentence describing the business purpose),
  "confidence": number between 0 and 1,
  "category": string (one short lowercase snake_case category, e.g. "customer_operations")
}}
"""

WORKFLOW_GENERATION_PROMPT = """You are the workflow-generation module inside WorkFlowOS.

Given this detected intent and the underlying event sequence, generate a \
structured, executable workflow definition.

Intent: {intent}
Description: {description}
Event sequence:
{event_sequence}

Respond with ONLY a raw JSON object, no markdown, no commentary, matching \
exactly this schema:
{{
  "name": string,
  "trigger": {{ "type": string, "source": string }},
  "actions": [
    {{ "type": string, "application": string or null, "config": object }}
  ],
  "conditions": [
    {{ "if": string, "then": string }}
  ]
}}

Include at least one condition that handles a step failing gracefully \
(e.g. a customer record not being found), routing to human intervention.
"""

REPETITION_SUMMARY_PROMPT = """You are the repetition-summary module inside WorkFlowOS.

A sequence of activities has been observed {occurrence_count} times across \
these applications: {applications}, taking about {estimated_time_seconds} \
seconds on average.

Write ONE short, natural sentence (max 25 words) a product notification \
could show a user, in the form: "You performed a similar X workflow N times."

Respond with ONLY a raw JSON object, no markdown:
{{
  "summary": string
}}
"""
