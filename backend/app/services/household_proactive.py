"""Posts proactifs Alfred dans le Salon : briefing matin + conseil de foyer."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.models.models import Household, HouseholdSalonMessage
from app.services.briefing import build_today_briefing
from app.services.household_equity import compute_household_equity


def _week_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _ensure_invite_code(db: Session, household: Household) -> str:
    if household.invite_code:
        return household.invite_code
    code = secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:10].upper()
    household.invite_code = code
    db.commit()
    db.refresh(household)
    return code


def get_household_invite_info(db: Session, household_id: int, base_url: str = "https://majordom.eu") -> dict:
    hh = db.get(Household, household_id)
    if hh is None:
        return {"invite_code": "", "invite_url": ""}
    code = _ensure_invite_code(db, hh)
    return {
        "invite_code": code,
        "invite_url": f"{base_url}/?join={code}",
        "share_text": f"Rejoins notre foyer sur MajorDome : {base_url}/?join={code}",
    }


def _post_alfred_message(db: Session, household_id: int, body: str) -> None:
    db.add(
        HouseholdSalonMessage(
            household_id=household_id,
            author_user_id=None,
            author_label="Alfred",
            body_text=body[:2000],
        )
    )


def maybe_post_morning_briefing(db: Session, household_id: int) -> bool:
    hh = db.get(Household, household_id)
    if hh is None:
        return False
    now = utc_now_naive()
    today = now.strftime("%Y-%m-%d")
    if hh.last_morning_briefing_date == today:
        return False
    if now.hour < int(hh.briefing_hour or 7):
        return False

    briefing = build_today_briefing(db, household_id)
    lines = ["☀️ **Briefing du jour**", ""]
    if briefing.get("highlights"):
        lines.extend(f"• {h}" for h in briefing["highlights"][:6])
    else:
        lines.append("• Journée calme pour l'instant — profites-en.")
    if briefing.get("priorities"):
        lines.append("")
        lines.append("Priorités :")
        lines.extend(f"• {p}" for p in briefing["priorities"][:3])
    _post_alfred_message(db, household_id, "\n".join(lines))
    hh.last_morning_briefing_date = today
    db.commit()
    return True


def maybe_post_equity_council(db: Session, household_id: int) -> bool:
    hh = db.get(Household, household_id)
    if hh is None:
        return False
    now = utc_now_naive()
    wk = _week_key(now)
    if hh.last_equity_council_week == wk:
        return False
    if now.weekday() != int(hh.equity_council_weekday or 6):
        return False
    if now.hour < int(hh.equity_council_hour or 18):
        return False

    equity = compute_household_equity(db, household_id, weeks_back=1, mode="combined")
    shares = equity.get("shares") or []
    suggestions = equity.get("suggestions") or []

    lines = ["📊 **Conseil de foyer — la semaine du foyer**", ""]
    if shares:
        lines.append("Balance : " + " · ".join(f"{s['name']} {s['pct']}%" for s in shares[:4]))
    else:
        lines.append("Pas encore assez de tâches pour une balance — ajoute-en quelques-unes.")
    if suggestions:
        lines.append("")
        lines.append("Propositions de rééquilibrage :")
        for s in suggestions[:3]:
            lines.append(f"• {s.get('message', s.get('task', ''))}")
    _post_alfred_message(db, household_id, "\n".join(lines))
    hh.last_equity_council_week = wk
    db.commit()
    return True


def run_proactive_household_tick(db: Session, household_id: int) -> dict:
    briefing = maybe_post_morning_briefing(db, household_id)
    council = maybe_post_equity_council(db, household_id)
    return {"briefing_posted": briefing, "council_posted": council}
