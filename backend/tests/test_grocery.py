import os
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_grocery.db"
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


def _token(client: TestClient, email: str = "grocery@majordome.test") -> str:
    payload = {"email": email, "password": "test12345", "full_name": "Grocery User"}
    reg = client.post("/api/v1/auth/register", json=payload)
    assert reg.status_code == 200
    return reg.json()["access_token"]


def test_grocery_crud_and_clear_done():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}

    empty = client.get("/api/v1/grocery/items", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == []

    created = client.post("/api/v1/grocery/items", headers=headers, json={"label": "Lait"})
    assert created.status_code == 200
    item_id = created.json()["id"]
    assert created.json()["label"] == "Lait"
    assert created.json()["done"] is False

    dup = client.post("/api/v1/grocery/items", headers=headers, json={"label": "lait"})
    assert dup.status_code == 200
    assert dup.json()["id"] == item_id

    patched = client.patch(f"/api/v1/grocery/items/{item_id}", headers=headers, json={"done": True})
    assert patched.status_code == 200
    assert patched.json()["done"] is True

    listed = client.get("/api/v1/grocery/items", headers=headers).json()
    assert len(listed) == 1
    assert listed[0]["done"] is True

    cleared = client.delete("/api/v1/grocery/items/done", headers=headers)
    assert cleared.status_code == 200
    assert client.get("/api/v1/grocery/items", headers=headers).json() == []

    created2 = client.post("/api/v1/grocery/items", headers=headers, json={"label": "Pain"})
    rid = created2.json()["id"]
    deleted = client.delete(f"/api/v1/grocery/items/{rid}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/v1/grocery/items", headers=headers).json() == []


def test_grocery_isolated_by_household():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token_a = _token(client, "groa@majordome.test")
    token_b = _token(client, "grob@majordome.test")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    created = client.post("/api/v1/grocery/items", headers=headers_a, json={"label": "Fromage"})
    item_id = created.json()["id"]

    forbidden = client.patch(f"/api/v1/grocery/items/{item_id}", headers=headers_b, json={"done": True})
    assert forbidden.status_code == 404
    assert client.get("/api/v1/grocery/items", headers=headers_b).json() == []
