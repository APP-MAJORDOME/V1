"""Registre unifié du hub MajorDome — connecteurs, APIs tierces, état réel par utilisateur."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ConnectedAccount, UserVaultSecret
from app.services.drive_integration import list_drive_status
from app.services.home import (
    _parse_home_assistant_credentials,
    get_home_providers,
    test_home_provider_connection,
)
from app.services.user_secrets_vault import list_user_vault_secrets
from app.services.vault_crypto import vault_encryption_enabled

# implementation: live | partial | stub | planned
# connection: oauth2 | credentials | token | vault | manual | bridge | none

_HUB_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "id": "google_calendar",
        "category": "calendar",
        "label": "Google Calendar",
        "implementation": "live",
        "connection": "oauth2",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_GOOGLE_OAUTH_CLIENT_ID", "MAJORDOME_GOOGLE_OAUTH_CLIENT_SECRET"],
        "api_reference": "https://developers.google.com/calendar/api/v3/reference",
        "connect_route": "POST /api/v1/integrations/google/oauth/start",
        "notes": "Scope calendar (lecture + écriture). Reconnecter si l’ancien token était readonly.",
        "alfred": True,
    },
    {
        "id": "microsoft_calendar",
        "category": "calendar",
        "label": "Microsoft 365 Calendar",
        "implementation": "live",
        "connection": "oauth2",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_MICROSOFT_OAUTH_CLIENT_ID", "MAJORDOME_MICROSOFT_OAUTH_CLIENT_SECRET"],
        "api_reference": "https://learn.microsoft.com/graph/api/resources-calendar",
        "connect_route": "POST /api/v1/integrations/microsoft/oauth/start",
        "alfred": True,
    },
    {
        "id": "apple_calendar",
        "category": "calendar",
        "label": "Apple Calendar (CalDAV)",
        "implementation": "partial",
        "connection": "credentials",
        "configure_in": "app",
        "env_keys": [],
        "api_reference": "https://developer.apple.com/documentation/coreservices/calendar_services",
        "connect_route": "POST /api/v1/integrations/apple/connect",
        "alfred": False,
    },
    {
        "id": "openai_llm",
        "category": "alfred",
        "label": "Alfred IA (OpenAI / Anthropic)",
        "implementation": "live",
        "connection": "api_key",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_LLM_PROVIDER", "MAJORDOME_LLM_API_KEY", "MAJORDOME_LLM_MODEL"],
        "api_reference": "https://platform.openai.com/docs/api-reference",
        "connect_route": None,
        "alfred": True,
    },
    {
        "id": "alfred_realtime",
        "category": "alfred",
        "label": "Alfred voix (Realtime)",
        "implementation": "partial",
        "connection": "api_key",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_LLM_API_KEY", "MAJORDOME_LLM_REALTIME_MODEL"],
        "api_reference": "https://platform.openai.com/docs/guides/realtime",
        "connect_route": "GET /api/v1/agent/realtime/status",
        "alfred": True,
    },
    {
        "id": "web_search",
        "category": "alfred",
        "label": "Recherche web (DuckDuckGo)",
        "implementation": "live",
        "connection": "none",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_WEB_SEARCH_ENABLED"],
        "api_reference": "https://pypi.org/project/duckduckgo-search/",
        "connect_route": None,
        "alfred": True,
    },
    {
        "id": "shopping_advisor",
        "category": "retail",
        "label": "Conseiller courses / promos",
        "implementation": "partial",
        "connection": "none",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_SHOPPING_ADVISOR_ENABLED"],
        "api_reference": None,
        "notes": "Pas d’API officielle enseigne — estimation web + LLM.",
        "alfred": True,
    },
    {
        "id": "vault_secrets",
        "category": "vault",
        "label": "Trousseau mots de passe",
        "implementation": "live",
        "connection": "vault",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_VAULT_ENCRYPTION_KEY"],
        "api_reference": None,
        "connect_route": "GET/POST /api/v1/vault/secrets",
        "alfred": True,
    },
    {
        "id": "drive_carrefour",
        "category": "retail",
        "label": "Carrefour Drive",
        "implementation": "partial",
        "connection": "manual",
        "configure_in": "app",
        "env_keys": ["MAJORDOME_DRIVE_AUTOMATION_ENABLED"],
        "api_reference": "https://www.carrefour.fr/drive",
        "notes": "Login + remplissage panier Playwright (best-effort) + liens recherche.",
        "connect_route": "POST /api/v1/vault/drive/carrefour/fill-cart",
        "service_key": "carrefour",
        "alfred": True,
    },
    {
        "id": "drive_marche_u",
        "category": "retail",
        "label": "Marché U / Courses U Drive",
        "implementation": "partial",
        "connection": "manual",
        "configure_in": "app",
        "service_key": "marche_u",
        "connect_route": "POST /api/v1/vault/drive/marche_u/prepare",
        "alfred": True,
    },
    {
        "id": "drive_leclerc",
        "category": "retail",
        "label": "E.Leclerc Drive",
        "implementation": "partial",
        "connection": "manual",
        "service_key": "leclerc",
        "connect_route": "POST /api/v1/vault/drive/leclerc/prepare",
        "alfred": True,
    },
    {
        "id": "home_assistant",
        "category": "domotic",
        "label": "Home Assistant",
        "implementation": "live",
        "connection": "token",
        "configure_in": "env_and_app",
        "env_keys": ["MAJORDOME_HOME_ADAPTER_MODE"],
        "api_reference": "https://developers.home-assistant.io/docs/api/rest/",
        "connect_route": "POST /api/v1/home/providers/home_assistant/connect",
        "alfred": True,
    },
    {
        "id": "tahoma",
        "category": "domotic",
        "label": "Somfy TaHoma",
        "implementation": "live",
        "connection": "credentials",
        "configure_in": "app",
        "api_reference": "https://developer.somfy.com/",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "alfred": True,
    },
    {
        "id": "google_home",
        "category": "domotic",
        "label": "Google Home",
        "implementation": "partial",
        "connection": "bridge",
        "api_reference": "https://developers.home.google.com/apis",
        "notes": "Pont Home Assistant (entités Google/Nest) si HOME_ADAPTER_MODE=home_assistant.",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "alfred": True,
    },
    {
        "id": "legrand_control",
        "category": "domotic",
        "label": "Legrand Home + Control",
        "implementation": "partial",
        "connection": "bridge",
        "api_reference": "https://www.legrand.fr/",
        "notes": "Pont Home Assistant (entités Legrand/Netatmo).",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "alfred": True,
    },
    {
        "id": "verisure",
        "category": "security",
        "label": "Verisure",
        "implementation": "partial",
        "connection": "credentials",
        "configure_in": "app",
        "api_reference": "https://github.com/persandstrom/python-verisure",
        "notes": "Test connexion vsure. Alfred : arme / désarme / mode maison (code PIN trousseau ou dans la phrase).",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "alfred": True,
    },
    {
        "id": "ezviz",
        "category": "security",
        "label": "Ezviz (caméras)",
        "implementation": "partial",
        "connection": "credentials",
        "configure_in": "app",
        "api_reference": "https://github.com/BaQs/pyEzviz",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "notes": "Liste caméras + veille / confidentialité via GET …/ezviz/devices.",
        "alfred": True,
    },
    {
        "id": "lsc_smart_connect",
        "category": "domotic",
        "label": "LSC Smart Connect",
        "implementation": "partial",
        "connection": "bridge",
        "notes": "Pont Home Assistant (Tuya/LSC).",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "alfred": True,
    },
    {
        "id": "sharkclean",
        "category": "domotic",
        "label": "SharkClean",
        "implementation": "partial",
        "connection": "bridge",
        "notes": "Pont Home Assistant (aspirateur Shark).",
        "connect_route": "POST /api/v1/home/providers/credentials",
        "alfred": True,
    },
    {
        "id": "twilio_sms",
        "category": "comms",
        "label": "SMS (Twilio)",
        "implementation": "partial",
        "connection": "api_key",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_TWILIO_ACCOUNT_SID", "MAJORDOME_TWILIO_AUTH_TOKEN"],
        "api_reference": "https://www.twilio.com/docs/sms",
        "alfred": False,
    },
    {
        "id": "smtp_email",
        "category": "comms",
        "label": "E-mail (SMTP)",
        "implementation": "partial",
        "connection": "credentials",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_SMTP_HOST", "MAJORDOME_SMTP_USER"],
        "alfred": True,
    },
    {
        "id": "telegram",
        "category": "comms",
        "label": "Telegram (Alfred)",
        "implementation": "live",
        "connection": "bot",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_TELEGRAM_BOT_TOKEN"],
        "api_reference": "https://core.telegram.org/bots/api",
        "connect_route": "POST /api/v1/integrations/telegram/link-code",
        "notes": "Lie ton chat via /start CODE depuis l’app (Paramètres → Connexions).",
        "alfred": True,
    },
    {
        "id": "whatsapp",
        "category": "comms",
        "label": "WhatsApp (Alfred)",
        "implementation": "live",
        "connection": "bot",
        "configure_in": "env",
        "env_keys": ["MAJORDOME_WHATSAPP_ACCESS_TOKEN", "MAJORDOME_WHATSAPP_PHONE_NUMBER_ID"],
        "api_reference": "https://developers.facebook.com/docs/whatsapp/cloud-api",
        "connect_route": "POST /api/v1/integrations/whatsapp/link-code",
        "notes": "Lie ton numéro via un code depuis l’app (Paramètres → Connexions).",
        "alfred": True,
    },
    {
        "id": "household_core",
        "category": "foyer",
        "label": "Foyer (tâches, courses, coffre, budget)",
        "implementation": "live",
        "connection": "none",
        "configure_in": "app",
        "alfred": True,
    },
)


def _env_configured(keys: list[str]) -> bool:
    mapping = {
        "MAJORDOME_GOOGLE_OAUTH_CLIENT_ID": settings.google_oauth_client_id,
        "MAJORDOME_GOOGLE_OAUTH_CLIENT_SECRET": settings.google_oauth_client_secret,
        "MAJORDOME_MICROSOFT_OAUTH_CLIENT_ID": settings.microsoft_oauth_client_id,
        "MAJORDOME_MICROSOFT_OAUTH_CLIENT_SECRET": settings.microsoft_oauth_client_secret,
        "MAJORDOME_LLM_API_KEY": settings.llm_api_key,
        "MAJORDOME_LLM_PROVIDER": settings.llm_provider,
        "MAJORDOME_LLM_MODEL": settings.llm_model,
        "MAJORDOME_LLM_REALTIME_MODEL": settings.llm_realtime_model,
        "MAJORDOME_WEB_SEARCH_ENABLED": "1" if settings.web_search_enabled else "",
        "MAJORDOME_SHOPPING_ADVISOR_ENABLED": "1" if settings.shopping_advisor_enabled else "",
        "MAJORDOME_VAULT_ENCRYPTION_KEY": settings.vault_encryption_key,
        "MAJORDOME_HOME_ADAPTER_MODE": settings.home_adapter_mode,
        "MAJORDOME_TWILIO_ACCOUNT_SID": settings.twilio_account_sid,
        "MAJORDOME_TWILIO_AUTH_TOKEN": settings.twilio_auth_token,
        "MAJORDOME_SMTP_HOST": settings.smtp_host,
        "MAJORDOME_SMTP_USER": settings.smtp_user,
        "MAJORDOME_TELEGRAM_BOT_TOKEN": settings.telegram_bot_token,
        "MAJORDOME_WHATSAPP_ACCESS_TOKEN": settings.whatsapp_access_token,
        "MAJORDOME_WHATSAPP_PHONE_NUMBER_ID": settings.whatsapp_phone_number_id,
    }
    if not keys:
        return True
    for key in keys:
        val = mapping.get(key)
        if key.endswith("_ENABLED"):
            if key == "MAJORDOME_WEB_SEARCH_ENABLED" and not settings.web_search_enabled:
                return False
            if key == "MAJORDOME_SHOPPING_ADVISOR_ENABLED" and not settings.shopping_advisor_enabled:
                return False
            continue
        if not str(val or "").strip():
            return False
    return True


def _account_map(db: Session, user_id: int) -> dict[str, ConnectedAccount]:
    rows = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user_id).all()
    return {str(r.provider): r for r in rows}


def _resolve_user_status(
    entry: dict[str, Any],
    accounts: dict[str, ConnectedAccount],
    vault_count: int,
    drive_links: list[dict],
) -> tuple[bool, bool, str, str | None]:
    cid = str(entry["id"])
    impl = str(entry.get("implementation") or "planned")

    if cid == "google_calendar":
        acc = accounts.get("google_calendar")
        ok = bool(settings.google_oauth_client_id and settings.google_oauth_client_secret)
        connected = acc is not None and acc.status == "connected"
        return ok, connected, acc.status if acc else "not_connected", None

    if cid == "microsoft_calendar":
        acc = accounts.get("microsoft_calendar")
        ok = bool(settings.microsoft_oauth_client_id and settings.microsoft_oauth_client_secret)
        connected = acc is not None and acc.status == "connected"
        return ok, connected, acc.status if acc else "not_connected", None

    if cid == "apple_calendar":
        acc = accounts.get("apple_calendar")
        connected = acc is not None and acc.status == "connected"
        return True, connected, acc.status if acc else "not_connected", None

    if cid == "openai_llm":
        prov = (settings.llm_provider or "").lower()
        key = (settings.llm_api_key or "").strip()
        ready = prov in {"openai", "chatgpt", "anthropic", "claude"} and bool(key)
        return ready, ready, "ready" if ready else "mock_or_unconfigured", None

    if cid == "alfred_realtime":
        ready = bool((settings.llm_api_key or "").strip())
        return ready, ready, "ready" if ready else "unconfigured", None

    if cid == "web_search":
        return settings.web_search_enabled, settings.web_search_enabled, "enabled", None

    if cid == "shopping_advisor":
        return settings.shopping_advisor_enabled, settings.shopping_advisor_enabled, "enabled", None

    if cid == "vault_secrets":
        enc = vault_encryption_enabled()
        return True, vault_count > 0, "encrypted" if enc else "no_encryption_key", None

    if cid.startswith("drive_"):
        sk = str(entry.get("service_key") or "")
        link = next((l for l in drive_links if str(l.get("service_key") or "") == sk), None)
        if link is None:
            return True, False, "needs_vault_account", "Ajoute le compte dans Réglages → Sécurité."
        st = str(link.get("drive_status") or "")
        connected = st == "credentials_ready"
        return True, connected, st or "unknown", str(link.get("open_url") or "") or None

    if cid == "home_assistant":
        acc = accounts.get("home_assistant")
        creds_ok = (
            acc is not None
            and acc.status == "connected"
            and _parse_home_assistant_credentials(acc) is not None
        )
        mode_global = (settings.home_adapter_mode or "").strip().lower() == "home_assistant"
        auto = bool(settings.home_assistant_auto_when_connected)
        if creds_ok and (mode_global or auto):
            hint = None if mode_global else "Actif via connexion utilisateur (auto HA)."
            return True, True, "connected", hint
        if creds_ok and not auto and not mode_global:
            return False, False, "adapter_mode_mock", "Active MAJORDOME_HOME_ASSISTANT_AUTO_WHEN_CONNECTED=true"
        return mode_global or auto, False, "not_connected", None

    if cid == "tahoma":
        acc = accounts.get("tahoma")
        connected = acc is not None and acc.status == "connected"
        return True, connected, acc.status if acc else "not_connected", None

    if cid == "verisure":
        acc = accounts.get("verisure")
        connected = acc is not None and acc.status == "connected"
        return True, connected, acc.status if acc else "not_connected", None

    if cid == "ezviz":
        acc = accounts.get("ezviz")
        connected = acc is not None and acc.status == "connected"
        return True, connected, acc.status if acc else "not_connected", None

    _ha_bridge_ids = frozenset({"google_home", "legrand_control", "lsc_smart_connect", "sharkclean"})
    if cid in _ha_bridge_ids:
        ha = accounts.get("home_assistant")
        ha_creds = _parse_home_assistant_credentials(ha) if ha else None
        mode_global = (settings.home_adapter_mode or "").strip().lower() == "home_assistant"
        auto = bool(settings.home_assistant_auto_when_connected)
        ha_ready = ha is not None and ha.status == "connected" and ha_creds is not None and (mode_global or auto)
        cred = accounts.get(cid)
        if ha_ready:
            return True, True, "bridge_ha", "Pilotage via Home Assistant (entités liées)."
        if cred is not None and cred.status == "connected":
            return (
                True,
                False,
                "bridge_ha_required",
                "Connecte Home Assistant (URL + token) dans Intégrations.",
            )
        return True, False, "not_connected", str(entry.get("notes") or "")

    if cid == "household_core":
        return True, True, "active", None

    if cid in {"twilio_sms", "smtp_email"}:
        ok = _env_configured(list(entry.get("env_keys") or []))
        return ok, ok, "configured" if ok else "not_configured", None

    if cid == "telegram":
        ok = bool((settings.telegram_bot_token or "").strip())
        acc = accounts.get("telegram")
        connected = acc is not None and acc.status == "connected"
        hint = None if connected else str(entry.get("notes") or "")
        return ok, connected, acc.status if acc else "not_connected", hint

    if cid == "whatsapp":
        ok = bool(
            (settings.whatsapp_access_token or "").strip()
            and (settings.whatsapp_phone_number_id or "").strip()
        )
        acc = accounts.get("whatsapp")
        connected = acc is not None and acc.status == "connected"
        hint = None if connected else str(entry.get("notes") or "")
        return ok, connected, acc.status if acc else "not_connected", hint

    # planned domotic stubs
    acc = accounts.get(cid)
    if acc and acc.status == "connected":
        return True, True, "marked_connected", str(entry.get("notes") or "Auth détaillée non implémentée.")
    return impl != "planned", False, "planned", str(entry.get("notes") or "")


def build_hub_overview(db: Session, user_id: int) -> dict[str, Any]:
    accounts = _account_map(db, user_id)
    vault = list_user_vault_secrets(db, user_id)
    vault_count = len(vault.get("secrets") or [])
    drive = list_drive_status(db, user_id)
    drive_links = drive.get("stores") if isinstance(drive.get("stores"), list) else []

    connectors: list[dict[str, Any]] = []
    live = mvp = stub = planned = 0

    for raw in _HUB_CATALOG:
        entry = dict(raw)
        configured, connected, status, hint = _resolve_user_status(entry, accounts, vault_count, drive_links)
        impl = str(entry.get("implementation") or "planned")
        cid = str(entry.get("id") or "")
        effective_impl = impl
        if cid == "alfred_realtime" and configured and impl == "partial":
            effective_impl = "live"
        if cid in {"google_home", "legrand_control", "lsc_smart_connect", "sharkclean"} and connected:
            effective_impl = "partial"

        if effective_impl == "live":
            live += 1
        elif effective_impl == "partial":
            mvp += 1
        elif effective_impl == "stub":
            stub += 1
        else:
            planned += 1

        entry.update(
            {
                "configured": configured,
                "connected": connected,
                "user_status": status,
                "status_hint": hint,
                "implementation": effective_impl,
                "ready_for_alfred": bool(entry.get("alfred"))
                and connected
                and effective_impl in {"live", "partial"},
            }
        )
        connectors.append(entry)

    home = get_home_providers(db, user_id)
    summary = {
        "total_catalog": len(_HUB_CATALOG),
        "implementation_live": live,
        "implementation_partial": mvp,
        "implementation_planned": planned,
        "user_connected": sum(1 for c in connectors if c.get("connected")),
        "user_ready_alfred": sum(1 for c in connectors if c.get("ready_for_alfred")),
        "vault_secrets_count": vault_count,
        "vault_encryption_at_rest": vault_encryption_enabled(),
        "home_providers_connected": sum(1 for p in home.get("providers", []) if p.get("connected")),
    }

    gaps = [
        c
        for c in connectors
        if str(c.get("implementation")) in {"planned", "stub"}
        or (str(c.get("implementation")) == "partial" and not c.get("connected"))
    ]

    return {
        "summary": summary,
        "connectors": connectors,
        "home_providers": home.get("providers") or [],
        "drive": drive,
        "gaps_priority": [
            {
                "id": c["id"],
                "label": c.get("label"),
                "reason": c.get("status_hint") or c.get("notes") or c.get("user_status"),
            }
            for c in gaps[:12]
        ],
    }
