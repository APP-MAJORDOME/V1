"""Équité foyer v2 — balance pondérée exécution + planification."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.models.models import HouseholdMember, Task

EQUITY_CATEGORIES = (
    "enfants",
    "maison",
    "courses_repas",
    "administratif",
    "ecole_social",
    "autre",
)

MEMBER_COLORS = ("#C96B4A", "#4A7C8F", "#7C8F4A", "#8F4A7C", "#B8860B", "#5D6D7E")


def _member_color(idx: int) -> str:
    return MEMBER_COLORS[idx % len(MEMBER_COLORS)]


def _week_start(dt: datetime) -> datetime:
    return (dt - timedelta(days=dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def compute_household_equity(
    db: Session,
    household_id: int,
    *,
    weeks_back: int = 4,
    mode: str = "execution",
) -> dict[str, Any]:
    """mode: execution | planning | combined"""
    members = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household_id)
        .order_by(HouseholdMember.id.asc())
        .all()
    )
    if not members:
        return {
            "members": [],
            "shares": [],
            "weeks": [],
            "categories": [],
            "suggestions": [],
            "mode": mode,
        }

    now = utc_now_naive()
    since = _week_start(now) - timedelta(weeks=weeks_back - 1)

    tasks = (
        db.query(Task)
        .filter(
            Task.household_id == household_id,
            Task.updated_at >= since,
        )
        .all()
    )

    member_by_id = {m.id: m for m in members}
    totals: dict[int, float] = defaultdict(float)
    cat_totals: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    week_totals: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))

    for task in tasks:
        weight = max(int(task.weight_minutes or 15), 1)
        status_mult = 2.0 if task.status == "open" else 1.0
        points = weight * status_mult

        exec_id = task.assigned_member_id or members[0].id
        plan_id = task.planned_by_member_id or exec_id

        if mode == "execution":
            totals[exec_id] += points
            cat_totals[task.equity_category or "autre"][exec_id] += points
        elif mode == "planning":
            totals[plan_id] += points
            cat_totals[task.equity_category or "autre"][plan_id] += points
        else:
            totals[exec_id] += points * 0.6
            totals[plan_id] += points * 0.4
            cat = task.equity_category or "autre"
            cat_totals[cat][exec_id] += points * 0.6
            cat_totals[cat][plan_id] += points * 0.4

        if task.updated_at:
            wk = _week_start(task.updated_at).strftime("%Y-%m-%d")
            week_totals[wk][exec_id if mode != "planning" else plan_id] += points

    grand = sum(totals.values()) or 1.0
    shares = []
    for i, m in enumerate(members):
        pct = round((totals.get(m.id, 0) / grand) * 100)
        shares.append(
            {
                "member_id": m.id,
                "name": m.display_name,
                "pct": pct,
                "minutes": int(totals.get(m.id, 0)),
                "color": _member_color(i),
            }
        )

    weeks_out = []
    for wk in sorted(week_totals.keys())[-weeks_back:]:
        wt = week_totals[wk]
        g = sum(wt.values()) or 1.0
        row: dict[str, Any] = {"label": wk, "members": {}}
        for m in members:
            row["members"][m.display_name] = round((wt.get(m.id, 0) / g) * 100)
        weeks_out.append(row)

    categories_out = []
    cat_labels = {
        "enfants": "Enfants",
        "maison": "Maison",
        "courses_repas": "Courses & repas",
        "administratif": "Administratif",
        "ecole_social": "École & social",
        "autre": "Autre",
    }
    for cat_key, by_member in cat_totals.items():
        g = sum(by_member.values()) or 1.0
        row = {"key": cat_key, "label": cat_labels.get(cat_key, cat_key), "members": {}}
        for m in members:
            row["members"][m.display_name] = round((by_member.get(m.id, 0) / g) * 100)
        categories_out.append(row)

    suggestions = _build_suggestions(db, household_id, members, tasks)

    return {
        "members": [{"id": m.id, "name": m.display_name, "color": _member_color(i)} for i, m in enumerate(members)],
        "shares": shares,
        "weeks": weeks_out,
        "categories": categories_out,
        "suggestions": suggestions,
        "mode": mode,
    }


def _build_suggestions(
    db: Session,
    household_id: int,
    members: list[HouseholdMember],
    tasks: list[Task],
) -> list[dict[str, str]]:
    if len(members) < 2:
        return []
    by_assignee: dict[int, list[Task]] = defaultdict(list)
    for t in tasks:
        if t.status != "open":
            continue
        aid = t.assigned_member_id or members[0].id
        by_assignee[aid].append(t)

    overloaded = max(by_assignee.items(), key=lambda x: len(x[1]), default=(None, []))
    if not overloaded[0] or len(overloaded[1]) < 2:
        return []

    from_member = {m.id: m for m in members}
    from_m = from_member.get(overloaded[0])
    if not from_m:
        return []
    to_m = next((m for m in members if m.id != from_m.id), None)
    if not to_m:
        return []

    sample = overloaded[1][0]
    return [
        {
            "task_id": str(sample.id),
            "task": sample.title,
            "from": from_m.display_name,
            "to": to_m.display_name,
            "message": f"« {sample.title} » revient souvent à {from_m.display_name} — proposer à {to_m.display_name} ?",
            "save": f"~{sample.weight_minutes or 15} min",
        }
    ][:3]
