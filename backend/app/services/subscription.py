"""M3 — limites freemium par foyer."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.models.models import Household

FREE_CAPTURES_PER_MONTH = 15
PREMIUM_TIERS = frozenset({"premium", "founder"})


def _month_key() -> str:
    return utc_now_naive().strftime("%Y-%m")


def get_subscription_status(db: Session, household_id: int) -> dict:
    hh = db.get(Household, household_id)
    if hh is None:
        return {
            "tier": "free",
            "captures_limit": FREE_CAPTURES_PER_MONTH,
            "captures_used": 0,
            "captures_remaining": FREE_CAPTURES_PER_MONTH,
            "premium": False,
        }
    tier = (hh.subscription_tier or "free").lower()
    mk = _month_key()
    if (hh.captures_month_key or "") != mk:
        hh.captures_month_key = mk
        hh.captures_used_month = 0
        db.commit()
        db.refresh(hh)
    used = int(hh.captures_used_month or 0)
    limit = 999999 if tier in PREMIUM_TIERS else FREE_CAPTURES_PER_MONTH
    return {
        "tier": tier,
        "captures_limit": limit,
        "captures_used": used,
        "captures_remaining": max(0, limit - used),
        "premium": tier in PREMIUM_TIERS,
    }


def can_create_capture(db: Session, household_id: int) -> tuple[bool, str]:
    st = get_subscription_status(db, household_id)
    if st["captures_remaining"] > 0:
        return True, ""
    return False, "Tu as utilisé tes 15 captures Alfred ce mois-ci. Passe en Premium Foyer pour continuer."


def increment_capture_usage(db: Session, household_id: int, count: int = 1) -> None:
    hh = db.get(Household, household_id)
    if hh is None:
        return
    mk = _month_key()
    if (hh.captures_month_key or "") != mk:
        hh.captures_month_key = mk
        hh.captures_used_month = 0
    hh.captures_used_month = int(hh.captures_used_month or 0) + count
    db.commit()
