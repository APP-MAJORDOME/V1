import os
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_household_join.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

import app.main as main_module  # noqa: E402
import app.core.rate_limit as rate_limit_module  # noqa: E402
import app.core.security as security_module  # noqa: E402
from app.main import app  # noqa: E402
from app.core import database as database_module  # noqa: E402
from app.models.models import Base, Household, HouseholdMember, User  # noqa: E402
from app.services.household_proactive import _ensure_invite_code  # noqa: E402


class InMemoryRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    def incr(self, key: str) -> int:
        value = int(self.store.get(key, "0")) + 1
        self.store[key] = str(value)
        return value

    def expire(self, key: str, seconds: int) -> bool:
        return True

    def setex(self, key: str, seconds: int, value: str) -> bool:
        self.store[key] = value
        return True

    def get(self, key: str):
        return self.store.get(key)

    def delete(self, key: str) -> int:
        return 1 if self.store.pop(key, None) is not None else 0

    def ping(self) -> bool:
        return True


engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
database_module.SessionLocal = TestingSessionLocal
main_module.SessionLocal = TestingSessionLocal
Base.metadata.create_all(bind=engine)


def _cleanup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _install_fake_redis():
    fake_redis = InMemoryRedis()
    security_module.redis_client = fake_redis
    rate_limit_module.redis_client = fake_redis
    main_module.redis.from_url = lambda *args, **kwargs: fake_redis


def test_register_with_invite_joins_existing_household():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    owner = client.post(
        "/api/v1/auth/register",
        json={"email": "owner@join.test", "password": "test12345", "full_name": "Owner"},
    )
    assert owner.status_code == 200
    owner_hh = owner.json()["household_id"]

    db = TestingSessionLocal()
    try:
        hh = db.get(Household, owner_hh)
        assert hh is not None
        code = _ensure_invite_code(db, hh)
    finally:
        db.close()

    preview = client.get(f"/api/v1/public/household/invite/{code}")
    assert preview.status_code == 200
    assert preview.json()["ok"] is True
    assert preview.json()["household_id"] == owner_hh

    partner = client.post(
        "/api/v1/auth/register",
        json={
            "email": "partner@join.test",
            "password": "test12345",
            "full_name": "Partner",
            "invite_code": code,
        },
    )
    assert partner.status_code == 200
    body = partner.json()
    assert body["household_id"] == owner_hh

    db = TestingSessionLocal()
    try:
        link = (
            db.query(HouseholdMember)
            .filter(HouseholdMember.user_id == body["user_id"], HouseholdMember.household_id == owner_hh)
            .first()
        )
        assert link is not None
        assert link.display_name == "Partner"
        # Pas de second foyer créé pour le partenaire
        owned = db.query(Household).filter(Household.owner_user_id == body["user_id"]).count()
        assert owned == 0
    finally:
        db.close()

    tasks = client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert tasks.status_code == 200


def test_login_with_invite_attaches_existing_user():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    owner = client.post(
        "/api/v1/auth/register",
        json={"email": "owner2@join.test", "password": "test12345", "full_name": "Owner"},
    )
    solo = client.post(
        "/api/v1/auth/register",
        json={"email": "solo@join.test", "password": "test12345", "full_name": "Solo"},
    )
    assert solo.status_code == 200
    solo_hh = solo.json()["household_id"]
    owner_hh = owner.json()["household_id"]
    assert solo_hh != owner_hh

    db = TestingSessionLocal()
    try:
        code = _ensure_invite_code(db, db.get(Household, owner_hh))
    finally:
        db.close()

    joined = client.post(
        "/api/v1/auth/login",
        json={
            "email": "solo@join.test",
            "password": "test12345",
            "invite_code": code,
        },
    )
    assert joined.status_code == 200
    assert joined.json()["household_id"] == owner_hh


def test_auth_join_when_already_logged_in():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    owner = client.post(
        "/api/v1/auth/register",
        json={"email": "owner3@join.test", "password": "test12345", "full_name": "Owner"},
    )
    partner = client.post(
        "/api/v1/auth/register",
        json={"email": "p3@join.test", "password": "test12345", "full_name": "P3"},
    )
    owner_hh = owner.json()["household_id"]
    token = partner.json()["access_token"]

    db = TestingSessionLocal()
    try:
        code = _ensure_invite_code(db, db.get(Household, owner_hh))
    finally:
        db.close()

    res = client.post(
        "/api/v1/auth/join",
        json={"invite_code": code},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["household_id"] == owner_hh


def test_plain_login_after_join_keeps_joined_household():
    """Après join, un login sans invite_code doit rester sur le foyer rejoint (pas le solo abandonné)."""
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    owner = client.post(
        "/api/v1/auth/register",
        json={"email": "owner4@join.test", "password": "test12345", "full_name": "Owner"},
    )
    partner = client.post(
        "/api/v1/auth/register",
        json={"email": "p4@join.test", "password": "test12345", "full_name": "P4"},
    )
    owner_hh = owner.json()["household_id"]
    partner_solo = partner.json()["household_id"]
    assert partner_solo != owner_hh

    db = TestingSessionLocal()
    try:
        code = _ensure_invite_code(db, db.get(Household, owner_hh))
    finally:
        db.close()

    joined = client.post(
        "/api/v1/auth/join",
        json={"invite_code": code},
        headers={"Authorization": f"Bearer {partner.json()['access_token']}"},
    )
    assert joined.status_code == 200
    assert joined.json()["household_id"] == owner_hh

    again = client.post(
        "/api/v1/auth/login",
        json={"email": "p4@join.test", "password": "test12345"},
    )
    assert again.status_code == 200
    assert again.json()["household_id"] == owner_hh

    db = TestingSessionLocal()
    try:
        solo = db.get(Household, partner_solo)
        assert solo is not None
        assert solo.owner_user_id is None
    finally:
        db.close()


def test_join_syncs_telegram_scopes_household_id():
    import json

    from app.models.models import ConnectedAccount

    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    owner = client.post(
        "/api/v1/auth/register",
        json={"email": "owner5@join.test", "password": "test12345", "full_name": "Owner"},
    )
    partner = client.post(
        "/api/v1/auth/register",
        json={"email": "p5@join.test", "password": "test12345", "full_name": "P5"},
    )
    owner_hh = owner.json()["household_id"]
    partner_id = partner.json()["user_id"]
    partner_solo = partner.json()["household_id"]

    db = TestingSessionLocal()
    try:
        code = _ensure_invite_code(db, db.get(Household, owner_hh))
        db.add(
            ConnectedAccount(
                user_id=partner_id,
                provider="telegram",
                external_account_id="123",
                scopes_json=json.dumps({"household_id": partner_solo, "chat_id": 123}),
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/v1/auth/join",
        json={"invite_code": code},
        headers={"Authorization": f"Bearer {partner.json()['access_token']}"},
    )
    assert res.status_code == 200

    db = TestingSessionLocal()
    try:
        row = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == partner_id, ConnectedAccount.provider == "telegram")
            .first()
        )
        assert row is not None
        meta = json.loads(row.scopes_json or "{}")
        assert meta["household_id"] == owner_hh
    finally:
        db.close()


def test_invalid_invite_code():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    preview = client.get("/api/v1/public/household/invite/NOPE123456")
    assert preview.status_code == 200
    assert preview.json()["ok"] is False

    bad = client.post(
        "/api/v1/auth/register",
        json={
            "email": "bad@join.test",
            "password": "test12345",
            "full_name": "Bad",
            "invite_code": "NOPE123456",
        },
    )
    assert bad.status_code == 404
