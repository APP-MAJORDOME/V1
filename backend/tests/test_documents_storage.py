import os
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Dedicated sqlite DB + upload sandbox for storage tests.
TEST_DIR = Path(__file__).resolve().parent
TEST_DB_PATH = TEST_DIR / "test_documents_storage.db"
TEST_UPLOAD_DIR = TEST_DIR / "tmp_uploads"
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["MAJORDOME_UPLOAD_DIR"] = str(TEST_UPLOAD_DIR)
os.environ["MAJORDOME_ATTACHMENT_QUOTA_MB_PER_HOUSEHOLD"] = "1"
os.environ["MAJORDOME_ATTACHMENT_MAX_MB"] = "12"

import app.main as main_module  # noqa: E402
import app.core.rate_limit as rate_limit_module  # noqa: E402
import app.core.security as security_module  # noqa: E402
from app.main import app  # noqa: E402
from app.core import database as database_module  # noqa: E402
from app.core.config import settings  # noqa: E402
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


def _cleanup_db_and_uploads():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    if TEST_UPLOAD_DIR.exists():
        for p in sorted(TEST_UPLOAD_DIR.rglob("*"), reverse=True):
            if p.is_file():
                p.unlink()
            elif p.is_dir():
                p.rmdir()
    TEST_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _install_fake_redis():
    fake_redis = InMemoryRedis()
    security_module.redis_client = fake_redis
    rate_limit_module.redis_client = fake_redis
    main_module.redis.from_url = lambda *args, **kwargs: fake_redis


def _login(client: TestClient, email: str = "docs@majordome.test") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "test12345", "full_name": "Docs User"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_storage_summary_and_attachment_roundtrip():
    _cleanup_db_and_uploads()
    _install_fake_redis()
    settings.attachment_quota_mb_per_household = 1
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"name": "Facture EDF", "category": "🏠 Maison", "icon": "📎"},
    )
    assert created.status_code == 200
    doc_id = created.json()["id"]

    payload = b"\x89PNG\r\n\x1a\n" + b"a" * 128
    up = client.post(
        f"/api/v1/documents/{doc_id}/attachment",
        headers=headers,
        files={"file": ("facture.png", payload, "image/png")},
    )
    assert up.status_code == 200
    assert up.json()["attachment_size_bytes"] == len(payload)

    summary = client.get("/api/v1/documents/storage-summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["used_bytes"] == len(payload)
    assert summary.json()["quota_bytes"] == 1024 * 1024

    down = client.get(f"/api/v1/documents/{doc_id}/attachment", headers=headers)
    assert down.status_code == 200
    assert down.content == payload


def test_quota_exceeded_returns_413():
    _cleanup_db_and_uploads()
    _install_fake_redis()
    settings.attachment_quota_mb_per_household = 1
    client = TestClient(app)
    token = _login(client, email="quota@majordome.test")
    headers = {"Authorization": f"Bearer {token}"}

    # 1 MiB quota from env => this payload exceeds by one byte.
    too_big = b"x" * (1024 * 1024 + 1)

    created = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"name": "Gros PDF", "category": "Divers", "icon": "📄"},
    )
    assert created.status_code == 200
    doc_id = created.json()["id"]

    up = client.post(
        f"/api/v1/documents/{doc_id}/attachment",
        headers=headers,
        files={"file": ("gros.pdf", too_big, "application/pdf")},
    )
    assert up.status_code == 413
    body = up.json()
    assert body["detail"]["code"] == "attachment_quota_exceeded"
