"""
AutomationEngine — picks the best available adapter for each workflow step
and executes it, updating WorkflowExecution / ExecutionStep rows live so the
frontend can poll and show real-time progress.

Adapter priority (per requirements):
    1. API integration
    2. Application integration
    3. Accessibility / semantic UI
    4. Browser automation
    5. Simulation fallback (always available)

Execution runs in a background thread with its own DB session, so the HTTP
request that triggers a run returns immediately with the (still "pending")
execution row, and the frontend polls GET /api/executions/{id} to watch
steps complete one by one — this is what gives the demo "live execution
status" without needing websockets. The Postgres row is always the single
source of truth, so this works correctly even if a later poll lands on a
different process.

Human intervention (requirement #11): if a step fails, the execution is
parked in "needs_intervention" and nothing further runs until a human
resolves it (see resume_execution_async), which re-plays from the failed
step onward with corrected context.
"""
import threading
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.models import WorkflowExecution, ExecutionStep
from app.automation.adapters import (
    APIAdapter, ApplicationAdapter, AccessibilityAdapter, BrowserAdapter, SimulationAdapter,
)


class AutomationEngine:
    def __init__(self):
        # Ordered by priority; SimulationAdapter is last and always supports everything.
        self.adapters = [
            APIAdapter(),
            ApplicationAdapter(),
            AccessibilityAdapter(),
            BrowserAdapter(),
            SimulationAdapter(),
        ]

    def _pick_adapter(self, step_type: str):
        for adapter in self.adapters:
            if adapter.supports(step_type):
                return adapter
        return self.adapters[-1]  # SimulationAdapter always supports

    # -- single-step execution, committing progress immediately so a poller sees it --

    def _run_one_step(
        self, db: Session, execution: WorkflowExecution, step: dict[str, Any],
        index: int, context: dict[str, Any],
    ) -> bool:
        step_type = step["step_type"]
        config = step.get("config", {})

        exec_step = ExecutionStep(
            execution_id=execution.id,
            order_index=index,
            step_type=step_type,
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(exec_step)
        db.commit()
        db.refresh(exec_step)

        adapter = self._pick_adapter(step_type)
        try:
            result = adapter.execute_step(step_type, config, context)
        except NotImplementedError:
            # Adapter claimed support but isn't implemented -> fall back to simulation
            result = self.adapters[-1].execute_step(step_type, config, context)

        exec_step.finished_at = datetime.utcnow()
        if result.get("success", True):
            exec_step.status = "success"
            exec_step.output = {k: v for k, v in result.items() if k != "success"}
            db.commit()
            return True

        exec_step.status = "failed"
        exec_step.error_message = result.get("error", "unknown_error")
        exec_step.output = {"label": result.get("label", "Step failed")}
        db.commit()
        return False

    def _finalize(self, db: Session, execution: WorkflowExecution, ok: bool, error_message: str | None = None):
        execution.finished_at = datetime.utcnow()
        execution.duration_seconds = (execution.finished_at - execution.started_at).total_seconds()
        execution.status = "success" if ok else "needs_intervention"
        if error_message:
            execution.error_message = error_message
        db.commit()

    def _run_from(
        self, db: Session, execution: WorkflowExecution, steps: list[dict[str, Any]],
        context: dict[str, Any], start_index: int = 0,
    ):
        execution.status = "running"
        execution.error_message = None
        db.commit()

        for index in range(start_index, len(steps)):
            ok = self._run_one_step(db, execution, steps[index], index, context)
            if not ok:
                self._finalize(
                    db, execution, ok=False,
                    error_message=f"Step {index + 1} ({steps[index]['step_type']}) needs your input.",
                )
                return

        self._finalize(db, execution, ok=True)

    # -- synchronous entry point (kept for the /api/ai debug endpoint & tests) --

    def run_execution(
        self, db: Session, execution: WorkflowExecution, steps: list[dict[str, Any]],
        context: dict[str, Any] | None = None,
    ) -> WorkflowExecution:
        context = context or {}
        self._run_from(db, execution, steps, context, start_index=0)
        db.refresh(execution)
        return execution

    # -- async entry points used by the API layer --

    def start_execution_async(self, execution_id: str, steps: list[dict[str, Any]], context: dict[str, Any]):
        def _worker():
            db = SessionLocal()
            try:
                execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
                if not execution:
                    return
                self._run_from(db, execution, steps, context, start_index=0)
            finally:
                db.close()

        threading.Thread(target=_worker, daemon=True).start()

    def resume_execution_async(self, execution_id: str, context_updates: dict[str, Any]):
        """
        Re-plays a workflow from wherever it stopped (the failed step), using
        an updated context (e.g. a corrected customer name supplied by a
        human during intervention). Steps that already succeeded are left
        untouched; the failed step's row is replaced so it re-runs cleanly.
        """
        def _worker():
            db = SessionLocal()
            try:
                execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
                if not execution:
                    return
                workflow = execution.workflow
                steps = [
                    {"step_type": s.step_type, "config": s.config}
                    for s in sorted(workflow.steps, key=lambda s: s.order_index)
                ]

                resume_index = 0
                for exec_step in sorted(execution.steps, key=lambda s: s.order_index):
                    if exec_step.status == "success":
                        resume_index = exec_step.order_index + 1
                    elif exec_step.status == "failed":
                        resume_index = exec_step.order_index
                        db.delete(exec_step)
                db.commit()

                context = dict(execution.context or {})
                context.update(context_updates)
                execution.context = context
                db.commit()

                self._run_from(db, execution, steps, context, start_index=resume_index)
            finally:
                db.close()

        threading.Thread(target=_worker, daemon=True).start()


engine = AutomationEngine()
