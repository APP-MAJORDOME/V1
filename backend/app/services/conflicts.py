from app.models.models import CanonicalEvent


def detect_conflicts(events: list[CanonicalEvent]) -> list[dict]:
    # Sweep-line style overlap detection: compare each event to subsequent events
    # until we can guarantee no more overlaps for the current event.
    events_sorted = sorted(events, key=lambda e: e.starts_at)
    conflicts: list[dict] = []
    for i in range(len(events_sorted)):
        current = events_sorted[i]
        for j in range(i + 1, len(events_sorted)):
            other = events_sorted[j]
            if other.starts_at >= current.ends_at:
                break
            overlap_start = max(current.starts_at, other.starts_at)
            overlap_end = min(current.ends_at, other.ends_at)
            overlap_minutes = max(int((overlap_end - overlap_start).total_seconds() // 60), 0)
            conflicts.append(
                {
                    "event_a": current.id,
                    "event_b": other.id,
                    "title_a": current.title,
                    "title_b": other.title,
                    "starts_at": current.starts_at.isoformat(),
                    "next_starts_at": other.starts_at.isoformat(),
                    "overlap_minutes": overlap_minutes,
                    "severity": "high" if overlap_minutes >= 60 else "medium",
                }
            )
    return conflicts
