"""Tests unitaires sync / résolution membre partenaire (sans FastAPI)."""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_household_profile_members.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.models.models import Base, Household, HouseholdMember, User  # noqa: E402
from app.services.household_profile_members import (  # noqa: E402
    resolve_partner_member,
    sync_members_from_profile_names,
)


engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base.metadata.create_all(bind=engine)


def _cleanup():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _seed_household(db):
    user = User(email="hpm@majordome.test", password_hash=None, full_name="X")
    db.add(user)
    db.commit()
    db.refresh(user)
    hh = Household(name="Foyer", owner_user_id=user.id)
    db.add(hh)
    db.commit()
    db.refresh(hh)
    return hh


def test_sync_skips_second_role_when_same_name_case_insensitive():
    _cleanup()
    db = SessionLocal()
    try:
        hh = _seed_household(db)
        rows = sync_members_from_profile_names(
            db,
            household_id=hh.id,
            primary_name="Jo",
            partner_name="jo",
            child_name="",
        )
        assert len(rows) == 1
        assert rows[0].display_name == "Jo"
        assert rows[0].role == "primary_adult"
        assert db.query(HouseholdMember).filter(HouseholdMember.household_id == hh.id).count() == 1
    finally:
        db.close()


def test_resolve_partner_returns_first_partner_adult_regardless_of_query():
    _cleanup()
    db = SessionLocal()
    try:
        hh = _seed_household(db)
        db.add(
            HouseholdMember(household_id=hh.id, display_name="Patricia", role="primary_adult"),
        )
        db.add(
            HouseholdMember(household_id=hh.id, display_name="Paul", role="partner_adult"),
        )
        db.commit()
        found = resolve_partner_member(db, hh.id, "n importe quoi")
        assert found is not None
        assert found.display_name == "Paul"
        assert found.role == "partner_adult"
    finally:
        db.close()


def test_resolve_partner_ilike_when_no_partner_adult_role():
    _cleanup()
    db = SessionLocal()
    try:
        hh = _seed_household(db)
        db.add(HouseholdMember(household_id=hh.id, display_name="Marie Dupont", role="primary_adult"))
        db.commit()
        found = resolve_partner_member(db, hh.id, "marie")
        assert found is not None
        assert found.display_name == "Marie Dupont"
    finally:
        db.close()


def test_resolve_partner_empty_name_returns_none():
    _cleanup()
    db = SessionLocal()
    try:
        hh = _seed_household(db)
        db.add(HouseholdMember(household_id=hh.id, display_name="X", role="partner_adult"))
        db.commit()
        assert resolve_partner_member(db, hh.id, "   ") is None
    finally:
        db.close()
