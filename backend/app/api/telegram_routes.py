"""Routes Telegram (webhook public + liaison compte)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import AuthContext, get_current_auth_context
from app.schemas.schemas import TelegramLinkCodeResponse, TelegramStatusResponse
from app.services.telegram_bot import (
    build_deep_link,
    disconnect_telegram,
    generate_link_code,
    get_bot_username,
    get_telegram_account,
    handle_telegram_update,
    register_webhook,
    telegram_configured,
)

router = APIRouter(prefix="/api/v1")


def _api_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/integrations/telegram/link-code", response_model=TelegramLinkCodeResponse)
def telegram_create_link_code(auth: AuthContext = Depends(get_current_auth_context)):
    if not telegram_configured():
        raise _api_error(
            "telegram_not_configured",
            "Telegram n’est pas configuré sur le serveur (MAJORDOME_TELEGRAM_BOT_TOKEN).",
            503,
        )
    code = generate_link_code(user_id=auth.user_id, household_id=auth.household_id)
    username = get_bot_username()
    return TelegramLinkCodeResponse(
        code=code,
        expires_in=600,
        bot_username=username,
        deep_link=build_deep_link(code),
    )


@router.get("/integrations/telegram/status", response_model=TelegramStatusResponse)
def telegram_status(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    account = get_telegram_account(db, auth.user_id)
    meta: dict = {}
    if account is not None:
        try:
            parsed = json.loads(account.scopes_json or "{}")
            if isinstance(parsed, dict):
                meta = parsed
        except Exception:
            meta = {}
    return TelegramStatusResponse(
        configured=telegram_configured(),
        connected=account is not None and account.status == "connected",
        chat_id=account.external_account_id if account else None,
        telegram_username=str(meta.get("username") or "") or None,
    )


@router.delete("/integrations/telegram/disconnect")
def telegram_disconnect(auth: AuthContext = Depends(get_current_auth_context), db: Session = Depends(get_db)):
    ok = disconnect_telegram(db, auth.user_id)
    return {"disconnected": ok}


@router.post("/webhooks/telegram")
async def telegram_webhook(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if not telegram_configured():
        response.status_code = 503
        return {"ok": False}
    expected = (settings.telegram_webhook_secret or "").strip()
    if expected and x_telegram_bot_api_secret_token != expected:
        response.status_code = 403
        return {"ok": False}
    try:
        update = await request.json()
    except Exception:
        response.status_code = 400
        return {"ok": False}
    if not isinstance(update, dict):
        response.status_code = 400
        return {"ok": False}
    handle_telegram_update(db, update)
    return {"ok": True}


@router.post("/integrations/telegram/register-webhook")
def telegram_register_webhook(auth: AuthContext = Depends(get_current_auth_context)):
    """Enregistre le webhook Telegram (admin / post-deploy)."""
    if not telegram_configured():
        raise _api_error("telegram_not_configured", "Token bot Telegram manquant.", 503)
    _ = auth
    return register_webhook()
