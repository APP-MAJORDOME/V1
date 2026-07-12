"""Contrôle caméras Ezviz (veille / confidentialité) via pyezviz."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.services.home import _ezviz_credentials_from_scoped, _load_provider_account, list_provider_devices


def parse_ezviz_camera_action(command: str) -> tuple[str, str | None] | None:
    """Retourne (action, indice nom caméra) ou None si hors périmètre Ezviz."""
    lowered = (command or "").lower()
    if not any(k in lowered for k in ("ezviz", "caméra", "camera", "cam ")):
        return None

    action: str | None = None
    if any(k in lowered for k in ("confidential", "privacy", "volet", "cacher", "masque")):
        if any(k in lowered for k in ("desactive", "désactive", "off", "enleve", "enlève", "ouvre")):
            action = "privacy_off"
        else:
            action = "privacy_on"
    elif any(k in lowered for k in ("réveil", "reveil", "réveille", "reveille", "active", "allume")):
        action = "on"
    elif any(
        k in lowered
        for k in (
            " en veille",
            "veille cam",
            "mode veille",
            "dors",
            "éteins",
            "eteins",
            "coupe",
            " stop ",
            " off",
            "désactive",
            "desactive",
        )
    ):
        action = "off"
    else:
        action = "on"

    name_hint: str | None = None
    for pattern in (
        r"cam[ée]ra\s+(?:du|de la|de l'|de|d')\s*([a-zàâäéèêëïîôùûü0-9_-]{2,40})",
        r"cam[ée]ra\s+([a-zàâäéèêëïîôùûü0-9_-]{2,40})",
        r"ezviz\s+([a-zàâäéèêëïîôùûü0-9_-]{2,40})",
    ):
        m = re.search(pattern, lowered)
        if m:
            name_hint = m.group(1).strip()
            break
    return action, name_hint


def _pick_ezviz_device_id(
    devices: list[dict[str, Any]],
    name_hint: str | None,
) -> str | None:
    if not devices:
        return None
    if name_hint:
        hint = name_hint.lower()
        for row in devices:
            if not isinstance(row, dict):
                continue
            name = str(row.get("name") or "").lower()
            dev_id = str(row.get("id") or "").strip()
            if dev_id and (hint in name or name in hint):
                return dev_id
    first = devices[0]
    if isinstance(first, dict):
        return str(first.get("id") or "").strip() or None
    return None


def execute_ezviz_camera_action(db: Session, user_id: int, command: str) -> dict[str, Any] | None:
    parsed = parse_ezviz_camera_action(command)
    if parsed is None:
        return None
    action, name_hint = parsed

    account = _load_provider_account(db, user_id, "ezviz")
    if account is None:
        return {
            "provider": "ezviz",
            "action": action,
            "status": "not_connected",
            "message": "Ezviz non connecté — ajoute email + mot de passe dans Intégrations.",
        }
    try:
        import json

        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}
    if _ezviz_credentials_from_scoped(scoped) is None:
        return {
            "provider": "ezviz",
            "action": action,
            "status": "missing_credentials",
            "message": "Identifiants Ezviz manquants (email + mot de passe).",
        }

    listing = list_provider_devices(db=db, user_id=user_id, provider="ezviz")
    devices = listing.get("devices") if isinstance(listing.get("devices"), list) else []
    device_id = _pick_ezviz_device_id(devices, name_hint)
    if not device_id:
        err = listing.get("error")
        if err == "login_failed":
            return {
                "provider": "ezviz",
                "action": action,
                "status": "failed",
                "message": "Connexion Ezviz refusée — vérifie tes identifiants.",
            }
        return {
            "provider": "ezviz",
            "action": action,
            "status": "no_device_found",
            "message": "Aucune caméra Ezviz trouvée sur ce compte.",
        }

    from app.services.home import execute_provider_device_action

    out = execute_provider_device_action(
        db=db,
        user_id=user_id,
        provider="ezviz",
        device_id=device_id,
        action=action,
    )
    out["provider"] = "ezviz"
    return out
