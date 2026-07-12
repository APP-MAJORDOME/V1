"""Bot WhatsApp Majordome (Cloud API Meta) : liaison compte + messages → Alfred."""

from __future__ import annotations

import hashlib
import hmac
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

_LINK_PREFIX = "whatsapp:link:"
_LINK_TTL = 600
_fallback_link_codes: dict[str, dict[str, int]] = {}
_GRAPH_BASE = "https://graph.facebook.com/v21.0"


def whatsapp_configured() -> bool:
    return bool(
        (settings.whatsapp_access_token or "").strip()
        and (settings.whatsapp_phone_number_id or "").strip()
    )


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


def _display_phone_digits() -> str:
    raw = (settings.whatsapp_display_phone or "").strip()
    return re.sub(r"\D", "", raw)


def build_deep_link(code: str) -> str | None:
    digits = _display_phone_digits()
    if not digits or not code:
        return None
    from urllib.parse import quote

    return f"https://wa.me/{digits}?text={quote(code)}"


def verify_webhook_hub(*, mode: str | None, token: str | None, challenge: str | None) -> str | None:
    """Validation Meta (GET webhook). Retourne le challenge si OK."""
    expected = (settings.whatsapp_verify_token or "").strip()
    if not expected:
        return None
    if mode == "subscribe" and token == expected and challenge:
        return challenge
    return None


def verify_signature(*, raw_body: bytes, signature_header: str | None) -> bool:
    secret = (settings.whatsapp_app_secret or "").strip()
    if not secret:
        # Dev / pas encore configuré : on accepte (comme Telegram sans secret).
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def send_whatsapp_message(to_wa_id: str, text: str) -> bool:
    if not whatsapp_configured():
        return False
    body = (text or "").strip()
    if not body or not to_wa_id:
        return False
    phone_id = (settings.whatsapp_phone_number_id or "").strip()
    token = (settings.whatsapp_access_token or "").strip()
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": str(to_wa_id),
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                f"{_GRAPH_BASE}/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
            )
            r.raise_for_status()
            return True
    except Exception as exc:
        log_event("whatsapp_send_failed", wa_id=str(to_wa_id), error=str(exc)[:200])
        return False


def get_whatsapp_account(db: Session, user_id: int) -> ConnectedAccount | None:
    return (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.user_id == user_id, ConnectedAccount.provider == "whatsapp")
        .first()
    )


def get_user_by_wa_id(db: Session, wa_id: str) -> tuple[User, ConnectedAccount] | None:
    ext = str(wa_id).strip()
    account = (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.provider == "whatsapp", ConnectedAccount.external_account_id == ext)
        .first()
    )
    if account is None or account.user_id is None or account.status != "connected":
        return None
    user = db.get(User, account.user_id)
    if user is None:
        return None
    return user, account


def disconnect_whatsapp(db: Session, user_id: int) -> bool:
    account = get_whatsapp_account(db, user_id)
    if account is None:
        return False
    db.delete(account)
    db.commit()
    return True


