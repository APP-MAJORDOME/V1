"""Calcul de l’usage disque des piè jointes du coffre par foyer."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import HouseholdDocument


def household_attachment_bytes_used(db: Session, household_id: int) -> int:
    total = (
        db.query(func.coalesce(func.sum(HouseholdDocument.attachment_size_bytes), 0))
        .filter(HouseholdDocument.household_id == household_id)
        .filter(HouseholdDocument.attachment_storage_key.isnot(None))
        .scalar()
    )
    return int(total or 0)
