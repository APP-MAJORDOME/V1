"""Routes billing Stripe + code fondateur."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthContext, get_current_auth_context
from app.models.models import Household, User
from app.services.stripe_billing import (
    activate_founder_code,
    billing_public_status,
    create_billing_portal,
    create_checkout_session,
    handle_stripe_event,
    stripe_configured,
    verify_stripe_signature,
)

router = APIRouter(prefix="/api/v1")


def _api_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


class FounderActivateRequest(BaseModel):
    code: str = Field(min_length=4, max_length=128)


@router.get("/billing/status")
def billing_status(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    return billing_public_status(db, auth.household_id)


@router.post("/billing/checkout")
def billing_checkout(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    if not stripe_configured():
        raise _api_error(
            "stripe_not_configured",
            "Le paiement Premium n’est pas encore configuré sur le serveur.",
            503,
        )
    hh = db.get(Household, auth.household_id)
    user = db.get(User, auth.user_id)
    if hh is None or user is None:
        raise _api_error("household_not_found", "Foyer introuvable.", 404)
    try:
        return create_checkout_session(db, household=hh, user=user)
    except RuntimeError as exc:
        raise _api_error("stripe_checkout_failed", str(exc), 502) from exc


@router.post("/billing/portal")
def billing_portal(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    if not stripe_configured():
        raise _api_error("stripe_not_configured", "Stripe non configuré.", 503)
    hh = db.get(Household, auth.household_id)
    if hh is None:
        raise _api_error("household_not_found", "Foyer introuvable.", 404)
    try:
        return create_billing_portal(db, household=hh)
    except RuntimeError as exc:
        code = str(exc)
        if code == "stripe_customer_missing":
            raise _api_error("stripe_customer_missing", "Aucun abonnement Stripe à gérer.", 400) from exc
        raise _api_error("stripe_portal_failed", code, 502) from exc


@router.post("/billing/activate-founder")
def billing_activate_founder(
    payload: FounderActivateRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: Session = Depends(get_db),
):
    hh = db.get(Household, auth.household_id)
    if hh is None:
        raise _api_error("household_not_found", "Foyer introuvable.", 404)
    ok = activate_founder_code(db, household=hh, code=payload.code)
    if not ok:
        raise _api_error("invalid_founder_code", "Code invalide.", 403)
    return billing_public_status(db, auth.household_id)


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    raw = await request.body()
    if not verify_stripe_signature(payload=raw, sig_header=stripe_signature):
        response.status_code = 403
        return {"ok": False}
    try:
        event = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        response.status_code = 400
        return {"ok": False}
    if not isinstance(event, dict):
        response.status_code = 400
        return {"ok": False}
    handle_stripe_event(db, event)
    return {"ok": True}
