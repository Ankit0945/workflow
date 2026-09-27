from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    WorkflowCandidate, SuggestedWorkflow, Workflow, WorkflowStep, UserFeedback,
)
from app.schemas.schemas import (
    SuggestedWorkflowOut, WorkflowOut, WorkflowAnalyzeRequest, WorkflowApproveRequest,
    WorkflowStepsUpdateRequest, WorkflowReliabilityOut,
)
from app.services.workflow_discovery import discover_candidates
from app.ai import gemini_service
from app.automation.engine import engine as automation_engine
from app.models.models import WorkflowExecution
from app.schemas.schemas import WorkflowExecutionOut

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _with_workflow_name(execution: WorkflowExecution) -> WorkflowExecution:
    """Attach the parent workflow's name as a plain attribute so the
    WorkflowExecutionOut schema can pick it up without a client-side join."""
    execution.workflow_name = execution.workflow.name if execution.workflow else None
    return execution


@router.post("/analyze", response_model=list[SuggestedWorkflowOut])
def analyze_workflows(payload: WorkflowAnalyzeRequest, db: Session = Depends(get_db)):
    """
    Runs the discovery engine over stored activity, then for each repeated
    candidate asks the AI layer to (a) understand the intent and (b) generate
    a structured, executable workflow. Results are persisted as
    SuggestedWorkflow rows awaiting user approval.
    """
    candidates = discover_candidates(db, session_id=payload.session_id)

    suggestions = []
    for candidate in candidates:
        # Skip candidates we've already turned into a suggestion
        existing = (
            db.query(SuggestedWorkflow)
            .filter(SuggestedWorkflow.candidate_id == candidate.id)
            .first()
        )
        if existing:
            suggestions.append(existing)
            continue

        intent = gemini_service.understand_intent(candidate.event_sequence)
        generated = gemini_service.generate_workflow(intent, candidate.event_sequence)

        suggestion = SuggestedWorkflow(
            candidate_id=candidate.id,
            intent=intent.intent,
            description=intent.description,
            category=intent.category,
            confidence=intent.confidence,
            proposed_workflow=generated.model_dump(by_alias=True),
            status="pending",
        )
        db.add(suggestion)
        candidate.status = "analyzed"
        db.commit()
        db.refresh(suggestion)
        suggestions.append(suggestion)

    return suggestions


@router.get("", response_model=list[SuggestedWorkflowOut])
def list_suggested_workflows(db: Session = Depends(get_db)):
    return db.query(SuggestedWorkflow).order_by(SuggestedWorkflow.created_at.desc()).all()


@router.get("/active/list", response_model=list[WorkflowOut])
def list_active_workflows(db: Session = Depends(get_db)):
    return db.query(Workflow).filter(Workflow.status == "active").order_by(Workflow.created_at.desc()).all()


