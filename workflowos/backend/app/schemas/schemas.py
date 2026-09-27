"""
Pydantic schemas — request/response validation, and strict schemas for
Gemini's structured JSON output (critical: we never trust free-form AI text).
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Activity events
# ---------------------------------------------------------------------------

class ActivityEventCreate(BaseModel):
    application: str
    action: str
    target: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    source: str = "simulated"


class ActivityEventOut(BaseModel):
    id: str
    timestamp: datetime
    application: str
    action: str
    target: Optional[str] = None
    event_metadata: dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    source: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Demo mode
# ---------------------------------------------------------------------------

class DemoStartResponse(BaseModel):
    session_id: str
    message: str
    total_events: int


# ---------------------------------------------------------------------------
# AI structured outputs (strict schemas — Gemini output is validated against these)
# ---------------------------------------------------------------------------

class AIWorkflowIntent(BaseModel):
    """Strict schema Gemini's 'understand intent' response must match."""
    intent: str
    description: str
    confidence: float = Field(ge=0.0, le=1.0)
    category: str


class AIWorkflowStep(BaseModel):
    type: str
    application: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)


class AIWorkflowCondition(BaseModel):
    if_: str = Field(alias="if")
    then: str

    class Config:
        populate_by_name = True


class AIGeneratedWorkflow(BaseModel):
    """Strict schema for the full generated workflow returned by Gemini."""
    name: str
    trigger: dict[str, Any]
    actions: list[AIWorkflowStep]
    conditions: list[AIWorkflowCondition] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Workflow candidates / suggestions
# ---------------------------------------------------------------------------

class WorkflowCandidateOut(BaseModel):
    id: str
    created_at: datetime
    event_sequence: list[Any]
    applications: list[str]
    occurrence_count: int
    estimated_time_seconds: float
    status: str

    class Config:
        from_attributes = True


class SuggestedWorkflowOut(BaseModel):
    id: str
    candidate_id: Optional[str] = None
    created_at: datetime
    intent: str
    description: str
    category: Optional[str] = None
    confidence: float
    proposed_workflow: dict[str, Any]
    status: str

    class Config:
        from_attributes = True


class WorkflowAnalyzeRequest(BaseModel):
    session_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

class WorkflowStepOut(BaseModel):
    id: str
    order_index: int
    step_type: str
    application: Optional[str] = None
    description: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class WorkflowOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    trigger: dict[str, Any]
    conditions: list[Any]
    status: str
    created_at: datetime
    steps: list[WorkflowStepOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class WorkflowApproveRequest(BaseModel):
    edited_steps: Optional[list[dict[str, Any]]] = None


class WorkflowStepIn(BaseModel):
    """One step as edited by the visual workflow builder."""
    step_type: str
    application: Optional[str] = None
    description: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)


class WorkflowStepsUpdateRequest(BaseModel):
    steps: list[WorkflowStepIn]


class WorkflowReliabilityOut(BaseModel):
    """Basic reliability / learning statistics for one active workflow."""
    workflow_id: str
    total_executions: int
    successful_executions: int
    failed_executions: int
    needs_intervention_count: int
    success_rate: float
    average_duration_seconds: float
    last_execution_status: Optional[str] = None
    last_execution_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Executions
# ---------------------------------------------------------------------------

class ExecutionStepOut(BaseModel):
    id: str
    order_index: int
    step_type: str
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    output: dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class WorkflowExecutionOut(BaseModel):
    id: str
    workflow_id: str
    workflow_name: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    context: dict[str, Any] = Field(default_factory=dict)
    steps: list[ExecutionStepOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ExecutionResolveRequest(BaseModel):
    """Human-intervention response when a step (e.g. find_customer) fails."""
    action: str = "retry"  # "retry" (apply corrected info and continue) | "cancel"
    customer_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_activities: int
    workflows_discovered: int
    active_automations: int
    time_saved_minutes: float
    success_rate: float
    successful_executions: int
    failed_executions: int
    average_execution_time_seconds: float
