"""Stripe Checkout / Portal / webhooks — Premium Foyer 6,90 €/mois."""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.structured_log import log_event
from app.models.models import Household, User
from app.services.subscription import get_subscription_status

STRIPE_API = "https://api.stripe.com/v1"


def stripe_configured() -> bool:
    return bool(
        (settings.stripe_secret_key or "").strip()
        and (settings.stripe_price_id or "").strip()
    )


def _auth_header() -> dict[str, str]:
    key = (settings.stripe_secret_key or "").strip()
    return {"Authorization": f"Bearer {key}"}


def _stripe_form(path: str, data: dict[str, Any]) -> dict[str, Any]:
    with httpx.Client(timeout=25.0) as client:
        r = client.post(f"{STRIPE_API}{path}", headers=_auth_header(), data=data)
        if r.status_code >= 400:
            log_event("stripe_api_error", path=path, status=r.status_code, body=r.text[:400])
            raise RuntimeError(f"stripe_{r.status_code}")
        return r.json()


def set_household_tier(db: Session, household: Household, tier: str, *, subscription_id: str | None = None) -> None:
    household.subscription_tier = tier
    if subscription_id is not None:
        household.stripe_subscription_id = subscription_id or None
    db.add(household)
    db.commit()
    db.refresh(household)


def ensure_stripe_customer(db: Session, *, household: Household, user: User) -> str:
    if household.stripe_customer_id:
        return household.stripe_customer_id
    payload = {
        "email": user.email,
        "name": user.full_name or user.email,
        "metadata[household_id]": str(household.id),
        "metadata[user_id]": str(user.id),
    }
    customer = _stripe_form("/customers", payload)
    cid = str(customer.get("id") or "")
    if not cid:
        raise RuntimeError("stripe_customer_missing")
    household.stripe_customer_id = cid
    db.add(household)
    db.commit()
    db.refresh(household)
    return cid


def create_checkout_session(
    db: Session,
    *,
    household: Household,
    user: User,
) -> dict[str, Any]:
    if not stripe_configured():
        raise RuntimeError("stripe_not_configured")
    customer_id = ensure_stripe_customer(db, household=household, user=user)
    success = (settings.stripe_success_url or "https://majordom.eu/?billing=success").strip()
    cancel = (settings.stripe_cancel_url or "https://majordom.eu/?billing=cancel").strip()
    data = {
        "mode": "subscription",
        "customer": customer_id,
        "line_items[0][price]": (settings.stripe_price_id or "").strip(),
        "line_items[0][quantity]": "1",
        "success_url": success,
        "cancel_url": cancel,
        "client_reference_id": str(household.id),
        "metadata[household_id]": str(household.id),
        "subscription_data[metadata][household_id]": str(household.id),
        "allow_promotion_codes": "true",
        "locale": "fr",
    }
    session = _stripe_form("/checkout/sessions", data)
    return {"url": session.get("url"), "session_id": session.get("id")}


def create_billing_portal(db: Session, *, household: Household) -> dict[str, Any]:
    if not stripe_configured():
        raise RuntimeError("stripe_not_configured")
    if not household.stripe_customer_id:
        raise RuntimeError("stripe_customer_missing")
    return_url = (settings.stripe_success_url or "https://majordom.eu/settings").strip()
    # Prefer settings page if success url is homepage
    if "billing=success" in return_url:
        return_url = "https://majordom.eu/settings"
    session = _stripe_form(
        "/billing_portal/sessions",
        {"customer": household.stripe_customer_id, "return_url": return_url},
    )
    return {"url": session.get("url")}


def activate_founder_code(db: Session, *, household: Household, code: str) -> bool:
    expected = (settings.premium_founder_code or "").strip()
    if not expected:
        return False
    if hmac.compare_digest(code.strip(), expected):
        set_household_tier(db, household, "founder")
        log_event("premium_founder_activated", household_id=household.id)
        return True
    return False


def verify_stripe_signature(*, payload: bytes, sig_header: str | None) -> bool:
    secret = (settings.stripe_webhook_secret or "").strip()
    if not secret:
        # Dev without webhook secret: reject in prod-like setups
        return False
    if not sig_header:
        return False
    # Stripe-Signature: t=...,v1=... (plusieurs v1 possibles en rotation de secret)
    parts: list[tuple[str, str]] = []
    for chunk in sig_header.split(","):
        if "=" not in chunk:
            continue
        k, v = chunk.split("=", 1)
        parts.append((k.strip(), v.strip()))
    timestamp = next((v for k, v in parts if k == "t"), None)
    signatures = [v for k, v in parts if k == "v1"]
    if not timestamp or not signatures:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(int(time.time()) - ts) > 300:
        return False
    signed = f"{timestamp}.".encode("utf-8") + payload
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, sig) for sig in signatures)


def _household_from_stripe_object(db: Session, obj: dict[str, Any]) -> Household | None:
    meta = obj.get("metadata") if isinstance(obj.get("metadata"), dict) else {}
    hid_raw = meta.get("household_id") or obj.get("client_reference_id")
    if hid_raw:
        try:
            hh = db.get(Household, int(hid_raw))
            if hh:
                return hh
        except (TypeError, ValueError):
            pass
    customer_id = obj.get("customer")
    if isinstance(customer_id, dict):
        customer_id = customer_id.get("id")
    if customer_id:
        return (
            db.query(Household)
            .filter(Household.stripe_customer_id == str(customer_id))
            .first()
        )
    return None


def handle_stripe_event(db: Session, event: dict[str, Any]) -> None:
    etype = str(event.get("type") or "")
    data_obj = event.get("data", {}).get("object") if isinstance(event.get("data"), dict) else None
    if not isinstance(data_obj, dict):
        return

    if etype == "checkout.session.completed":
        hh = _household_from_stripe_object(db, data_obj)
        if hh is None:
            return
        sub_id = data_obj.get("subscription")
        if isinstance(sub_id, dict):
            sub_id = sub_id.get("id")
        if data_obj.get("customer") and not hh.stripe_customer_id:
            hh.stripe_customer_id = str(data_obj.get("customer"))
        set_household_tier(db, hh, "premium", subscription_id=str(sub_id) if sub_id else None)
        log_event("stripe_checkout_completed", household_id=hh.id)
        return

    if etype in {"customer.subscription.updated", "customer.subscription.created"}:
        hh = _household_from_stripe_object(db, data_obj)
        if hh is None:
            return
        status = str(data_obj.get("status") or "")
        sub_id = str(data_obj.get("id") or "") or None
        if status in {"active", "trialing"}:
            set_household_tier(db, hh, "premium", subscription_id=sub_id)
        elif status in {"canceled", "unpaid", "incomplete_expired"}:
            set_household_tier(db, hh, "free", subscription_id=None)
        log_event("stripe_subscription_updated", household_id=hh.id, status=status)
        return

    if etype == "customer.subscription.deleted":
        hh = _household_from_stripe_object(db, data_obj)
        if hh is None:
            return
        set_household_tier(db, hh, "free", subscription_id=None)
        log_event("stripe_subscription_deleted", household_id=hh.id)


def billing_public_status(db: Session, household_id: int) -> dict[str, Any]:
    st = get_subscription_status(db, household_id)
    st["stripe_configured"] = stripe_configured()
    st["price_label"] = "6,90 €/mois"
    hh = db.get(Household, household_id)
    st["has_stripe_customer"] = bool(hh and hh.stripe_customer_id)
    st["can_manage"] = bool(hh and hh.stripe_customer_id and stripe_configured())
    return st
