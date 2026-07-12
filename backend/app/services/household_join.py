"""Invitation foyer : rattacher un User à un Household existant via invite_code."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.models import Household, HouseholdMember, User
from app.services.household_proactive import _ensure_invite_code

PARTNER_ROLE = "partner_adult"
ADULT_ROLE = "adult_member"


def find_household_by_invite_code(db: Session, code: str) -> Household | None:
    cleaned = (code or "").strip().upper()
    if len(cleaned) < 6:
        return None
    return db.query(Household).filter(Household.invite_code == cleaned).first()


def preview_invite(db: Session, code: str) -> dict:
    hh = find_household_by_invite_code(db, code)
    if hh is None:
        return {"ok": False, "invite_code": (code or "").strip().upper(), "household_name": None}
    owner_name = ""
    if hh.owner_user_id:
        owner = db.get(User, hh.owner_user_id)
        if owner and owner.full_name:
            owner_name = owner.full_name.strip()
    return {
        "ok": True,
        "invite_code": hh.invite_code,
        "household_id": hh.id,
        "household_name": hh.name,
        "owner_name": owner_name or None,
        "household_type": hh.household_type,
    }


def user_has_household_access(db: Session, *, user_id: int, household_id: int) -> bool:
    hh = db.get(Household, household_id)
    if hh is None:
        return False
    if hh.owner_user_id == user_id:
        return True
    linked = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household_id, HouseholdMember.user_id == user_id)
        .first()
    )
    return linked is not None


def list_household_ids_for_user(db: Session, user_id: int) -> list[int]:
    """Foyers accessibles. Priorité : memberships (join) puis ownership solo."""
    owned = [
        int(r.id)
        for r in db.query(Household).filter(Household.owner_user_id == user_id).order_by(Household.id.asc()).all()
    ]
    member_ids = [
        int(r.household_id)
        for r in db.query(HouseholdMember)
        .filter(HouseholdMember.user_id == user_id)
        .order_by(HouseholdMember.id.asc())
        .all()
    ]
    out: list[int] = []
    for hid in member_ids + owned:
        if hid not in out:
            out.append(hid)
    return out


def _release_empty_owned_households(db: Session, *, user: User, keep_household_id: int) -> None:
    """Après un join : abandonne les foyers perso dont l'user était seul owner lié."""
    owned = (
        db.query(Household)
        .filter(Household.owner_user_id == user.id, Household.id != keep_household_id)
        .all()
    )
    for hh in owned:
        other_linked = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == hh.id,
                HouseholdMember.user_id.isnot(None),
                HouseholdMember.user_id != user.id,
            )
            .count()
        )
        if other_linked == 0:
            hh.owner_user_id = None
            db.add(hh)


def _sync_messaging_household(db: Session, *, user_id: int, household_id: int) -> None:
    """Met à jour household_id dans Telegram/WhatsApp ConnectedAccount après join."""
    from app.models.models import ConnectedAccount
    import json

    rows = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider.in_(["telegram", "whatsapp"]),
        )
        .all()
    )
    for account in rows:
        try:
            meta = json.loads(account.scopes_json or "{}")
            if not isinstance(meta, dict):
                meta = {}
        except Exception:
            meta = {}
        meta["household_id"] = household_id
        account.scopes_json = json.dumps(meta, ensure_ascii=False)
        db.add(account)


def attach_user_to_household(
    db: Session,
    *,
    user: User,
    household: Household,
    role: str = PARTNER_ROLE,
) -> HouseholdMember:
    """Lie le compte au foyer (membre avec user_id). Un user = un foyer lié max."""
    # Détache d'un autre foyer si déjà membre ailleurs
    existing_links = (
        db.query(HouseholdMember).filter(HouseholdMember.user_id == user.id).all()
    )
    for link in existing_links:
        if link.household_id != household.id:
            link.user_id = None
            db.add(link)

    # Réutilise un membre partner sans compte, ou crée
    member = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household.id, HouseholdMember.user_id == user.id)
        .first()
    )
    if member is None:
        by_name = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == household.id,
                HouseholdMember.user_id.is_(None),
                HouseholdMember.display_name.ilike(user.full_name.strip()),
            )
            .first()
            if user.full_name and user.full_name.strip()
            else None
        )
        if by_name is None:
            # Premier partenaire libre sans user
            by_name = (
                db.query(HouseholdMember)
                .filter(
                    HouseholdMember.household_id == household.id,
                    HouseholdMember.user_id.is_(None),
                    HouseholdMember.role.in_([PARTNER_ROLE, ADULT_ROLE, "adult_member"]),
                )
                .order_by(HouseholdMember.id.asc())
                .first()
            )
        member = by_name
    if member is None:
        member = HouseholdMember(
            household_id=household.id,
            display_name=(user.full_name or user.email.split("@")[0])[:255],
            role=role,
            user_id=user.id,
        )
        db.add(member)
    else:
        member.user_id = user.id
        if user.full_name and user.full_name.strip():
            member.display_name = user.full_name.strip()[:255]
        if member.role in {"child", ""}:
            member.role = role
        elif not member.role or member.role == "adult_member":
            member.role = role
        db.add(member)

    _ensure_invite_code(db, household)
    db.commit()
    db.refresh(member)
    return member


def join_household_by_code(
    db: Session,
    *,
    user: User,
    invite_code: str,
) -> Household:
    hh = find_household_by_invite_code(db, invite_code)
    if hh is None:
        raise ValueError("invite_not_found")
    if hh.owner_user_id == user.id:
        return hh
    attach_user_to_household(db, user=user, household=hh, role=PARTNER_ROLE)
    _release_empty_owned_households(db, user=user, keep_household_id=hh.id)
    _sync_messaging_household(db, user_id=user.id, household_id=hh.id)
    db.commit()
    return hh