def link_wa_to_user(
    db: Session,
    *,
    wa_id: str,
    code: str,
    profile_name: str | None = None,
) -> tuple[bool, str]:
    normalized = _normalize_link_code(code)
    if not normalized:
        return False, "Code de liaison invalide. Génère un nouveau code dans Réglages → Connexions."
    ctx = _pop_link_code(normalized)
    if ctx is None:
        return False, "Code expiré ou déjà utilisé. Regénère un code dans l’app Majordome."

    user_id = int(ctx["user_id"])
    household_id = int(ctx["household_id"])
    wa_id = str(wa_id).strip()

    existing = (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.provider == "whatsapp", ConnectedAccount.external_account_id == wa_id)
        .first()
    )
    if existing is not None and existing.user_id != user_id:
        return False, "Ce numéro WhatsApp est déjà lié à un autre utilisateur Majordome."

    meta = {
        "wa_id": wa_id,
        "household_id": household_id,
        "profile_name": (profile_name or "").strip(),
    }
    account = get_whatsapp_account(db, user_id)
    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider="whatsapp",
            external_account_id=wa_id,
            status="connected",
            scopes_json=json.dumps(meta, ensure_ascii=False),
        )
        db.add(account)
    else:
        account.external_account_id = wa_id
        account.status = "connected"
        account.scopes_json = json.dumps(meta, ensure_ascii=False)
    db.commit()
    db.refresh(account)

    user = db.get(User, user_id)
    name = (user.full_name if user else "Membre").strip() or "Membre"
    log_event("whatsapp_account_linked", user_id=user_id, household_id=household_id, wa_id=wa_id)
    return True, (
        f"Bonjour {name} ! Ton compte Majordome est connecté via WhatsApp.\n\n"
        "Envoie-moi un message (ex. « ajoute du lait aux courses », « qu’est-ce qu’on mange ce soir ? »).\n"
        "Commandes : aide · statut · déconnecter"
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


def _extract_link_code_from_text(text: str) -> str | None:
    """Accepte CODE seul, « LIER CODE », « /start CODE », « LINK CODE »."""
    raw = (text or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    for prefix in ("lier ", "link ", "/start ", "connecter ", "connect "):
        if lowered.startswith(prefix):
            return _normalize_link_code(raw[len(prefix) :])
    # Code hex 6–16 sans autre texte
    if re.fullmatch(r"[A-Za-z0-9]{6,16}", raw):
        return _normalize_link_code(raw)
    return None


def process_whatsapp_text(db: Session, *, wa_id: str, text: str, profile_name: str | None = None) -> str:
    linked = get_user_by_wa_id(db, wa_id)
    if linked is None:
        code = _extract_link_code_from_text(text)
        if code:
            ok, reply = link_wa_to_user(db, wa_id=wa_id, code=code, profile_name=profile_name)
            return reply
        digits = _display_phone_digits()
        hint = f"https://wa.me/{digits}" if digits else "WhatsApp"
        return (
            "Compte non lié.\n\n"
            "1. Ouvre Majordome → Paramètres → Connexions → WhatsApp\n"
            "2. Génère un code de liaison\n"
            f"3. Envoie ce code ici ({hint})"
        )

    user, account = linked
    # Re-liaison explicite : « LIER CODE » / « LINK CODE » uniquement (pas un code nu = commande)
    raw_lower = (text or "").strip().lower()
    if raw_lower.startswith(("lier ", "link ", "connecter ", "connect ", "/start ")):
        code = _extract_link_code_from_text(text)
        if code:
            ok, reply = link_wa_to_user(db, wa_id=wa_id, code=code, profile_name=profile_name)
            return reply

    household_id = _resolve_household_id(db, user.id, account)
    if household_id <= 0:
        return "Foyer introuvable. Reconnecte ton compte depuis l’app."

    auth = AuthContext(
        user_id=user.id,
        household_id=household_id,
        token="whatsapp",
        jti="whatsapp",
        token_type="whatsapp",
    )
    command = (text or "").strip()
    if not command:
        return "Envoie un message texte pour parler à Alfred."

    lowered = command.lower().strip()
    if lowered in {"/help", "help", "aide", "?", "menu"}:
        return (
            "Alfred via WhatsApp\n\n"
            "• Message libre → tâches, courses, agenda, domotique…\n"
            "• statut → état de la connexion\n"
            "• déconnecter → délier ce numéro\n"
            "• aide → cette aide"
        )
    if lowered in {"/status", "status", "statut"}:
        return f"Connecté en tant que {user.full_name or user.email} (foyer #{household_id})."
    if lowered in {"/disconnect", "disconnect", "déconnecter", "deconnecter"}:
        db.delete(account)
        db.commit()
        return "Compte WhatsApp délié. Tu peux te reconnecter avec un nouveau code depuis l’app."

    mem = _memory_lines(db, household_id)
    try:
        outcome = execute_agent_act(command, db, auth, mem, force_execute=True)
    except Exception as exc:
        log_event("whatsapp_agent_failed", user_id=user.id, error=str(exc)[:200])
        return "Désolé, je n’ai pas pu traiter ta demande. Réessaie dans un instant."

    status = str(outcome.get("status") or "")
    message = str(outcome.get("message") or outcome.get("preview", {}).get("explanation") or "").strip()
    if not message:
        message = "Commande reçue." if status == "completed" else "Je te propose une action — confirme dans l’app si besoin."
    if status == "preview_only":
        message = f"{message}\n\n(Ouvre l’app Majordome pour valider si nécessaire.)"
    return message[:4096]


def handle_whatsapp_webhook(db: Session, payload: dict[str, Any]) -> None:
    if payload.get("object") != "whatsapp_business_account":
        return
    entries = payload.get("entry")
    if not isinstance(entries, list):
        return
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        changes = entry.get("changes")
        if not isinstance(changes, list):
            continue
        for change in changes:
            if not isinstance(change, dict):
                continue
            value = change.get("value")
            if not isinstance(value, dict):
                continue
            contacts = value.get("contacts") if isinstance(value.get("contacts"), list) else []
            name_by_wa: dict[str, str] = {}
            for c in contacts:
                if isinstance(c, dict):
                    wa = str(c.get("wa_id") or "").strip()
                    profile = c.get("profile") if isinstance(c.get("profile"), dict) else {}
                    if wa:
                        name_by_wa[wa] = str(profile.get("name") or "").strip()
            messages = value.get("messages")
            if not isinstance(messages, list):
                continue
            for msg in messages:
                if not isinstance(msg, dict):
                    continue
                wa_id = str(msg.get("from") or "").strip()
                if not wa_id:
                    continue
                msg_type = str(msg.get("type") or "")
                if msg_type != "text":
                    send_whatsapp_message(wa_id, "Pour l’instant j’accepte les messages texte.")
                    continue
                text_obj = msg.get("text") if isinstance(msg.get("text"), dict) else {}
                text = str(text_obj.get("body") or "").strip()
                if not text:
                    continue
                reply = process_whatsapp_text(
                    db,
                    wa_id=wa_id,
                    text=text,
                    profile_name=name_by_wa.get(wa_id),
                )
                send_whatsapp_message(wa_id, reply)
