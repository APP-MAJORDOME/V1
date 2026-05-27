import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_wallet.db"
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


def _token(client: TestClient, email: str = "wallet@majordome.test") -> str:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "test12345", "full_name": "Wallet User"},
    )
    assert reg.status_code == 200
    return reg.json()["access_token"]


def test_wallet_cards_crud():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/wallet/cards",
        headers=headers,
        json={"brand": "Carrefour", "points": 420, "color": "#2B7A4B"},
    )
    assert created.status_code == 200
    card_id = created.json()["id"]
    assert created.json()["points"] == 420

    listed = client.get("/api/v1/wallet/cards", headers=headers).json()
    assert len(listed) == 1

    patched = client.patch(
        f"/api/v1/wallet/cards/{card_id}",
        headers=headers,
        json={"points": 500},
    )
    assert patched.status_code == 200
    assert patched.json()["points"] == 500

    deleted = client.delete(f"/api/v1/wallet/cards/{card_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/v1/wallet/cards", headers=headers).json() == []


def test_wallet_coupons_crud():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    expires = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat().replace("+00:00", "Z")

    created = client.post(
        "/api/v1/wallet/coupons",
        headers=headers,
        json={"label": "10% produits bébé", "expires_at": expires, "discount": "-10%"},
    )
    assert created.status_code == 200
    coupon_id = created.json()["id"]

    listed = client.get("/api/v1/wallet/coupons", headers=headers).json()
    assert len(listed) == 1

    patched = client.patch(
        f"/api/v1/wallet/coupons/{coupon_id}",
        headers=headers,
        json={"discount": "-15%"},
    )
    assert patched.status_code == 200
    assert patched.json()["discount"] == "-15%"

    deleted = client.delete(f"/api/v1/wallet/coupons/{coupon_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/v1/wallet/coupons", headers=headers).json() == []


def test_wallet_household_isolation():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    token_a = _token(client, "wla@majordome.test")
    token_b = _token(client, "wlb@majordome.test")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().replace("+00:00", "Z")

    card = client.post(
        "/api/v1/wallet/cards",
        headers=headers_a,
        json={"brand": "Monoprix", "points": 100},
    )
    card_id = card.json()["id"]
    assert client.delete(f"/api/v1/wallet/cards/{card_id}", headers=headers_b).status_code == 404

    coupon = client.post(
        "/api/v1/wallet/coupons",
        headers=headers_a,
        json={"label": "5€ dès 40€", "expires_at": expires, "discount": "-5€"},
    )
    coupon_id = coupon.json()["id"]
    assert client.delete(f"/api/v1/wallet/coupons/{coupon_id}", headers=headers_b).status_code == 404
