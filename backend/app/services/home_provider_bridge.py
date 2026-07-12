"""Pont domotique : Google Home, Legrand, LSC, Shark → entités Home Assistant."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.home import (
    _ha_candidates,
    _list_home_assistant_devices,
    _load_home_assistant_account,
    _parse_home_assistant_credentials,
    _parse_home_device_action,
    execute_provider_device_action,
    home_assistant_active_for_user,
)

_HA_BRIDGE_PROVIDERS: dict[str, tuple[str, ...]] = {
    "google_home": ("google", "nest", "home mini", "chromecast", "assistant"),
    "legrand_control": ("legrand", "netatmo", "celiane", "home control"),
    "lsc_smart_connect": ("lsc", "smart connect", "tuya"),
    "sharkclean": ("shark", "sharkclean", "aspirateur"),
}

_PROVIDER_COMMAND_HINTS: dict[str, tuple[str, ...]] = {
    "google_home": ("google home", "google", "nest"),
    "legrand_control": ("legrand", "home control"),
    "lsc_smart_connect": ("lsc", "smart connect"),
    "sharkclean": ("shark", "sharkclean", "aspirateur"),
}


def command_mentions_provider(command: str, provider_id: str) -> bool:
    lowered = (command or "").lower()
    return any(h in lowered for h in _PROVIDER_COMMAND_HINTS.get(provider_id, ()))


def try_home_assistant_bridge(
    db: Session,
    user_id: int,
    command: str,
    *,
    provider_id: str | None = None,
) -> dict[str, Any] | None:
    if not home_assistant_active_for_user(db, user_id):
        return None
    account = _load_home_assistant_account(db=db, user_id=user_id)
    if _parse_home_assistant_credentials(account) is None:
        return None

    parsed = _parse_home_device_action(command)
    if not parsed:
        return None

    lowered = (command or "").lower()
    listing = _list_home_assistant_devices(db=db, user_id=user_id)
    devices = listing.get("devices") if isinstance(listing.get("devices"), list) else []
    rows = [x for x in devices if isinstance(x, dict)]

    keywords: tuple[str, ...] = ()
    bridge_provider = provider_id or ""
    if provider_id and provider_id in _HA_BRIDGE_PROVIDERS:
        if not command_mentions_provider(command, provider_id):
            return None
        keywords = _HA_BRIDGE_PROVIDERS[provider_id]
        bridge_provider = provider_id
    else:
        for pid, kws in _HA_BRIDGE_PROVIDERS.items():
            if command_mentions_provider(command, pid):
                keywords = kws
                bridge_provider = pid
                break
        if not keywords:
            return None

    filtered: list[dict] = []
    for d in rows:
        blob = " ".join(
            str(d.get(k) or "").lower()
            for k in ("id", "name", "device_type", "state", "zone")
        )
        if any(k in blob for k in keywords):
            filtered.append(d)
    if not filtered:
        filtered = rows

    candidates = _ha_candidates(
        filtered,
        lowered_command=lowered,
        zone_hint=str(parsed.get("zone") or ""),
        capability_id=str(parsed.get("capability") or ""),
    )
    if not candidates and filtered:
        candidates = filtered[:1]

    if not candidates:
        return {
            "provider": bridge_provider or "home_assistant",
            "capability": parsed.get("capability"),
            "action": parsed.get("action"),
            "target": parsed.get("zone"),
            "status": "no_device_found",
            "message": (
                f"Aucun appareil « {bridge_provider or 'domotique'} » dans Home Assistant. "
                "Ajoute l’intégration dans HA puis recharge les entités."
            ),
        }

    if len(candidates) > 1 and "confirme" not in lowered:
        labels = ", ".join(str(c.get("name") or "") for c in candidates[:5])
        return {
            "provider": bridge_provider or "home_assistant",
            "capability": parsed.get("capability"),
            "action": parsed.get("action"),
            "target": parsed.get("zone"),
            "status": "requires_mass_confirm",
            "message": (
                f"Plusieurs appareils HA ({labels}). "
                "Confirme ou précise la pièce / le nom d’entité."
            ),
        }

    picked = candidates[0]
    out = execute_provider_device_action(
        db=db,
        user_id=user_id,
        provider="home_assistant",
        device_id=str(picked.get("id") or ""),
        action=str(parsed.get("action") or "toggle"),
    )
    label = str(picked.get("name") or picked.get("id") or "")
    if str(out.get("status")) == "executed":
        out["provider"] = bridge_provider or "home_assistant"
        out["message"] = (
            f"Action via Home Assistant (pont {bridge_provider or 'HA'}) sur « {label} »."
        )
    return out


def home_control_setup_hint(db: Session, user_id: int) -> str:
    from app.services.home import get_home_providers

    providers = get_home_providers(db=db, user_id=user_id)
    connected = [
        str(p.get("label") or p.get("id"))
        for p in (providers.get("providers") or [])
        if isinstance(p, dict) and p.get("connected")
    ]
    if connected:
        return (
            "Connecteurs actifs : "
            + ", ".join(connected[:6])
            + ". Google Home / Legrand : via Home Assistant (connecte URL + token dans Intégrations)."
        )
    return (
        "Connecte TaHoma, Verisure, ou Home Assistant dans Intégrations (URL + token long-lived)."
    )
