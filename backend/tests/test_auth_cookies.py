import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).resolve().parent / "test_auth_cookies.db"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["MAJORDOME_APP_ENV"] = "test"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.auth_cookies import ACCESS_COOKIE, REFRESH_COOKIE  # noqa: E402
from app.main import app  # noqa: E402
from app.core import database as database_module  # noqa: E402
from app.models.models import Base  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
database_module.SessionLocal = TestingSessionLocal
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def test_refresh_and_protected_route_via_http_only_cookies():
    client = TestClient(app)
    payload = {"email": "cookie@majordome.test", "password": "test12345", "full_name": "Cookie User"}
    reg = client.post("/api/v1/auth/register", json=payload)
    assert reg.status_code == 200
    assert ACCESS_COOKIE in reg.cookies
    assert REFRESH_COOKIE in reg.cookies

    # Sans Bearer : accès via cookie access
    events = client.get("/api/v1/events")
    assert events.status_code == 200

    # Refresh sans body : nouveau access cookie
    refresh = client.post("/api/v1/auth/refresh", json={})
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]

    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
