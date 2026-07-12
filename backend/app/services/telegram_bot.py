"""Bot Telegram Majordome : liaison compte + messages → Alfred."""

from __future__ import annotations

import json
import re
import secrets
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import AuthContext, redis_client
from app.core.structured_log import log_event
from app.models.models import ConnectedAccount, HouseholdMemoryFact, User
from app.services.agent_executor import execute_agent_act

_LINK_PREFIX = "telegram:link:"
_LINK_TTL = 600
_fallback_link_codes: dict[str, dict[str, int]] = {}
_bot_username_cache: str | None = None


def telegram_configured() -> bool:
    return bool((settings.telegram_bot_token or "").strip())


def _api_base() -> str:
    token = (settings.telegram_bot_token or "").strip()
    if not token:
        raise RuntimeError("telegram_not_configured")
    return f"https://api.telegram.org/bot{token}"


def _set_link_code(code: str, user_id: int, household_id: int) -> None:
    payload = json.dumps({"user_id": user_id, "household_id": household_id})
    try:
        redis_client.setex(f"{_LINK_PREFIX}{code}", _LINK_TTL, payload)
    except Exception:
        _fallback_link_codes[code] = {"user_id": user_id, "household_id": household_id}


def _pop_link_code(code: str) -> dict[str, int] | None:
    key = f"{_LINK_PREFIX}{code}"
    try:
        raw = redis_client.get(key)
        if raw:
            redis_client.delete(key)
            data = json.loads(raw)
            if isinstance(data, dict) and "user_id" in data and "household_id" in data:
                return {"user_id": int(data["user_id"]), "household_id": int(data["household_id"])}
    except Exception:
        pass
    return _fallback_link_codes.pop(code, None)


def _normalize_link_code(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", (raw or "").strip()).upper()[:16]


def generate_link_code(*, user_id: int, household_id: int) -> str:
    code = secrets.token_hex(4).upper()
    _set_link_code(code, user_id, household_id)
    return code


def get_bot_username(*, force_refresh: bool = False) -> str | None:
    global _bot_username_cache
    if not telegram_configured():
        return None
    if _bot_username_cache and not force_refresh:
        return _bot_username_cache
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(f"{_api_base()}/getMe")
            r.raise_for_status()
            username = str(r.json().get("result", {}).get("username") or "").strip()
            if username:
                _bot_username_cache = username
                return username
    except Exception as exc:
        log_event("telegram_get_me_failed", error=str(exc)[:200])
    return _bot_username_cache


def build_deep_link(code: str) -> str | None:
    username = get_bot_username()
    if not username or not code:
        return None
    return f"https://t.me/{username}?start={code}"


def send_telegram_message(chat_id: int | str, text: str, *, parse_mode: str | None = None) -> bool:
    if not telegram_configured():
        return False
    body = (text or "").strip()
    if not body:
        return False
    payload: dict[str, Any] = {"chat_id": str(chat_id), "text": body[:4096]}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(f"{_api_base()}/sendMessage", json=payload)
            r.raise_for_status()
            return True
    except Exception as exc:
        log_event("telegram_send_failed", chat_id=str(chat_id), error=str(exc)[:200])
        return False


def register_webhook() -> dict[str, Any]:
    if not telegram_configured():
        return {"ok": False, "reason": "telegram_not_configured"}
    base = (settings.public_api_base_url or "").strip().rstrip("/")
    if not base or base.startswith("http://localhost"):
        return {"ok": False, "reason": "public_api_base_url_not_set"}
    url = f"{base}/api/v1/webhooks/telegram"
    secret = (settings.telegram_webhook_secret or "").strip()
    body: dict[str, Any] = {"url": url, "allowed_updates": ["message"]}
    if secret:
        body["secret_token"] = secret
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(f"{_api_base()}/setWebhook", json=body)
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        log_event("telegram_set_webhook_failed", error=str(exc)[:200])
        return {"ok": False, "reason": str(exc)[:200]}


def get_telegram_account(db: Session, user_id: int) -> ConnectedAccount | None:
    return (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.user_id == user_id, ConnectedAccount.provider == "telegram")
        .first()
    )


def get_user_by_chat_id(db: Session, chat_id: int | str) -> tuple[User, ConnectedAccount] | None:
    ext = str(chat_id)
    account = (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.provider == "telegram", ConnectedAccount.external_account_id == ext)
        .first()
    )
    if account is None or account.user_id is None or account.status != "connected":
        return None
    user = db.get(User, account.user_id)
    if user is None:
        return None
    return user, account


def disconnect_telegram(db: Session, user_id: int) -> bool:
    account = get_telegram_account(db, user_id)
    if account is None:
        return False
    db.delete(account)
    db.commit()
    return True


