from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ActivityEvent, SuggestedWorkflow, Workflow, WorkflowExecution
from app.schemas.schemas import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Rough assumption used only to translate "time observed" into a headline
# "time saved" number for the demo — clearly a heuristic, not a measurement.
AUTOMATION_TIME_SAVED_FACTOR = 0.9


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_activities = db.query(ActivityEvent).count()
    workflows_discovered = db.query(SuggestedWorkflow).count()
    active_automations = db.query(Workflow).filter(Workflow.status == "active").count()

    executions = db.query(WorkflowExecution).all()
    successful = [e for e in executions if e.status == "success"]
    failed = [e for e in executions if e.status == "failed"]
    total_finished = len(successful) + len(failed)
    success_rate = (len(successful) / total_finished * 100) if total_finished else 0.0

    durations = [e.duration_seconds for e in successful if e.duration_seconds]
    avg_duration = sum(durations) / len(durations) if durations else 0.0

    # crude "time saved" estimate: successful executions * avg human time per workflow (~90s)
    time_saved_minutes = (len(successful) * 90 * AUTOMATION_TIME_SAVED_FACTOR) / 60

    return DashboardStats(
        total_activities=total_activities,
        workflows_discovered=workflows_discovered,
        active_automations=active_automations,
        time_saved_minutes=round(time_saved_minutes, 1),
        success_rate=round(success_rate, 1),
        successful_executions=len(successful),
        failed_executions=len(failed),
        average_execution_time_seconds=round(avg_duration, 1),
    )
