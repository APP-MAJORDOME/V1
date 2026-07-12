"""Tests bot Telegram Majordome."""

import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_telegram_bot.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["MAJORDOME_TELEGRAM_BOT_TOKEN"] = "123456:ABC-DEF"
os.environ["MAJORDOME_TELEGRAM_WEBHOOK_SECRET"] = "test-secret"
os.environ["MAJORDOME_AUTO_CREATE_TABLES"] = "false"
os.environ["MAJORDOME_TELEGRAM_WEBHOOK_AUTO_REGISTER"] = "false"

from app.core import database as database_module  # noqa: E402
from app.models.models import Base, ConnectedAccount  # noqa: E402

engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
database_module.engine = engine
database_module.SessionLocal = TestingSessionLocal

from app.main import app  # noqa: E402


def _reset_db():
    database_module.engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    Base.metadata.create_all(bind=engine)


def _login(client: TestClient, email: str = "tg@majordome.test") -> str:
    payload = {"email": email, "password": "test12345", "full_name": "Telegram User"}
    reg = client.post("/api/v1/auth/register", json=payload)
    if reg.status_code != 200:
        reg = client.post("/api/v1/auth/login", json=payload)
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def test_capabilities_includes_telegram_configured():
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    r = client.get("/api/v1/integrations/capabilities", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["telegram_configured"] is True


def test_link_code_and_status():
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    with (
        patch("app.services.telegram_bot.get_bot_username", return_value="majordome_bot"),
        patch("app.api.telegram_routes.get_bot_username", return_value="majordome_bot"),
    ):
        r = client.post(
            "/api/v1/integrations/telegram/link-code",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert len(data["code"]) >= 6
    assert data["bot_username"] == "majordome_bot"
    assert "majordome_bot" in (data["deep_link"] or "")

    st = client.get("/api/v1/integrations/telegram/status", headers={"Authorization": f"Bearer {token}"})
    assert st.status_code == 200
    assert st.json()["configured"] is True
    assert st.json()["connected"] is False


@patch("app.services.telegram_bot.send_telegram_message", return_value=True)
def test_webhook_start_links_account(mock_send):
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    with patch("app.services.telegram_bot.get_bot_username", return_value="majordome_bot"):
        link = client.post(
            "/api/v1/integrations/telegram/link-code",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
    code = link["code"]
    update = {
        "message": {
            "chat": {"id": 424242},
            "from": {"id": 99, "username": "testuser", "first_name": "Test"},
            "text": f"/start {code}",
        }
    }
    r = client.post(
        "/api/v1/webhooks/telegram",
        json=update,
        headers={"X-Telegram-Bot-Api-Secret-Token": "test-secret"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    mock_send.assert_called_once()

    st = client.get("/api/v1/integrations/telegram/status", headers={"Authorization": f"Bearer {token}"})
    assert st.json()["connected"] is True
    assert st.json()["chat_id"] == "424242"
    assert st.json()["telegram_username"] == "testuser"


@patch("app.services.telegram_bot.send_telegram_message", return_value=True)
@patch("app.services.telegram_bot.execute_agent_act")
def test_webhook_message_runs_alfred(mock_act, mock_send):
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    db = TestingSessionLocal()
    try:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "tg@majordome.test", "password": "test12345", "full_name": "Telegram User"},
        ).json()
        user_id = int(login["user_id"])
        household_id = int(login["household_id"])
        db.add(
            ConnectedAccount(
                user_id=user_id,
                provider="telegram",
                external_account_id="777",
                status="connected",
                scopes_json=json.dumps({"household_id": household_id, "username": "u"}),
            )
        )
        db.commit()
    finally:
        db.close()

    mock_act.return_value = {"status": "completed", "message": "Lait ajouté aux courses."}
    r = client.post(
        "/api/v1/webhooks/telegram",
        json={"message": {"chat": {"id": 777}, "text": "ajoute du lait"}},
        headers={"X-Telegram-Bot-Api-Secret-Token": "test-secret"},
    )
    assert r.status_code == 200
    mock_act.assert_called_once()
    mock_send.assert_called_once()


def test_webhook_rejects_bad_secret():
    _reset_db()
    client = TestClient(app)
    r = client.post(
        "/api/v1/webhooks/telegram",
        json={"message": {"chat": {"id": 1}, "text": "hi"}},
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
    )
    assert r.status_code == 403
