from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ActivityEvent
from app.schemas.schemas import ActivityEventCreate, ActivityEventOut

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.post("", response_model=ActivityEventOut)
def create_activity(event: ActivityEventCreate, db: Session = Depends(get_db)):
    db_event = ActivityEvent(
        application=event.application,
        action=event.action,
        target=event.target,
        event_metadata=event.metadata,
        session_id=event.session_id,
        source=event.source,
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("", response_model=list[ActivityEventOut])
def list_activity(
    limit: int = Query(50, le=500),
    session_id: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(ActivityEvent).order_by(ActivityEvent.timestamp.desc())
    if session_id:
        query = query.filter(ActivityEvent.session_id == session_id)
    events = query.limit(limit).all()
    return list(reversed(events))
