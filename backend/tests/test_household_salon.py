import os
from pathlib import Path

TEST_DB = Path(__file__).resolve().parent / "test_household_salon.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.security import AuthContext
from app.models.models import Household, HouseholdMember, User
from app.services.household_salon import (
    analyze_salon_conversation,
    create_salon_message,
    list_household_captures,
    patch_capture_status,
    seed_salon_demo,
)

engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def _reset():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _setup():
    _reset()
    db = TestingSession()
    user = User(email="salon@test.local", full_name="Camille", password_hash="x")
    hh = Household(name="Test", owner_user_id=None)
    db.add_all([user, hh])
    db.flush()
    hh.owner_user_id = user.id
    db.add(HouseholdMember(household_id=hh.id, display_name="Antoine", role="adult_member"))
    db.commit()
    auth = AuthContext(user_id=user.id, household_id=hh.id, token="t", jti="j", token_type="access")
    return db, auth


def test_salon_message_and_analyze_creates_capture():
    db, auth = _setup()
    create_salon_message(db, auth, "Léo dentiste samedi stp")
    n = analyze_salon_conversation(db, auth.household_id)
    assert n >= 1
    caps = list_household_captures(db, auth.household_id, status="pending")
    assert any("dentiste" in c["excerpt"].lower() for c in caps)
    # Re-analyse : pas de doublon
    n2 = analyze_salon_conversation(db, auth.household_id)
    assert n2 == 0


def test_approve_capture_creates_grocery():
    db, auth = _setup()
    create_salon_message(db, auth, "Pain demain matin")
    analyze_salon_conversation(db, auth.household_id)
    caps = list_household_captures(db, auth.household_id, status="pending")
    pain = next(c for c in caps if "pain" in c["excerpt"].lower())
    out = patch_capture_status(db, auth, pain["id"], "approved")
    assert out is not None
    assert out.get("apply", {}).get("executed") is True


def test_seed_demo_populates_salon():
    db, auth = _setup()
    assert seed_salon_demo(db, auth) is True
    assert seed_salon_demo(db, auth) is False
    caps = list_household_captures(db, auth.household_id)
    assert len(caps) >= 1
    # Chaque capture a un titre cohérent avec son excerpt
    for c in caps:
        st = (c.get("payload") or {}).get("structured") or {}
        title = str(st.get("title") or "").lower()
        ex = c["excerpt"].lower()
        if "dentiste" in ex:
            assert "dentiste" in title
        if "toussaint" in ex:
            assert "dentiste" not in title
        if "pain" in ex:
            assert st.get("type") == "grocery" or "pain" in title


def test_new_message_does_not_reuse_dentiste_payload():
    db, auth = _setup()
    create_salon_message(db, auth, "Léo dentiste samedi, tu peux le noter ?")
    analyze_salon_conversation(db, auth.household_id)
    create_salon_message(db, auth, "et sors les poubelles de verre")
    analyze_salon_conversation(db, auth.household_id)
    caps = list_household_captures(db, auth.household_id, status="pending")
    poubelle = next(c for c in caps if "poubelle" in c["excerpt"].lower())
    st = (poubelle.get("payload") or {}).get("structured") or {}
    assert "dentiste" not in str(st.get("title") or "").lower()
    assert st.get("type") == "task"
