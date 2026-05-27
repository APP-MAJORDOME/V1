import os
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use a dedicated sqlite DB for session/auth tests.
TEST_DB_PATH = Path(__file__).resolve().parent / "test_auth_session.db"
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


def _register(client: TestClient, email: str = "session@majordome.test", password: str = "test12345"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Session User"},
    )


def _login(client: TestClient, email: str = "session@majordome.test", password: str = "test12345"):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "full_name": "Session User"},
    )
    return response


def test_login_refresh_and_logout_flow():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    register_response = _register(client)
    assert register_response.status_code == 200
    login_json = register_response.json()
    assert "access_token" in login_json
    assert "refresh_token" in login_json

    refresh_response = client.post("/api/v1/auth/refresh", json={"refresh_token": login_json["refresh_token"]})
    assert refresh_response.status_code == 200
    refresh_json = refresh_response.json()
    refreshed_access_token = refresh_json["access_token"]
    rotated_refresh = refresh_json.get("refresh_token")
    assert rotated_refresh

    protected_ok = client.get("/api/v1/events", headers={"Authorization": f"Bearer {refreshed_access_token}"})
    assert protected_ok.status_code == 200

    logout_response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {refreshed_access_token}"},
        json={"refresh_token": rotated_refresh},
    )
    assert logout_response.status_code == 200
    assert logout_response.json()["status"] == "logged_out"

    protected_after_logout = client.get("/api/v1/events", headers={"Authorization": f"Bearer {refreshed_access_token}"})
    assert protected_after_logout.status_code == 401
    assert protected_after_logout.json()["detail"]["code"] == "invalid_bearer_token"

    refresh_after_logout = client.post("/api/v1/auth/refresh", json={"refresh_token": rotated_refresh})
    assert refresh_after_logout.status_code == 401


def test_login_rejects_invalid_password():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    create_user = _register(client, email="wrong-pass@majordome.test", password="test12345")
    assert create_user.status_code == 200

    wrong_password = _login(client, email="wrong-pass@majordome.test", password="badpass123")
    assert wrong_password.status_code == 401
    assert wrong_password.json()["detail"]["code"] == "invalid_credentials"


def test_login_rejects_unknown_user():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    r = _login(client, email="nobody@majordome.test")
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_refresh_rejects_garbage_token():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.jwt"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_refresh_token"


def test_refresh_rejects_access_token():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)
    login_json = _register(client, email="refresh-type@majordome.test").json()
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": login_json["access_token"]})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_refresh_token"


def test_ready_reports_dependencies_up():
    _cleanup_db()
    _install_fake_redis()
    client = TestClient(app)

    response = client.get("/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["database"] is True
    assert payload["checks"]["redis"] is True
    assert payload["checks"]["upload_dir"] is True
