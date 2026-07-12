"""Tests billing Premium (sans appel Stripe réel)."""

import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_billing_stripe.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["MAJORDOME_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["MAJORDOME_STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["MAJORDOME_STRIPE_PRICE_ID"] = "price_test_fake"
os.environ["MAJORDOME_STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"
os.environ["MAJORDOME_PREMIUM_FOUNDER_CODE"] = "FOUNDER42"
os.environ["MAJORDOME_AUTO_CREATE_TABLES"] = "false"
os.environ["MAJORDOME_TELEGRAM_WEBHOOK_AUTO_REGISTER"] = "false"

from app.core import database as database_module  # noqa: E402
from app.models.models import Base, Household  # noqa: E402

engine = create_engine(os.environ["MAJORDOME_DATABASE_URL"], future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
database_module.engine = engine
database_module.SessionLocal = TestingSessionLocal

from app.main import app  # noqa: E402
from app.core.config import settings  # noqa: E402

# Force settings after env (pydantic may have loaded earlier in other suites)
settings.stripe_secret_key = "sk_test_fake"
settings.stripe_price_id = "price_test_fake"
settings.stripe_webhook_secret = "whsec_test_secret"
settings.premium_founder_code = "FOUNDER42"


def _reset_db():
    database_module.engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    Base.metadata.create_all(bind=engine)


def _login(client: TestClient) -> tuple[str, int]:
    payload = {"email": "bill@majordome.test", "password": "test12345", "full_name": "Bill User"}
    reg = client.post("/api/v1/auth/register", json=payload)
    if reg.status_code != 200:
        reg = client.post("/api/v1/auth/login", json=payload)
    assert reg.status_code == 200, reg.text
    body = reg.json()
    return body["access_token"], int(body["household_id"])


def _sign(payload: bytes) -> str:
    ts = str(int(time.time()))
    signed = f"{ts}.".encode() + payload
    digest = hmac.new(b"whsec_test_secret", signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def test_subscription_status_includes_stripe_flags():
    _reset_db()
    client = TestClient(app)
    token, _ = _login(client)
    r = client.get("/api/v1/household/subscription", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["premium"] is False
    assert data["stripe_configured"] is True
    assert data["captures_limit"] == 15


def test_founder_code_activates_premium():
    _reset_db()
    client = TestClient(app)
    token, hid = _login(client)
    bad = client.post(
        "/api/v1/billing/activate-founder",
        json={"code": "WRONG"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad.status_code == 403
    ok = client.post(
        "/api/v1/billing/activate-founder",
        json={"code": "FOUNDER42"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ok.status_code == 200
    assert ok.json()["premium"] is True
    assert ok.json()["tier"] == "founder"
    db = TestingSessionLocal()
    try:
        assert db.get(Household, hid).subscription_tier == "founder"
    finally:
        db.close()


@patch("app.services.stripe_billing._stripe_form")
def test_checkout_returns_url(mock_form):
    _reset_db()
    client = TestClient(app)
    token, _ = _login(client)

    def form_side_effect(path, data):
        if path == "/customers":
            return {"id": "cus_test"}
        if path == "/checkout/sessions":
            return {"id": "cs_test", "url": "https://checkout.stripe.com/test"}
        raise AssertionError(path)

    mock_form.side_effect = form_side_effect
    r = client.post("/api/v1/billing/checkout", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "checkout.stripe.com" in r.json()["url"]


def test_webhook_checkout_sets_premium():
    _reset_db()
    client = TestClient(app)
    token, hid = _login(client)
    _ = token
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_wh",
                "subscription": "sub_wh",
                "metadata": {"household_id": str(hid)},
                "client_reference_id": str(hid),
            }
        },
    }
    raw = json.dumps(event).encode()
    r = client.post(
        "/api/v1/webhooks/stripe",
        content=raw,
        headers={"Content-Type": "application/json", "Stripe-Signature": _sign(raw)},
    )
    assert r.status_code == 200
    db = TestingSessionLocal()
    try:
        hh = db.get(Household, hid)
        assert hh.subscription_tier == "premium"
        assert hh.stripe_subscription_id == "sub_wh"
    finally:
        db.close()


def test_stripe_signature_accepts_rotated_v1():
    from app.services.stripe_billing import verify_stripe_signature

    payload = b'{"id":"evt_test"}'
    ts = str(int(time.time()))
    signed = f"{ts}.".encode() + payload
    good = hmac.new(b"whsec_test_secret", signed, hashlib.sha256).hexdigest()
    bad = "0" * 64
    header = f"t={ts},v1={bad},v1={good}"
    assert verify_stripe_signature(payload=payload, sig_header=header) is True
    assert verify_stripe_signature(payload=payload, sig_header=f"t={ts},v1={bad}") is False
