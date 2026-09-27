"""
Activity Simulator — generates a realistic, deterministic sequence of
activity events representing the canonical demo workflow:

    Gmail -> Download Attachment -> CRM -> Update Customer -> Slack Notification

This is the "activity/event simulation layer" the requirements call for: it
stands in for real OS/browser activity capture and can be swapped out later
without touching the discovery engine, AI layer, or frontend contract, since
everything downstream just consumes ActivityEvent rows.
"""
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.models import ActivityEvent

# The canonical demo sequence. Timing offsets (seconds) create a realistic
# feeling timeline when replayed, and are also used to compute "time spent".
DEMO_SEQUENCE = [
    {
        "application": "Gmail",
        "action": "open_application",
        "target": "inbox",
        "metadata": {"unread_count": 12},
        "offset": 0,
    },
    {
        "application": "Gmail",
        "action": "open_email",
        "target": "customer_request",
        "metadata": {
            "customer": "Rahul Sharma",
            "subject": "Invoice correction request",
            "from": "rahul.sharma@acmetech.com",
        },
        "offset": 3,
    },
    {
        "application": "Gmail",
        "action": "download_attachment",
        "target": "invoice_corrected.pdf",
        "metadata": {"file_size_kb": 214, "customer": "Rahul Sharma"},
        "offset": 6,
    },
    {
        "application": "CRM",
        "action": "open_application",
        "target": "crm_dashboard",
        "metadata": {},
        "offset": 9,
    },
    {
        "application": "CRM",
        "action": "search_customer",
        "target": "Rahul Sharma",
        "metadata": {"query": "Rahul Sharma"},
        "offset": 11,
    },
    {
        "application": "CRM",
        "action": "update_customer",
        "target": "customer_record",
        "metadata": {
            "customer": "Rahul Sharma",
            "field_updated": "billing_notes",
            "note": "Invoice corrected per customer request, PDF attached",
        },
        "offset": 14,
    },
    {
        "application": "Slack",
        "action": "open_application",
        "target": "workspace",
        "metadata": {},
        "offset": 17,
    },
    {
        "application": "Slack",
        "action": "send_message",
        "target": "#customer-success",
        "metadata": {
            "message": "Updated billing notes for Rahul Sharma (Acme Tech) per invoice correction request.",
        },
        "offset": 19,
    },
]


def generate_demo_session(db: Session, user_id: str | None = None, repeat: int = 1) -> str:
    """
    Insert a full demo sequence of ActivityEvents into the database under a
    single session_id, so the discovery engine has real rows to analyze.

    `repeat` > 1 simulates the same workflow having happened multiple times
    (useful for the "detected 3 times" repetition-detection story), each
    under its own session_id but close together in time.
    """
    session_ids = []
    base_time = datetime.utcnow()

    for r in range(repeat):
        session_id = str(uuid.uuid4())
        session_ids.append(session_id)
        # stagger repeats a few minutes apart to look like separate incidents
        run_start = base_time - timedelta(minutes=(repeat - r) * 15)

        for event in DEMO_SEQUENCE:
            db_event = ActivityEvent(
                user_id=user_id,
                timestamp=run_start + timedelta(seconds=event["offset"]),
                application=event["application"],
                action=event["action"],
                target=event["target"],
                event_metadata=event["metadata"],
                session_id=session_id,
                source="simulated",
            )
            db.add(db_event)

    db.commit()
    return session_ids[-1]  # most recent session id, used to drive the live UI replay


def get_sequence_for_ui() -> list[dict]:
    """Returns the raw sequence definition (used by the frontend to animate playback)."""
    return DEMO_SEQUENCE
