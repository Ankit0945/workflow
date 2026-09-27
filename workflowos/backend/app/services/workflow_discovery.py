"""
Workflow Discovery Engine.

For the hackathon MVP this uses lightweight, explainable heuristics rather
than heavy ML (as instructed — don't claim sophisticated ML we don't have):

  1. Group raw ActivityEvents by session_id into ordered event sequences.
  2. Reduce each sequence to a signature of (application, action) pairs.
  3. Group sessions that share the same signature -> occurrence_count.
  4. Estimate time spent per occurrence from event timestamps.
  5. Sequences seen more than once become WorkflowCandidates.

This is intentionally simple and fast, and is exactly the kind of component
that could later be swapped for real sequence-mining / clustering without
changing anything downstream (AI understanding + workflow generation both
just consume WorkflowCandidate rows).
"""
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import ActivityEvent, WorkflowCandidate


def _signature(events: list[ActivityEvent]) -> tuple:
    return tuple((e.application, e.action) for e in events)


def discover_candidates(db: Session, session_id: Optional[str] = None) -> list[WorkflowCandidate]:
    """
    Analyze ActivityEvents grouped by session, detect repeated (application,
    action) sequences, and upsert WorkflowCandidate rows.

    If session_id is provided, only that session is guaranteed to be
    (re)considered, but detection still compares against all history so
    repetition can be found.
    """
    all_events = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.session_id.isnot(None))
        .order_by(ActivityEvent.session_id, ActivityEvent.timestamp)
        .all()
    )

    sessions: dict[str, list[ActivityEvent]] = defaultdict(list)
    for event in all_events:
        sessions[event.session_id].append(event)

    # Group sessions by identical (application, action) signature
    signature_groups: dict[tuple, list[str]] = defaultdict(list)
    for sid, events in sessions.items():
        signature_groups[_signature(events)].append(sid)

    candidates: list[WorkflowCandidate] = []

    for signature, session_ids in signature_groups.items():
        occurrence_count = len(session_ids)
        if occurrence_count < 1:
            continue

        applications = sorted({app for app, _ in signature})
        event_sequence = [{"application": app, "action": action} for app, action in signature]

        # estimate time spent as average duration (last - first timestamp) across occurrences
        durations = []
        for sid in session_ids:
            evs = sessions[sid]
            if len(evs) >= 2:
                durations.append((evs[-1].timestamp - evs[0].timestamp).total_seconds())
        avg_duration = sum(durations) / len(durations) if durations else 0.0

        existing = (
            db.query(WorkflowCandidate)
            .filter(WorkflowCandidate.event_sequence == event_sequence)
            .first()
        )

        if existing:
            existing.occurrence_count = occurrence_count
            existing.session_ids = session_ids
            existing.estimated_time_seconds = avg_duration
            existing.applications = applications
            candidate = existing
        else:
            candidate = WorkflowCandidate(
                event_sequence=event_sequence,
                applications=applications,
                occurrence_count=occurrence_count,
                estimated_time_seconds=avg_duration,
                session_ids=session_ids,
                status="detected",
            )
            db.add(candidate)

        candidates.append(candidate)

    db.commit()
    for c in candidates:
        db.refresh(c)

    # Only sequences that repeated (>=2 occurrences) are truly "candidates"
    # worth surfacing to the AI + user, per the repetition-detection requirement.
    return [c for c in candidates if c.occurrence_count >= 2]
