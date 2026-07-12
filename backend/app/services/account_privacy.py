"""Export des données foyer et demande de suppression de compte (RGPD)."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.models.models import (
    GroceryItem,
    Household,
    HouseholdBirthday,
    HouseholdCapture,
    HouseholdDocument,
    HouseholdFridgeItem,
    HouseholdMember,
    HouseholdMemoryFact,
    HouseholdSalonMessage,
    Task,
    User,
)


def export_household_data(db: Session, user_id: int, household_id: int) -> dict[str, Any]:
    user = db.get(User, user_id)
    household = db.get(Household, household_id)
    members = db.query(HouseholdMember).filter(HouseholdMember.household_id == household_id).all()
    tasks = db.query(Task).filter(Task.household_id == household_id).limit(5000).all()
    groceries = db.query(GroceryItem).filter(GroceryItem.household_id == household_id).limit(5000).all()
    fridge = db.query(HouseholdFridgeItem).filter(HouseholdFridgeItem.household_id == household_id).limit(5000).all()
    docs = db.query(HouseholdDocument).filter(HouseholdDocument.household_id == household_id).limit(2000).all()
    birthdays = db.query(HouseholdBirthday).filter(HouseholdBirthday.household_id == household_id).all()
    memory = db.query(HouseholdMemoryFact).filter(HouseholdMemoryFact.household_id == household_id).all()
    salon = (
        db.query(HouseholdSalonMessage)
        .filter(HouseholdSalonMessage.household_id == household_id)
        .order_by(HouseholdSalonMessage.created_at.desc())
        .limit(500)
        .all()
    )
    captures = db.query(HouseholdCapture).filter(HouseholdCapture.household_id == household_id).limit(500).all()

    return {
        "exported_at": utc_now_naive().isoformat(),
        "user": {
            "id": user.id if user else user_id,
            "email": user.email if user else None,
            "full_name": user.full_name if user else None,
        },
        "household": {
            "id": household.id if household else household_id,
            "name": household.name if household else None,
        },
        "members": [
            {
                "id": m.id,
                "display_name": m.display_name,
                "role": m.role,
                "birth_year": m.birth_year,
            }
            for m in members
        ],
        "tasks": [{"id": t.id, "title": t.title, "status": t.status} for t in tasks],
        "grocery_items": [{"id": g.id, "label": g.label, "done": g.done} for g in groceries],
        "fridge_items": [
            {"id": f.id, "label": f.label, "expires_at": f.expires_at.isoformat() if f.expires_at else None}
            for f in fridge
        ],
        "documents": [{"id": d.id, "name": d.name, "category": d.category} for d in docs],
        "birthdays": [
            {
                "id": b.id,
                "name": b.name,
                "birthday_date": b.birthday_date.isoformat() if b.birthday_date else None,
                "notes": b.notes,
            }
            for b in birthdays
        ],
        "memory_facts": [{"id": m.id, "fact_text": m.fact_text} for m in memory],
        "salon_messages": [
            {"id": s.id, "author_label": s.author_label, "body_text": s.body_text, "created_at": s.created_at.isoformat()}
            for s in salon
        ],
        "captures": [{"id": c.id, "kind": c.kind, "status": c.status, "excerpt": c.excerpt} for c in captures],
    }


def request_account_deletion(db: Session, user_id: int) -> datetime:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found")
    user.deletion_requested_at = utc_now_naive()
    db.commit()
    db.refresh(user)
    return user.deletion_requested_at


def cancel_account_deletion(db: Session, user_id: int) -> bool:
    user = db.get(User, user_id)
    if not user or not user.deletion_requested_at:
        return False
    user.deletion_requested_at = None
    db.commit()
    return True


def deletion_grace_ends_at(requested_at: datetime) -> datetime:
    return requested_at + timedelta(days=14)
