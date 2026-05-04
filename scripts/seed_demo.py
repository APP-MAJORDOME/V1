import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_PATH = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.append(str(BACKEND_PATH))

from app.models.models import Base, User, Household, HouseholdMember, CanonicalEvent, Task, Opportunity  # noqa: E402
from app.core.security import hash_password  # noqa: E402

DATABASE_URL = os.getenv("MAJORDOME_DATABASE_URL", "postgresql://majordome:majordome@localhost:5432/majordome")
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, future=True)

Base.metadata.create_all(bind=engine)

with SessionLocal() as db:
    demo_user = db.query(User).filter(User.email == "demo@majordome.fr").first()
    if demo_user is None:
        demo_user = User(
            email="demo@majordome.fr",
            password_hash=hash_password("demo12345"),
            full_name="Demo User",
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
    elif demo_user.password_hash is None:
        demo_user.password_hash = hash_password("demo12345")
        db.commit()

    household = db.query(Household).filter(Household.owner_user_id == demo_user.id).first()
    if household is None:
        household = Household(name="Famille Demo", owner_user_id=demo_user.id)
        db.add(household)
        db.commit()
        db.refresh(household)

    emma = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household.id, HouseholdMember.display_name == "Emma")
        .first()
    )
    if emma is None:
        emma = HouseholdMember(household_id=household.id, display_name="Emma", role="child", birth_year=2018)
        db.add(emma)
        db.commit()
        db.refresh(emma)

    alex = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household.id, HouseholdMember.display_name == "Alex")
        .first()
    )
    if alex is None:
        alex = HouseholdMember(household_id=household.id, display_name="Alex", role="adult_member")
        db.add(alex)
        db.commit()
        db.refresh(alex)

    now = datetime.utcnow()
    existing_event_titles = {
        e.title for e in db.query(CanonicalEvent).filter(CanonicalEvent.household_id == household.id).all()
    }
    if "Médecin Emma" not in existing_event_titles:
        db.add(
            CanonicalEvent(
                household_id=household.id,
                member_id=emma.id,
                title="Médecin Emma",
                category="medical",
                starts_at=now + timedelta(hours=8),
                ends_at=now + timedelta(hours=9),
            )
        )
    if "Réunion pro" not in existing_event_titles:
        db.add(
            CanonicalEvent(
                household_id=household.id,
                member_id=alex.id,
                title="Réunion pro",
                category="work",
                starts_at=now + timedelta(hours=8, minutes=30),
                ends_at=now + timedelta(hours=10),
            )
        )

    existing_task_titles = {
        t.title for t in db.query(Task).filter(Task.household_id == household.id).all()
    }
    if "Préparer les livres bibliothèque" not in existing_task_titles:
        db.add(
            Task(
                household_id=household.id,
                assigned_member_id=alex.id,
                title="Préparer les livres bibliothèque",
                task_type="prep_task",
                due_at=now + timedelta(hours=6),
            )
        )

    existing_opportunity_titles = {
        o.title for o in db.query(Opportunity).filter(Opportunity.household_id == household.id).all()
    }
    if "Prime de rentrée détectée" not in existing_opportunity_titles:
        db.add(
            Opportunity(
                household_id=household.id,
                title="Prime de rentrée détectée",
                summary="Une opportunité potentielle a été détectée pour le foyer.",
                score=0.87,
                category="public_aid",
            )
        )

    db.commit()
    print("Seed demo idempotent terminé pour demo@majordome.fr")
