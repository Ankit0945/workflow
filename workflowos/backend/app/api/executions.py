from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import WorkflowExecution, UserFeedback
from app.schemas.schemas import WorkflowExecutionOut, ExecutionResolveRequest
from app.automation.engine import engine as automation_engine

router = APIRouter(prefix="/api/executions", tags=["executions"])


def _with_workflow_name(execution: WorkflowExecution) -> WorkflowExecution:
    execution.workflow_name = execution.workflow.name if execution.workflow else None
    return execution


@router.get("", response_model=list[WorkflowExecutionOut])
def list_executions(workflow_id: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(WorkflowExecution).order_by(WorkflowExecution.started_at.desc())
    if workflow_id:
        query = query.filter(WorkflowExecution.workflow_id == workflow_id)
    executions = query.limit(limit).all()
    return [_with_workflow_name(e) for e in executions]


@router.get("/{execution_id}", response_model=WorkflowExecutionOut)
def get_execution(execution_id: str, db: Session = Depends(get_db)):
    """
    Polled by the frontend every ~700ms while an execution is pending/running
    so it can render live, step-by-step progress straight from Postgres.
    """
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return _with_workflow_name(execution)


@router.post("/{execution_id}/resolve", response_model=WorkflowExecutionOut)
def resolve_execution(execution_id: str, payload: ExecutionResolveRequest, db: Session = Depends(get_db)):
    """
    Human-in-the-loop resolution (requirement #11): called when an execution
    is parked in "needs_intervention" — most commonly because find_customer
    couldn't locate the customer. `action="retry"` supplies corrected info
    (e.g. the right customer name) and resumes the workflow from the failed
    step onward in the background; `action="cancel"` ends the run as failed.
    """
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if execution.status != "needs_intervention":
        raise HTTPException(status_code=400, detail="Execution is not awaiting intervention")

    if payload.action == "cancel":
        execution.status = "failed"
        execution.finished_at = datetime.utcnow()
        if execution.started_at:
            execution.duration_seconds = (execution.finished_at - execution.started_at).total_seconds()
        db.commit()
        db.add(UserFeedback(
            workflow_id=execution.workflow_id, execution_id=execution.id,
            feedback_type="manual_intervention", notes="cancelled by user after failure",
        ))
        db.commit()
        db.refresh(execution)
        return _with_workflow_name(execution)

    context_updates = {"simulate_customer_not_found": False}
    if payload.customer_name:
        context_updates["customer"] = payload.customer_name

    execution.status = "running"
    db.commit()
    db.add(UserFeedback(
        workflow_id=execution.workflow_id, execution_id=execution.id,
        feedback_type="manual_intervention",
        notes=f"resolved with customer_name={payload.customer_name!r}",
    ))
    db.commit()
    db.refresh(execution)

    automation_engine.resume_execution_async(execution.id, context_updates)
    return _with_workflow_name(execution)
