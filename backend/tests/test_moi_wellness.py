import os
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_moi_wellness.db"
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
    fake_redis = InMemoryRedis()
    security_module.redis_client = fake_redis
    rate_limit_module.redis_client = fake_redis
    main_module.redis.from_url = lambda *args, **kwargs: fake_redis


def _token(client: TestClient, email: str = "moi@majordome.test") -> str:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "test12345", "full_name": "Moi User"},
    )
    assert reg.status_code == 200
    return reg.json()["access_token"]


def test_moi_wellness_get_and_put():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token = _token(client, "moi-wellness@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}

    initial = client.get("/api/v1/moi/wellness", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["cycle_day"] == 18
    assert len(initial.json()["moments"]) == 3

    updated = client.put(
        "/api/v1/moi/wellness",
        headers=headers,
        json={
            "journal": "Belle journée en famille.",
            "cycle_day": 12,
            "sleep_hours": 8.5,
            "moi_mood": 4,
            "home_mood": 2,
            "moments": [
                {"id": "m1", "label": "Marche", "done": True},
                {"id": "m2", "label": "Méditation", "done": False},
            ],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["journal"] == "Belle journée en famille."
    assert body["cycle_day"] == 12
    assert body["sleep_hours"] == 8.5
    assert body["moi_mood"] == 4
    assert body["home_mood"] == 2
    assert body["moments"][0]["done"] is True

    again = client.get("/api/v1/moi/wellness", headers=headers).json()
    assert again["journal"] == "Belle journée en famille."
    assert again["cycle_day"] == 12


def test_moi_wellness_household_isolation():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token_a = _token(client, "moia@majordome.test")
    token_b = _token(client, "moib@majordome.test")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.put(
        "/api/v1/moi/wellness",
        headers=headers_a,
        json={"journal": "Secret A", "cycle_day": 5, "moments": []},
    )
    other = client.get("/api/v1/moi/wellness", headers=headers_b).json()
    assert other["journal"] != "Secret A"
    assert other["cycle_day"] == 18
