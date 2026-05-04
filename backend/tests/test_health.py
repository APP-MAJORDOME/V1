import os
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_health.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core import database as database_module  # noqa: E402
from app.models.models import Base  # noqa: E402

engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
database_module.SessionLocal = TestingSessionLocal
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_live():
    client = TestClient(app)
    r = client.get("/live")
    assert r.status_code == 200
    assert r.json()["status"] == "alive"


def test_validation_error_returns_standard_envelope():
    client = TestClient(app)
    r = client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    detail = r.json().get("detail") or {}
    assert detail.get("code") == "validation_error"
    assert r.headers.get("x-request-id")


def test_ready_returns_checks_and_status():
    """HTTP 200 si DB + Redis joignables (CI / Docker), sinon 503 degraded — toujours une enveloppe stable."""
    client = TestClient(app)
    r = client.get("/ready")
    assert r.status_code in (200, 503)
    body = r.json()
    assert body.get("status") in ("ready", "degraded")
    checks = body.get("checks") or {}
    assert checks.get("database") is True
    for key in ("database", "redis", "upload_dir"):
        assert key in checks
        assert isinstance(checks[key], bool)


def test_health_response_includes_security_headers():
    client = TestClient(app)
    r = client.get("/health", headers={"X-Request-Id": "pytest-health-id"})
    assert r.status_code == 200
    assert r.headers.get("x-request-id") == "pytest-health-id"
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"


def test_openapi_json_exposes_core_paths():
    client = TestClient(app)
    r = client.get("/openapi.json")
    assert r.status_code == 200
    schema = r.json()
    assert schema.get("openapi")
    paths = schema.get("paths") or {}
    assert "/api/v1/auth/login" in paths
    assert "/health" in paths
    assert "/live" in paths
    assert "/ready" in paths


def test_rate_limit_skipped_for_probe_paths():
    client = TestClient(app)
    with patch("app.main.check_rate_limit") as mock_rl:
        for path in ("/health", "/live", "/ready"):
            mock_rl.reset_mock()
            client.get(path)
            mock_rl.assert_not_called()


def test_rate_limit_skipped_for_openapi_docs_and_redoc():
    client = TestClient(app)
    with patch("app.main.check_rate_limit") as mock_rl:
        for path in ("/openapi.json", "/docs", "/redoc"):
            mock_rl.reset_mock()
            client.get(path)
            mock_rl.assert_not_called()


def test_rate_limit_applied_before_auth_for_api_routes():
    client = TestClient(app)
    with patch("app.main.check_rate_limit") as mock_rl:
        r = client.get("/api/v1/events")
        assert r.status_code == 401
        mock_rl.assert_called_once()


def test_auth_route_rate_limit_hook_called_for_login_post():
    client = TestClient(app)
    with patch("app.main.check_auth_route_rate_limits") as mock_auth:
        with patch("app.main.check_rate_limit"):
            client.post(
                "/api/v1/auth/login",
                json={"email": "rate-hook@test.invalid", "password": "12345678", "full_name": "Hook"},
            )
            mock_auth.assert_called_once()