def link_chat_to_user(
    db: Session,
    *,
    chat_id: int,
    code: str,
    telegram_user: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    normalized = _normalize_link_code(code)
    if not normalized:
        return False, "Code de liaison invalide. Génère un nouveau code dans Réglages → Connexions."
    ctx = _pop_link_code(normalized)
    if ctx is None:
        return False, "Code expiré ou déjà utilisé. Regénère un code dans l’app Majordome."

    user_id = int(ctx["user_id"])
    household_id = int(ctx["household_id"])

    existing_chat = (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.provider == "telegram", ConnectedAccount.external_account_id == str(chat_id))
        .first()
    )
    if existing_chat is not None and existing_chat.user_id != user_id:
        return False, "Ce compte Telegram est déjà lié à un autre utilisateur Majordome."

    tg_meta = telegram_user if isinstance(telegram_user, dict) else {}
    meta = {
        "chat_id": str(chat_id),
        "household_id": household_id,
        "username": str(tg_meta.get("username") or ""),
        "first_name": str(tg_meta.get("first_name") or ""),
    }
    account = get_telegram_account(db, user_id)
    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider="telegram",
            external_account_id=str(chat_id),
            status="connected",
            scopes_json=json.dumps(meta, ensure_ascii=False),
        )
        db.add(account)
    else:
        account.external_account_id = str(chat_id)
        account.status = "connected"
        account.scopes_json = json.dumps(meta, ensure_ascii=False)
    db.commit()
    db.refresh(account)

    user = db.get(User, user_id)
    name = (user.full_name if user else "Membre").strip() or "Membre"
    log_event(
        "telegram_account_linked",
        user_id=user_id,
        household_id=household_id,
        chat_id=str(chat_id),
    )
    return True, (
        f"Bonjour {name} ! Ton compte Majordome est connecté.\n\n"
        "Envoie-moi un message (ex. « ajoute du lait aux courses », « qu’est-ce qu’on mange ce soir ? »).\n"
        "Commandes : /help · /status · /disconnect"
    )


def _memory_lines(db: Session, household_id: int) -> list[str]:
    rows = (
        db.query(HouseholdMemoryFact)
        .filter(HouseholdMemoryFact.household_id == household_id)
        .order_by(HouseholdMemoryFact.updated_at.desc())
        .limit(36)
        .all()
    )
    return [r.fact_text.strip() for r in rows if r.fact_text and r.fact_text.strip()]


def _resolve_household_id(db: Session, user_id: int, account: ConnectedAccount) -> int:
    try:
        meta = json.loads(account.scopes_json or "{}")
        if isinstance(meta, dict):
            hid = int(meta.get("household_id") or 0)
            if hid > 0:
                return hid
    except Exception:
        pass
    from app.services.household_join import list_household_ids_for_user

    ids = list_household_ids_for_user(db, user_id)
    return int(ids[0]) if ids else 0


def process_telegram_text(db: Session, *, chat_id: int, text: str) -> str:
    linked = get_user_by_chat_id(db, chat_id)
    if linked is None:
        bot = get_bot_username()
        hint = f"https://t.me/{bot}" if bot else "Telegram"
        return (
            "Compte non lié.\n\n"
            "1. Ouvre Majordome → Paramètres → Connexions → Telegram\n"
            "2. Génère un code de liaison\n"
            f"3. Envoie /start CODE au bot ({hint})"
        )

    user, account = linked
    household_id = _resolve_household_id(db, user.id, account)
    if household_id <= 0:
        return "Foyer introuvable. Reconnecte ton compte depuis l’app."

    auth = AuthContext(
        user_id=user.id,
        household_id=household_id,
        token="telegram",
        jti="telegram",
        token_type="telegram",
    )
    command = (text or "").strip()
    if not command:
        return "Envoie un message texte pour parler à Alfred."

    lowered = command.lower()
    if lowered in {"/help", "help", "aide"}:
        return (
            "Alfred via Telegram\n\n"
            "• Message libre → tâches, courses, agenda, domotique…\n"
            "• /status → état de la connexion\n"
            "• /disconnect → délier ce chat\n"
            "• /help → cette aide"
        )
    if lowered == "/status":
        return f"Connecté en tant que {user.full_name or user.email} (foyer #{household_id})."
    if lowered == "/disconnect":
        db.delete(account)
        db.commit()
        return "Compte Telegram délié. Tu peux te reconnecter avec un nouveau code depuis l’app."

    mem = _memory_lines(db, household_id)
    try:
        outcome = execute_agent_act(command, db, auth, mem, force_execute=True)
    except Exception as exc:
        log_event("telegram_agent_failed", user_id=user.id, error=str(exc)[:200])
        return "Désolé, je n’ai pas pu traiter ta demande. Réessaie dans un instant."

    status = str(outcome.get("status") or "")
    message = str(outcome.get("message") or outcome.get("preview", {}).get("explanation") or "").strip()
    if not message:
        message = "Commande reçue." if status == "completed" else "Je te propose une action — confirme dans l’app si besoin."
    if status == "preview_only":
        message = f"{message}\n\n(Ouvre l’app Majordome pour valider si nécessaire.)"
    return message[:4096]


def handle_telegram_update(db: Session, update: dict[str, Any]) -> None:
    message = update.get("message")
    if not isinstance(message, dict):
        return
    chat = message.get("chat")
    if not isinstance(chat, dict):
        return
    chat_id = chat.get("id")
    if chat_id is None:
        return

    text = str(message.get("text") or "").strip()
    if not text:
        send_telegram_message(chat_id, "Pour l’instant j’accepte les messages texte.")
        return

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        code = parts[1] if len(parts) > 1 else ""
        if not code:
            bot = get_bot_username()
            send_telegram_message(
                chat_id,
                "Bienvenue sur Majordome.\n\n"
                "Pour lier ton compte : Paramètres → Connexions → Telegram dans l’app, "
                f"puis envoie /start CODE{' (' + bot + ')' if bot else ''}.",
            )
            return
        from_user = message.get("from") if isinstance(message.get("from"), dict) else {}
        ok, reply = link_chat_to_user(db, chat_id=int(chat_id), code=code, telegram_user=from_user)
        send_telegram_message(chat_id, reply)
        return

    reply = process_telegram_text(db, chat_id=int(chat_id), text=text)
    send_telegram_message(chat_id, reply)
