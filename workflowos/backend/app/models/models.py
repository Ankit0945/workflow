"""
SQLAlchemy ORM models for WorkFlowOS.

Tables:
    User, ActivityEvent, WorkflowCandidate, Workflow, WorkflowStep,
    WorkflowExecution, ExecutionStep, Integration, UserFeedback,
    SuggestedWorkflow
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, Integer, Float, Boolean, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, default="Demo User")
    email = Column(String, unique=True, default="demo@workflowos.local")
    created_at = Column(DateTime, default=datetime.utcnow)

    activity_events = relationship("ActivityEvent", back_populates="user")
    workflows = relationship("Workflow", back_populates="user")


class ActivityEvent(Base):
    """A single observed unit of user activity (real or simulated)."""
    __tablename__ = "activity_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    application = Column(String, index=True)   # e.g. Gmail, CRM, Slack
    action = Column(String, index=True)        # e.g. open_email, update_customer
    target = Column(String, nullable=True)     # e.g. customer_request
    event_metadata = Column(JSON, default=dict)
    session_id = Column(String, index=True, nullable=True)  # groups one simulated run
    source = Column(String, default="simulated")  # simulated | real

    user = relationship("User", back_populates="activity_events")


class WorkflowCandidate(Base):
    """A repeated sequence detected by the discovery engine, before AI understanding."""
    __tablename__ = "workflow_candidates"

    id = Column(String, primary_key=True, default=gen_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    event_sequence = Column(JSON, default=list)   # ordered list of application/action pairs
    applications = Column(JSON, default=list)
    occurrence_count = Column(Integer, default=1)
    estimated_time_seconds = Column(Float, default=0.0)
    status = Column(String, default="detected")  # detected | analyzed | dismissed
    session_ids = Column(JSON, default=list)


class SuggestedWorkflow(Base):
    """AI-understood intent behind a WorkflowCandidate, shown to the user for approval."""
    __tablename__ = "suggested_workflows"

    id = Column(String, primary_key=True, default=gen_uuid)
    candidate_id = Column(String, ForeignKey("workflow_candidates.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    intent = Column(String)
    description = Column(Text)
    category = Column(String, nullable=True)
    confidence = Column(Float, default=0.0)
    proposed_workflow = Column(JSON, default=dict)  # full generated workflow JSON
    status = Column(String, default="pending")  # pending | approved | rejected | dismissed


class Workflow(Base):
    """An approved, active automation."""
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    suggested_workflow_id = Column(String, ForeignKey("suggested_workflows.id"), nullable=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    trigger = Column(JSON, default=dict)
    conditions = Column(JSON, default=list)
    status = Column(String, default="active")  # active | paused | archived
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="workflows")
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan")
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowStep(Base):
    """One ordered step/node in a workflow (used by the visual workflow builder)."""
    __tablename__ = "workflow_steps"

    id = Column(String, primary_key=True, default=gen_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"))
    order_index = Column(Integer, default=0)
    step_type = Column(String)          # e.g. read_email, update_customer, send_notification
    application = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    config = Column(JSON, default=dict)  # editable fields/variables

    workflow = relationship("Workflow", back_populates="steps")


class WorkflowExecution(Base):
    """One run of an approved workflow (real or simulated)."""
    __tablename__ = "workflow_executions"

    id = Column(String, primary_key=True, default=gen_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"))
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")  # pending | running | success | failed | needs_intervention
    duration_seconds = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    context = Column(JSON, default=dict)  # execution context (e.g. customer name, flags) — persisted so a
                                           # background thread and later a human-intervention resume can
                                           # both read/update it without holding anything only in memory

    workflow = relationship("Workflow", back_populates="executions")
    steps = relationship("ExecutionStep", back_populates="execution", cascade="all, delete-orphan")


class ExecutionStep(Base):
    """Status of a single step within one workflow execution."""
    __tablename__ = "execution_steps"

    id = Column(String, primary_key=True, default=gen_uuid)
    execution_id = Column(String, ForeignKey("workflow_executions.id"))
    order_index = Column(Integer, default=0)
    step_type = Column(String)
    status = Column(String, default="pending")  # pending | running | success | failed | skipped
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    output = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)

    execution = relationship("WorkflowExecution", back_populates="steps")


class Integration(Base):
    """A connected (or simulated) external application/integration."""
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String)          # Gmail, Slack, CRM
    type = Column(String)          # api | browser | simulated
    status = Column(String, default="simulated")  # connected | simulated | disconnected
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserFeedback(Base):
    """Feedback / learning signal recorded after executions or suggestions."""
    __tablename__ = "user_feedback"

    id = Column(String, primary_key=True, default=gen_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=True)
    execution_id = Column(String, ForeignKey("workflow_executions.id"), nullable=True)
    feedback_type = Column(String)  # approved | rejected | modified | skipped_step | manual_intervention
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
