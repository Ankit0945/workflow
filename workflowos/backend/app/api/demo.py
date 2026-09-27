from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.demo_simulator import generate_demo_session, get_sequence_for_ui
from app.schemas.schemas import DemoStartResponse

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/start", response_model=DemoStartResponse)
def start_demo(db: Session = Depends(get_db)):
    """
    Generates a full demo activity session immediately (deterministic,
    reliable for live demos) and returns the session_id so the frontend can
    animate the same sequence client-side for the "live" feel while the real
    rows already exist in the database for the discovery engine to analyze.

    We also seed two earlier occurrences of the same workflow so the
    repetition-detection story ("performed 3 times") works out of the box.
    """
    generate_demo_session(db, repeat=2)  # two "historical" runs
    session_id = generate_demo_session(db, repeat=1)  # the run the UI will animate live

    sequence = get_sequence_for_ui()
    return DemoStartResponse(
        session_id=session_id,
        message="Demo activity generated successfully.",
        total_events=len(sequence),
    )


@router.get("/sequence")
def get_demo_sequence():
    """Raw sequence definition the frontend uses to drive the live playback animation."""
    return get_sequence_for_ui()