@router.get("/{suggestion_id}", response_model=SuggestedWorkflowOut)
def get_suggested_workflow(suggestion_id: str, db: Session = Depends(get_db)):
    suggestion = db.query(SuggestedWorkflow).filter(SuggestedWorkflow.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggested workflow not found")
    return suggestion


@router.post("/{suggestion_id}/approve", response_model=WorkflowOut)
def approve_workflow(suggestion_id: str, payload: WorkflowApproveRequest, db: Session = Depends(get_db)):
    """
    Converts a SuggestedWorkflow into an active Workflow. This is the ONLY
    path that creates an active automation — nothing is ever auto-activated
    (requirement #13 / #8 human approval gate).
    """
    suggestion = db.query(SuggestedWorkflow).filter(SuggestedWorkflow.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggested workflow not found")
    if suggestion.status == "approved":
        raise HTTPException(status_code=400, detail="Workflow already approved")

    proposed = suggestion.proposed_workflow
    steps_source = payload.edited_steps if payload.edited_steps is not None else proposed.get("actions", [])

    workflow = Workflow(
        suggested_workflow_id=suggestion.id,
        name=proposed.get("name", suggestion.intent),
        description=suggestion.description,
        trigger=proposed.get("trigger", {}),
        conditions=proposed.get("conditions", []),
        status="active",
    )
    db.add(workflow)
    db.flush()  # get workflow.id before adding steps

    for index, action in enumerate(steps_source):
        db.add(WorkflowStep(
            workflow_id=workflow.id,
            order_index=index,
            step_type=action.get("type"),
            application=action.get("application"),
            description=action.get("type", "").replace("_", " ").capitalize(),
            config=action.get("config", {}),
        ))

    suggestion.status = "approved"
    db.add(UserFeedback(workflow_id=workflow.id, feedback_type="approved"))
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/{suggestion_id}/reject")
def reject_workflow(suggestion_id: str, db: Session = Depends(get_db)):
    suggestion = db.query(SuggestedWorkflow).filter(SuggestedWorkflow.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggested workflow not found")
    suggestion.status = "rejected"
    db.add(UserFeedback(feedback_type="rejected", notes=f"suggestion_id={suggestion_id}"))
    db.commit()
    return {"status": "rejected", "id": suggestion_id}


@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionOut)
def execute_workflow(
    workflow_id: str,
    simulate_customer_not_found: bool = False,
    db: Session = Depends(get_db),
):
    """
    Kicks off an approved workflow via the AutomationEngine in a background
    thread and returns immediately with the new (pending) WorkflowExecution
    row. The frontend polls GET /api/executions/{id} to render live,
    step-by-step progress — this keeps the request itself fast and reliable
    for a live demo instead of blocking on the whole run.

    Set `simulate_customer_not_found=true` to demonstrate the human-in-the-
    loop intervention flow (requirement #11).
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if workflow.status != "active":
        raise HTTPException(status_code=400, detail="Workflow is not active")

    steps = [
        {"step_type": s.step_type, "config": s.config}
        for s in sorted(workflow.steps, key=lambda s: s.order_index)
    ]
    context = {
        "customer": "Rahul Sharma",
        "simulate_customer_not_found": simulate_customer_not_found,
    }

    execution = WorkflowExecution(workflow_id=workflow.id, status="pending", context=context)
    db.add(execution)
    db.commit()
    db.refresh(execution)

    automation_engine.start_execution_async(execution.id, steps, context)
    return _with_workflow_name(execution)


@router.put("/active/{workflow_id}/steps", response_model=WorkflowOut)
def update_workflow_steps(workflow_id: str, payload: WorkflowStepsUpdateRequest, db: Session = Depends(get_db)):
    """
    Persists an edited step list from the visual workflow builder for an
    already-approved, active workflow (requirement #3 — editing isn't only
    available before approval). Replaces the full step list atomically.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow_id).delete()
    for index, step in enumerate(payload.steps):
        db.add(WorkflowStep(
            workflow_id=workflow_id,
            order_index=index,
            step_type=step.step_type,
            application=step.application,
            description=step.description or step.step_type.replace("_", " ").capitalize(),
            config=step.config,
        ))
    db.commit()
    db.refresh(workflow)
    return workflow


@router.get("/active/{workflow_id}/reliability", response_model=WorkflowReliabilityOut)
def workflow_reliability(workflow_id: str, db: Session = Depends(get_db)):
    """
    Basic reliability / learning statistics (requirement #12): how often
    this workflow has succeeded, failed, or needed a human, and how fast it
    typically runs — computed live from WorkflowExecution history rather
    than a separately-maintained counter, so it's always consistent.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    executions = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.workflow_id == workflow_id)
        .order_by(WorkflowExecution.started_at.desc())
        .all()
    )
    total = len(executions)
    successful = sum(1 for e in executions if e.status == "success")
    failed = sum(1 for e in executions if e.status == "failed")
    needs_intervention = sum(1 for e in executions if e.status == "needs_intervention")
    finished = successful + failed
    success_rate = (successful / finished * 100) if finished else 0.0
    durations = [e.duration_seconds for e in executions if e.duration_seconds]
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    last = executions[0] if executions else None

    return WorkflowReliabilityOut(
        workflow_id=workflow_id,
        total_executions=total,
        successful_executions=successful,
        failed_executions=failed,
        needs_intervention_count=needs_intervention,
        success_rate=round(success_rate, 1),
        average_duration_seconds=round(avg_duration, 1),
        last_execution_status=last.status if last else None,
        last_execution_at=last.started_at if last else None,
    )
