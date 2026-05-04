"""Crée ou met à jour les HouseholdMember à partir des prénoms du profil famille (app)."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import HouseholdMember

PRIMARY_ROLE = "primary_adult"
PARTNER_ROLE = "partner_adult"
CHILD_ROLE = "child"


def sync_members_from_profile_names(
    db: Session,
    *,
    household_id: int,
    primary_name: str,
    partner_name: str,
    child_name: str,
) -> list[HouseholdMember]:
    """Upsert membres par nom affiché (insensible à la casse). Évite les doublons si deux rôles ont le même prénom."""
    specs: list[tuple[str, str]] = [
        (primary_name.strip(), PRIMARY_ROLE),
        (partner_name.strip(), PARTNER_ROLE),
        (child_name.strip(), CHILD_ROLE),
    ]
    seen_lower: set[str] = set()
    touched: list[HouseholdMember] = []

    for display_name, role in specs:
        if not display_name:
            continue
        key = display_name.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)

        row = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == household_id,
                func.lower(HouseholdMember.display_name) == key,
            )
            .first()
        )
        if row:
            if row.role != role:
                row.role = role
                db.add(row)
            touched.append(row)
        else:
            row = HouseholdMember(household_id=household_id, display_name=display_name, role=role)
            db.add(row)
            touched.append(row)

    db.commit()
    for r in touched:
        db.refresh(r)
    return touched


def resolve_partner_member(db: Session, household_id: int, partner_display_name: str) -> HouseholdMember | None:
    """Préfère role partner_adult (après sync profil), sinon premier membre dont le prénom ressemble à partner_display_name."""
    pn = partner_display_name.strip()
    if not pn:
        return None
    by_role = (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.household_id == household_id,
            HouseholdMember.role == PARTNER_ROLE,
        )
        .order_by(HouseholdMember.id.asc())
        .first()
    )
    if by_role:
        return by_role
    return (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.household_id == household_id,
            HouseholdMember.display_name.ilike(f"%{pn}%"),
        )
        .order_by(HouseholdMember.id.asc())
        .first()
    )
