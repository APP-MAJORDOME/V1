import os
from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_journal_entries.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

import app.main as main_module  # noqa: E402
import app.core.rate_limit as rate_limit_module  # noqa: E402
import app.core.security as security_module  # noqa: E402
from app.main import app  # noqa: E402
from app.core import database as database_module  # noqa: E402
from app.models.models import Base  # noqa: E402


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
    fake = InMemoryRedis()
    security_module.redis_client = fake
    rate_limit_module.redis_client = fake
    main_module.redis.from_url = lambda *args, **kwargs: fake


def _token(client: TestClient, email: str) -> str:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "test12345", "full_name": "Journal User"},
    )
    assert reg.status_code == 200
    return reg.json()["access_token"]


def test_journal_crud_and_isolation():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token_a = _token(client, "journal-a@test.com")
    token_b = _token(client, "journal-b@test.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    today = datetime.now().strftime("%Y-%m-%d")
    created = client.post(
        "/api/v1/journal/entries",
        headers=headers_a,
        json={"entry_date": today, "content": "Première note intime."},
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    second = client.post(
        "/api/v1/journal/entries",
        headers=headers_a,
        json={"entry_date": today, "content": "Deuxième note du même jour."},
    )
    assert second.status_code == 201

    listed = client.get(f"/api/v1/journal/entries?from={today}&to={today}", headers=headers_a)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    updated = client.patch(
        f"/api/v1/journal/entries/{entry_id}",
        headers=headers_a,
        json={"content": "Note modifiée."},
    )
    assert updated.status_code == 200
    assert updated.json()["content"] == "Note modifiée."

    other = client.get(f"/api/v1/journal/entries?from={today}&to={today}", headers=headers_b)
    assert other.status_code == 200
    assert len(other.json()) == 0

    deleted = client.delete(f"/api/v1/journal/entries/{entry_id}", headers=headers_a)
    assert deleted.status_code == 204
