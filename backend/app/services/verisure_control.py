"""Contrôle alarme Verisure via vsure (My Pages)."""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import ConnectedAccount
from app.services.user_secrets_vault import decrypt_credential_field


def _load_verisure_account(db: Session, user_id: int) -> ConnectedAccount | None:
    return (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider == "verisure",
        )
        .first()
    )


def _scoped_credentials(account: ConnectedAccount) -> dict[str, str]:
    try:
        raw = json.loads(account.scopes_json or "{}")
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) if v is not None else "" for k, v in raw.items()}


def parse_verisure_alarm_action(command: str) -> str | None:
    lowered = (command or "").lower()
    if "disarm" in lowered:
        return "disarm"
    if "arm_home" in lowered or "armhome" in lowered:
        return "arm_home"
    if "arm_away" in lowered or "armaway" in lowered:
        return "arm_away"
    if not any(k in lowered for k in ("verisure", "alarme", "alarm")):
        return None
    if any(k in lowered for k in ("desarme", "désarme", "desarmer", "eteins l'alarme", "éteins l'alarme")):
        return "disarm"
    if any(k in lowered for k in ("maison", "partiel", "nuit", "chez moi", "presence")):
        return "arm_home"
    if any(k in lowered for k in ("arme", "armé", "armement", "active l'alarme", "active l alarme", "absent", "sortie")):
        return "arm_away"
    if "verisure" in lowered or "alarme" in lowered:
        return "arm_away"
    return None


def _extract_pin(command: str, scoped: dict[str, str]) -> str | None:
    m = re.search(r"\b(\d{4,8})\b", command or "")
    if m:
        return m.group(1)
    stored = scoped.get("pin") or scoped.get("code")
    if stored:
        plain = decrypt_credential_field(stored)
        return plain.strip() if plain else None
    return None


def execute_verisure_alarm_by_action(
    db: Session,
    user_id: int,
    action: str,
    *,
    pin: str | None = None,
) -> dict[str, Any]:
    act = (action or "").strip().lower()
    if act not in {"arm_away", "arm_home", "disarm"}:
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": act or action,
            "status": "unsupported_command",
            "message": "Action Verisure non reconnue.",
        }
    return _run_verisure_alarm(db, user_id, act, pin_override=pin)


def execute_verisure_alarm_action(db: Session, user_id: int, command: str) -> dict[str, Any] | None:
    action = parse_verisure_alarm_action(command)
    if not action:
        return None
    return _run_verisure_alarm(db, user_id, action, command=command)


def _run_verisure_alarm(
    db: Session,
    user_id: int,
    action: str,
    *,
    command: str = "",
    pin_override: str | None = None,
) -> dict[str, Any]:
    account = _load_verisure_account(db, user_id)
    if account is None or account.status != "connected":
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": action,
            "status": "not_connected",
            "message": "Verisure non connecté — enregistre tes identifiants dans Intégrations.",
        }

    scoped = _scoped_credentials(account)
    username = str(scoped.get("username") or "").strip()
    password = decrypt_credential_field(str(scoped.get("password") or ""))
    pin = (pin_override or "").strip() or _extract_pin(command, scoped)
    if not username or not password:
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": action,
            "status": "missing_credentials",
            "message": "Identifiants Verisure manquants dans Intégrations.",
        }
    if not pin:
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": action,
            "status": "pin_required",
            "message": "Code alarme requis — dis par ex. « arme verisure 1234 » ou enregistre le code dans Intégrations.",
        }

    try:
        import verisure  # type: ignore[import-untyped]

        session = verisure.Session(username, password)
        session.login()
        if action == "disarm":
            session.disarm(pin)
            label = "désarmée"
        elif action == "arm_home":
            session.arm_home(pin)
            label = "armée mode maison"
        else:
            session.arm_away(pin)
            label = "armée mode absent"
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": action,
            "status": "executed",
            "message": f"Alarme Verisure {label}.",
        }
    except ImportError:
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": action,
            "status": "missing_dependency",
            "message": "Paquet vsure manquant sur le serveur.",
        }
    except Exception as exc:
        msg = str(exc).strip()[:200] or "échec API Verisure"
        return {
            "provider": "verisure",
            "capability": "alarm",
            "action": action,
            "status": "failed",
            "message": f"Verisure : {msg}",
        }
