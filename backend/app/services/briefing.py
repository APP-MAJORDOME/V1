from datetime import timedelta
from sqlalchemy.orm import Session
from app.core.dt import utc_now_naive
from app.models.models import CanonicalEvent, Task, Opportunity
from app.services.conflicts import detect_conflicts


def build_today_briefing(db: Session, household_id: int) -> dict:
    now = utc_now_naive()
    tomorrow = now + timedelta(days=1)
    events = (
        db.query(CanonicalEvent)
        .filter(
            CanonicalEvent.household_id == household_id,
            CanonicalEvent.starts_at >= now,
            CanonicalEvent.starts_at < tomorrow,
        )
        .all()
    )
    tasks = (
        db.query(Task)
        .filter(Task.household_id == household_id, Task.status == "open")
        .order_by(Task.due_at.asc().nullslast(), Task.created_at.asc())
        .all()
    )
    opportunities = db.query(Opportunity).filter(Opportunity.household_id == household_id, Opportunity.status == "new").all()
    events_sorted = sorted(events, key=lambda e: e.starts_at)
    conflicts = detect_conflicts(events_sorted)

    event_highlights = []
    for event in events_sorted[:3]:
        event_highlights.append(f"Événement: {event.title} à {event.starts_at.strftime('%H:%M')}")

    task_highlights = []
    for task in tasks[:3]:
        if task.due_at:
            task_highlights.append(f"Tâche: {task.title} (échéance {task.due_at.strftime('%H:%M')})")
        else:
            task_highlights.append(f"Tâche: {task.title}")

    opportunity_highlights = [f"Opportunité: {o.title}" for o in opportunities[:2]]
    conflict_highlights = [
        f"Conflit: {c['title_a']} vs {c['title_b']} ({c.get('overlap_minutes', 0)} min)"
        for c in conflicts[:2]
    ]

    priorities: list[str] = []
    if conflicts:
        priorities.append(f"Traiter {len(conflicts)} conflit(s) agenda aujourd'hui.")
    due_today_tasks = [t for t in tasks if t.due_at and now <= t.due_at < tomorrow]
    if due_today_tasks:
        priorities.append(f"Finaliser {len(due_today_tasks)} tâche(s) à échéance aujourd'hui.")
    if opportunities:
        priorities.append(f"Examiner {min(len(opportunities), 3)} opportunité(s) à fort potentiel.")

    return {
        "generated_at": now.isoformat(),
        "events_count": len(events),
        "tasks_count": len(tasks),
        "opportunities_count": len(opportunities),
        "conflicts_count": len(conflicts),
        "highlights": [
            *event_highlights,
            *task_highlights,
            *conflict_highlights,
            *opportunity_highlights,
        ],
        "priorities": priorities,
    }
