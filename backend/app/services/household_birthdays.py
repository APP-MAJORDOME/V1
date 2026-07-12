"""Anniversaires du foyer — stockage serveur partagé."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.models import HouseholdBirthday


def list_household_birthdays(db: Session, household_id: int) -> list[HouseholdBirthday]:
    return (
        db.query(HouseholdBirthday)
        .filter(HouseholdBirthday.household_id == household_id)
        .order_by(HouseholdBirthday.birthday_date.asc(), HouseholdBirthday.id.asc())
        .all()
    )


def create_household_birthday(
    db: Session,
    household_id: int,
    *,
    name: str,
    birthday_date: date,
    notes: str = "",
) -> HouseholdBirthday:
    row = HouseholdBirthday(
        household_id=household_id,
        name=name.strip(),
        birthday_date=birthday_date,
        notes=(notes or "").strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_household_birthday(db: Session, household_id: int, birthday_id: int) -> bool:
    row = db.get(HouseholdBirthday, birthday_id)
    if not row or row.household_id != household_id:
        return False
    db.delete(row)
    db.commit()
    return True
