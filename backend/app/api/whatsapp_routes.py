"""Routes WhatsApp Cloud API (webhook public + liaison compte)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi import HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import AuthContext, get_current_auth_context
from app.schemas.schemas import WhatsAppLinkCodeResponse, WhatsAppStatusResponse
from app.services.whatsapp_bot import (
    build_deep_link,
    disconnect_whatsapp,
    generate_link_code,
    get_whatsapp_account,
    handle_whatsapp_webhook,
    verify_signature,
    verify_webhook_hub,
    whatsapp_configured,
)

router = APIRouter(prefix="/api/v1")


def _api_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/integrations/whatsapp/link-code", response_model=WhatsAppLinkCodeResponse)
def whatsapp_create_link_code(auth: AuthContext = Depends(get_current_auth_context)):
    if not whatsapp_configured():
        raise _api_error(
            "whatsapp_not_configured",
            "WhatsApp n’est pas configuré sur le serveur (token + phone number id).",
            503,
        )
    code = generate_link_code(user_id=auth.user_id, household_id=auth.household_id)
    return WhatsAppLinkCodeResponse(
        code=code,
        expires_in=600,
        deep_link=build_deep_link(code),
    )


@router.get("/integrations/whatsapp/status", response_model=WhatsAppStatusResponse)
def whatsapp_status(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    account = get_whatsapp_account(db, auth.user_id)
    meta: dict = {}
    if account is not None:
        try:
            parsed = json.loads(account.scopes_json or "{}")
            if isinstance(parsed, dict):
                meta = parsed
        except Exception:
            meta = {}
    return WhatsAppStatusResponse(
        configured=whatsapp_configured(),
        connected=account is not None and account.status == "connected",
        wa_id=account.external_account_id if account else None,
        profile_name=str(meta.get("profile_name") or "") or None,
    )


@router.delete("/integrations/whatsapp/disconnect")
def whatsapp_disconnect(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    ok = disconnect_whatsapp(db, auth.user_id)
    return {"disconnected": ok}


@router.get("/webhooks/whatsapp")
def whatsapp_webhook_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    challenge = verify_webhook_hub(mode=hub_mode, token=hub_verify_token, challenge=hub_challenge)
    if challenge is None:
        raise _api_error("whatsapp_verify_failed", "Verify token invalide.", 403)
    return PlainTextResponse(content=challenge)


@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None),
):
    if not whatsapp_configured():
        response.status_code = 503
        return {"ok": False}
    raw = await request.body()
    if not verify_signature(raw_body=raw, signature_header=x_hub_signature_256):
        response.status_code = 403
        return {"ok": False}
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        response.status_code = 400
        return {"ok": False}
    if not isinstance(payload, dict):
        response.status_code = 400
        return {"ok": False}
    handle_whatsapp_webhook(db, payload)
    return {"ok": True}
