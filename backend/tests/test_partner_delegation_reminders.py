"""Tests unitaires du worker de relances de délégation partenaire (sans FastAPI)."""

import os
import secrets
from datetime import timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_partner_delegation.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.core.dt import utc_now_naive  # noqa: E402
from app.models.models import Base, Household, TaskDelegation, User  # noqa: E402
from app.services.partner_delegation import process_due_reminders  # noqa: E402


engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base.metadata.create_all(bind=engine)


def _cleanup():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_process_due_reminders_delivers_once():
    _cleanup()
    db = SessionLocal()
    try:
        user = User(email="pdel@majordome.test", password_hash=None, full_name="Owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        hh = Household(name="Foyer", owner_user_id=user.id)
        db.add(hh)
        db.commit()
        db.refresh(hh)
        past = utc_now_naive() - timedelta(hours=1)
        tok = secrets.token_urlsafe(32)
        row = TaskDelegation(
            household_id=hh.id,
            created_by_user_id=user.id,
            partner_display_name="Sam",
            partner_contact=None,
            task_snapshot_json="[]",
            ack_token=tok,
            status="sent",
            acknowledged_at=None,
            next_reminder_at=past,
            reminder_count=0,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        n = process_due_reminders(db)
        assert n == 1
        db.refresh(row)
        assert row.reminder_count == 1
    finally:
        db.close()


def test_process_due_reminders_skips_acknowledged_rows():
    _cleanup()
    db = SessionLocal()
    try:
        user = User(email="pdelack@majordome.test", password_hash=None, full_name="Owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        hh = Household(name="Foyer", owner_user_id=user.id)
        db.add(hh)
        db.commit()
        db.refresh(hh)
        past = utc_now_naive() - timedelta(hours=1)
        tok = secrets.token_urlsafe(32)
        row = TaskDelegation(
            household_id=hh.id,
            created_by_user_id=user.id,
            partner_display_name="Sam",
            partner_contact=None,
            task_snapshot_json="[]",
            ack_token=tok,
            status="acknowledged",
            acknowledged_at=utc_now_naive(),
            next_reminder_at=past,
            reminder_count=0,
        )
        db.add(row)
        db.commit()

        assert process_due_reminders(db) == 0
    finally:
        db.close()
