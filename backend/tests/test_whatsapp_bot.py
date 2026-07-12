"""Tests bot WhatsApp Majordome."""

import hashlib
import hmac
import json
import os
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_whatsapp_bot.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["MAJORDOME_WHATSAPP_ACCESS_TOKEN"] = "test-access-token"
os.environ["MAJORDOME_WHATSAPP_PHONE_NUMBER_ID"] = "123456789"
os.environ["MAJORDOME_WHATSAPP_APP_SECRET"] = "test-app-secret"
os.environ["MAJORDOME_WHATSAPP_VERIFY_TOKEN"] = "verify-me"
os.environ["MAJORDOME_WHATSAPP_DISPLAY_PHONE"] = "+33612345678"
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


def _login(client: TestClient, email: str = "wa@majordome.test") -> str:
    payload = {"email": email, "password": "test12345", "full_name": "WhatsApp User"}
    reg = client.post("/api/v1/auth/register", json=payload)
    if reg.status_code != 200:
        reg = client.post("/api/v1/auth/login", json=payload)
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def _sign(body: bytes) -> str:
    digest = hmac.new(b"test-app-secret", body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def test_capabilities_includes_whatsapp_configured():
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    r = client.get("/api/v1/integrations/capabilities", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["whatsapp_configured"] is True


def test_link_code_and_status():
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    r = client.post(
        "/api/v1/integrations/whatsapp/link-code",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["code"]) >= 6
    assert "wa.me/33612345678" in (data["deep_link"] or "")

    st = client.get("/api/v1/integrations/whatsapp/status", headers={"Authorization": f"Bearer {token}"})
    assert st.status_code == 200
    assert st.json()["configured"] is True
    assert st.json()["connected"] is False


def test_webhook_verify_challenge():
    _reset_db()
    client = TestClient(app)
    r = client.get(
        "/api/v1/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-me",
            "hub.challenge": "12345",
        },
    )
    assert r.status_code == 200
    assert r.text == "12345"


@patch("app.services.whatsapp_bot.send_whatsapp_message", return_value=True)
def test_webhook_code_links_account(mock_send):
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    code = client.post(
        "/api/v1/integrations/whatsapp/link-code",
        headers={"Authorization": f"Bearer {token}"},
    ).json()["code"]

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": "33699999999", "profile": {"name": "Test WA"}}],
                            "messages": [
                                {
                                    "from": "33699999999",
                                    "type": "text",
                                    "text": {"body": code},
                                }
                            ],
                        }
                    }
                ]
            }
        ],
    }
    raw = json.dumps(payload).encode("utf-8")
    r = client.post(
        "/api/v1/webhooks/whatsapp",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    mock_send.assert_called_once()

    st = client.get("/api/v1/integrations/whatsapp/status", headers={"Authorization": f"Bearer {token}"})
    assert st.json()["connected"] is True
    assert st.json()["wa_id"] == "33699999999"
    assert st.json()["profile_name"] == "Test WA"


@patch("app.services.whatsapp_bot.send_whatsapp_message", return_value=True)
@patch("app.services.whatsapp_bot.execute_agent_act")
def test_webhook_message_runs_alfred(mock_act, mock_send):
    _reset_db()
    client = TestClient(app)
    token = _login(client)
    db = TestingSessionLocal()
    try:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "wa@majordome.test", "password": "test12345", "full_name": "WhatsApp User"},
        ).json()
        user_id = int(login["user_id"])
        household_id = int(login["household_id"])
        db.add(
            ConnectedAccount(
                user_id=user_id,
                provider="whatsapp",
                external_account_id="33611111111",
                status="connected",
                scopes_json=json.dumps({"household_id": household_id, "profile_name": "U"}),
            )
        )
        db.commit()
    finally:
        db.close()

    mock_act.return_value = {"status": "completed", "message": "Lait ajouté aux courses."}
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "33611111111",
                                    "type": "text",
                                    "text": {"body": "ajoute du lait"},
                                }
                            ]
                        }
                    }
                ]
            }
        ],
    }
    raw = json.dumps(payload).encode("utf-8")
    r = client.post(
        "/api/v1/webhooks/whatsapp",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)},
    )
    assert r.status_code == 200
    mock_act.assert_called_once()
    mock_send.assert_called_once()


def test_webhook_rejects_bad_signature():
    _reset_db()
    client = TestClient(app)
    raw = b'{"object":"whatsapp_business_account","entry":[]}'
    r = client.post(
        "/api/v1/webhooks/whatsapp",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef"},
    )
    assert r.status_code == 403
