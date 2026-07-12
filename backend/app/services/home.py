from __future__ import annotations

import json
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ConnectedAccount
from app.services.user_secrets_vault import decrypt_credential_field, encrypt_credential_field

_SUPPORTED_PROVIDERS: tuple[dict[str, str], ...] = (
    {"id": "home_assistant", "label": "Home Assistant"},
    {"id": "google_home", "label": "Google Home"},
    {"id": "legrand_control", "label": "Legrand Home + Control"},
    {"id": "tahoma", "label": "TaHoma"},
    {"id": "sharkclean", "label": "SharkClean"},
    {"id": "ezviz", "label": "Ezviz"},
    {"id": "verisure", "label": "Verisure"},
    {"id": "lsc_smart_connect", "label": "LSC Smart Connect"},
)


def _load_home_assistant_account(db: Session, user_id: int) -> ConnectedAccount | None:
    return (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider == "home_assistant",
        )
        .first()
    )


def _parse_home_assistant_credentials(account: ConnectedAccount | None) -> tuple[str, str] | None:
    if account is None:
        return None
    try:
        payload = json.loads(account.scopes_json or "{}")
    except Exception:
        return None
    base_url = str(payload.get("base_url") or "").rstrip("/")
    token = str(payload.get("access_token") or "")
    if not base_url or not token:
        return None
    return base_url, token


def home_assistant_active_for_user(db: Session, user_id: int) -> bool:
    creds = _parse_home_assistant_credentials(_load_home_assistant_account(db=db, user_id=user_id))
    return home_assistant_active_with_creds(creds)


def home_assistant_active_with_creds(creds: tuple[str, str] | None) -> bool:
    if creds is None:
        return False
    if (settings.home_adapter_mode or "").strip().lower() == "home_assistant":
        return True
    return bool(settings.home_assistant_auto_when_connected)


def _mock_home_status() -> dict:
    return {
        "mode": "mock",
        "lights_on": 3,
        "energy_alert": False,
        "robot_last_run_hours": 36,
        "recommended_actions": [
            "Verifier les lumieres du salon",
            "Envisager un nettoyage du salon",
        ],
    }


def _load_provider_account(db: Session, user_id: int, provider_id: str) -> ConnectedAccount | None:
    return (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider == provider_id,
        )
        .first()
    )


def _parse_home_device_action(command: str) -> dict[str, str] | None:
    text = (command or "").strip()
    lowered = text.lower()
    if not text:
        return None
    if "lumi" in lowered or "lampe" in lowered or "interrupteur" in lowered or "prise" in lowered:
        capability = "lights"
    elif "radiateur" in lowered or "chauff" in lowered:
        capability = "heating"
    elif "ventilation" in lowered or "ventilo" in lowered or "vmc" in lowered:
        capability = "ventilation"
    elif "volet" in lowered or "store" in lowered:
        capability = "opening"
    elif "scene" in lowered or "scène" in lowered:
        capability = "scene"
    else:
        return None

    if any(x in lowered for x in ("eteins", "éteins", "off", "arrete", "arrête", "ferme")):
        action = "off" if capability != "opening" else "close"
    elif any(x in lowered for x in ("allume", "on", "active", "demarre", "démarre", "ouvre")):
        action = "on" if capability != "opening" else "open"
    elif any(x in lowered for x in ("baisse", "dim", "reduis", "réduis")):
        action = "down"
    elif any(x in lowered for x in ("augmente", "monte", "boost")):
        action = "up"
    else:
        action = "toggle"

    zone = ""
    match = re.search(
        r"(salon|cuisine|chambre|chambres|bureau|entree|entrée|sdb|garage|rdc|rez de chaussee|rez-de-chaussee|etage|étage)",
        lowered,
    )
    if match:
        zone = match.group(1)
    return {"capability": capability, "action": action, "zone": zone}


def _tahoma_candidates(rows: list[dict], lowered_command: str, zone_hint: str) -> list[dict]:
    if not rows:
        return []
    normalized_zone = (zone_hint or "").strip().lower()
    normalized_command = lowered_command.lower()
    out: list[dict] = []

    def matches(name: str, token: str) -> bool:
        return token in name

    for d in rows:
        if not isinstance(d, dict):
            continue
        name = str(d.get("name") or "").strip().lower()
        if not name:
            continue
        if normalized_zone and matches(name, normalized_zone):
            out.append(d)
            continue
        # Groupes implicites
        if any(k in normalized_command for k in ("chambres", "chambre")) and "chambre" in name:
            out.append(d)
            continue
        if any(k in normalized_command for k in ("rdc", "rez de chaussee", "rez-de-chaussee")) and any(
            k in name for k in ("rdc", "rez", "salon", "cuisine")
        ):
            out.append(d)
            continue
        if any(k in normalized_command for k in ("etage", "étage")) and any(
            k in name for k in ("etage", "étage", "chambre", "bureau")
        ):
            out.append(d)
            continue
    return out


def get_home_providers(db: Session, user_id: int) -> dict:
    providers: list[dict[str, str | bool]] = []
    for p in _SUPPORTED_PROVIDERS:
        provider_id = p["id"]
        account = _load_provider_account(db, user_id, provider_id)
        providers.append(
            {
                "id": provider_id,
                "label": p["label"],
                "connected": bool(account and account.status == "connected"),
                "status": account.status if account else "not_connected",
            }
        )
    return {"providers": providers}


def diagnose_home_assistant(db: Session, user_id: int) -> dict[str, Any]:
    """Vérifie si le VPS peut joindre l’instance HA de l’utilisateur."""
    from urllib.parse import urlparse

    account = _load_home_assistant_account(db=db, user_id=user_id)
    creds = _parse_home_assistant_credentials(account)
    active = home_assistant_active_with_creds(creds)
    out: dict[str, Any] = {
        "provider": "home_assistant",
        "status": "not_connected",
        "message": "Home Assistant non configuré — ajoute URL + token dans Intégrations.",
        "adapter_mode": settings.home_adapter_mode,
        "auto_when_connected": bool(settings.home_assistant_auto_when_connected),
        "active_for_user": active,
        "entity_count": 0,
        "reachable_from_server": False,
        "base_url_host": None,
    }
    if creds is None:
        return out

    base_url, token = creds
    out["base_url_host"] = (urlparse(base_url).netloc or base_url)[:120]
    try:
        with httpx.Client(timeout=12) as client:
            res = client.get(f"{base_url}/api/", headers={"Authorization": f"Bearer {token}"})
            res.raise_for_status()
        out["reachable_from_server"] = True
        listing = _list_home_assistant_devices(db=db, user_id=user_id)
        devices = listing.get("devices") if isinstance(listing.get("devices"), list) else []
        out["entity_count"] = len(devices)
        if not active:
            out["status"] = "inactive_mode"
            out["message"] = (
                f"HA joignable ({out['entity_count']} entité(s)) mais pilotage inactif — "
                "vérifie MAJORDOME_HOME_ASSISTANT_AUTO_WHEN_CONNECTED."
            )
        elif out["entity_count"] == 0:
            out["status"] = "ok_empty"
            out["message"] = "HA joignable depuis le serveur mais aucune entité contrôlable chargée."
        else:
            out["status"] = "ok"
            out["message"] = (
                f"Home Assistant OK depuis le serveur — {out['entity_count']} entité(s) pour Alfred."
            )
    except Exception as exc:
        host = out.get("base_url_host") or "HA"
        out["status"] = "unreachable"
        out["message"] = (
            f"Le serveur majordom.eu ne joint pas {host} ({str(exc).strip()[:100]}). "
            "Utilise une URL publique, Nabu Casa ou un tunnel vers ton HA local."
        )
    return out


def connect_home_assistant(db: Session, user_id: int, base_url: str, access_token: str) -> ConnectedAccount:
    cleaned_url = str(base_url or "").strip().rstrip("/")
    cleaned_token = str(access_token or "").strip()
    if not cleaned_url.startswith("http://") and not cleaned_url.startswith("https://"):
        cleaned_url = f"https://{cleaned_url}"
    payload = {"base_url": cleaned_url, "access_token": cleaned_token}
    account = _load_home_assistant_account(db, user_id)
    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider="home_assistant",
            status="connected",
            scopes_json=json.dumps(payload),
        )
        db.add(account)
    else:
        account.status = "connected"
        account.scopes_json = json.dumps(payload)
    db.commit()
    db.refresh(account)
    return account


def connect_home_provider(
    db: Session,
    user_id: int,
    provider: str,
    external_account_id: str | None = None,
    status: str = "connected",
) -> ConnectedAccount | None:
    pid = (provider or "").strip().lower()
    allowed = {p["id"] for p in _SUPPORTED_PROVIDERS if p["id"] != "home_assistant"}
    if pid not in allowed:
        return None
    account = _load_provider_account(db, user_id, pid)
    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider=pid,
            external_account_id=(external_account_id or "").strip() or None,
            status=status,
        )
        db.add(account)
    else:
        account.status = status
        account.external_account_id = (external_account_id or "").strip() or account.external_account_id
    db.commit()
    db.refresh(account)
    return account


def upsert_home_provider_credentials(
    db: Session,
    user_id: int,
    provider: str,
    *,
    username: str | None = None,
    password: str | None = None,
    pin: str | None = None,
    access_token: str | None = None,
    base_url: str | None = None,
    external_account_id: str | None = None,
) -> ConnectedAccount | None:
    pid = (provider or "").strip().lower()
    allowed = {p["id"] for p in _SUPPORTED_PROVIDERS}
    if pid not in allowed:
        return None

    account = _load_provider_account(db, user_id, pid)
    try:
        scoped = json.loads(account.scopes_json or "{}") if account else {}
    except Exception:
        scoped = {}

    if username is not None:
        scoped["username"] = username.strip()
    if password is not None:
        scoped["password"] = encrypt_credential_field(password.strip())
    if pin is not None:
        scoped["pin"] = encrypt_credential_field(pin.strip())
    if access_token is not None:
        scoped["access_token"] = access_token.strip()
    if base_url is not None:
        scoped["base_url"] = base_url.strip().rstrip("/")

    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider=pid,
            external_account_id=(external_account_id or "").strip() or None,
            status="connected",
            scopes_json=json.dumps(scoped),
        )
        db.add(account)
    else:
        account.status = "connected"
        if external_account_id is not None:
            account.external_account_id = external_account_id.strip() or account.external_account_id
        account.scopes_json = json.dumps(scoped)
    db.commit()
    db.refresh(account)
    return account


def test_home_provider_connection(db: Session, user_id: int, provider: str) -> dict:
    provider_id = (provider or "").strip().lower()
    if provider_id == "home_assistant":
        account = _load_home_assistant_account(db=db, user_id=user_id)
        creds = _parse_home_assistant_credentials(account)
        if creds is None:
            return {
                "provider": "home_assistant",
                "status": "not_configured",
                "message": "Home Assistant non configuré (URL/token manquants).",
            }
        base_url, token = creds
        try:
            with httpx.Client(timeout=8) as client:
                res = client.get(f"{base_url}/api/", headers={"Authorization": f"Bearer {token}"})
                res.raise_for_status()
            return {
                "provider": "home_assistant",
                "status": "ok",
                "message": "Connexion Home Assistant valide.",
            }
        except Exception:
            return {
                "provider": "home_assistant",
                "status": "failed",
                "message": "Connexion Home Assistant échouée (URL/token ou accès réseau).",
            }
    account = _load_provider_account(db, user_id, provider_id)
    if account is None:
        return {
            "provider": provider_id,
            "status": "not_connected",
            "message": "Provider non connecté.",
        }
    if provider_id == "tahoma":
        try:
            scoped = json.loads(account.scopes_json or "{}")
        except Exception:
            scoped = {}
        username = str(scoped.get("username") or "").strip()
        password = decrypt_credential_field(str(scoped.get("password") or ""))
        base_url = str(scoped.get("base_url") or "https://ha101-1.overkiz.com").strip().rstrip("/")
        if not username or not password:
            return {
                "provider": provider_id,
                "status": "missing_credentials",
                "message": "Renseigne email + mot de passe TaHoma pour tester.",
            }
        try:
            with httpx.Client(timeout=12) as client:
                response = client.post(
                    f"{base_url}/enduser-mobile-web/enduserAPI/login",
                    data={"userId": username, "userPassword": password},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
            if response.status_code in {200, 204}:
                return {
                    "provider": provider_id,
                    "status": "ok",
                    "message": "Connexion TaHoma valide.",
                }
            return {
                "provider": provider_id,
                "status": "failed",
                "message": f"Connexion TaHoma refusée (HTTP {response.status_code}).",
            }
        except Exception:
            return {
                "provider": provider_id,
                "status": "failed",
                "message": "Connexion TaHoma échouée (réseau ou identifiants).",
            }

    if provider_id == "verisure":
        try:
            scoped = json.loads(account.scopes_json or "{}")
        except Exception:
            scoped = {}
        username = str(scoped.get("username") or "").strip()
        password = decrypt_credential_field(str(scoped.get("password") or ""))
        if not username or not password:
            return {
                "provider": provider_id,
                "status": "missing_credentials",
                "message": "Renseigne email + mot de passe Verisure (My Pages) pour tester.",
            }
        try:
            import verisure  # type: ignore[import-untyped]  # package: vsure

            session = verisure.Session(username, password)
            session.login()
            return {
                "provider": provider_id,
                "status": "ok",
                "message": "Connexion Verisure (My Pages) validée.",
            }
        except ImportError:
            return {
                "provider": provider_id,
                "status": "missing_dependency",
                "message": "Installe le paquet vsure sur le serveur (pip install vsure).",
            }
        except Exception as exc:
            msg = str(exc).strip()[:180] or "identifiants ou MFA refusés"
            return {
                "provider": provider_id,
                "status": "failed",
                "message": f"Connexion Verisure échouée : {msg}",
            }

    if provider_id == "ezviz":
        try:
            scoped = json.loads(account.scopes_json or "{}")
        except Exception:
            scoped = {}
        username = str(scoped.get("username") or "").strip()
        password = decrypt_credential_field(str(scoped.get("password") or ""))
        if not username or not password:
            return {
                "provider": provider_id,
                "status": "missing_credentials",
                "message": "Renseigne email + mot de passe Ezviz pour tester.",
            }
        try:
            from pyezviz import EzvizClient  # type: ignore[import-untyped]

            client = EzvizClient(account=username, password=password)
            uid = client.get_user_id()
            try:
                cams = client.load_cameras() or {}
                cam_count = len(cams) if isinstance(cams, dict) else 0
            except Exception:
                cam_count = 0
            extra = f", {cam_count} caméra(s)" if cam_count else ""
            return {
                "provider": provider_id,
                "status": "ok",
                "message": f"Connexion Ezviz validée (compte {uid or 'OK'}{extra}).",
            }
        except ImportError:
            return {
                "provider": provider_id,
                "status": "missing_dependency",
                "message": "Paquet pyezviz manquant sur le serveur.",
            }
        except Exception as exc:
            return {
                "provider": provider_id,
                "status": "failed",
                "message": f"Connexion Ezviz échouée : {str(exc).strip()[:160]}",
            }

    if provider_id in {"google_home", "legrand_control", "lsc_smart_connect", "sharkclean"}:
        ha = _load_home_assistant_account(db=db, user_id=user_id)
        ha_ok = home_assistant_active_with_creds(_parse_home_assistant_credentials(ha))
        if ha_ok:
            listing = _list_home_assistant_devices(db=db, user_id=user_id)
            count = len(listing.get("devices") or [])
            return {
                "provider": provider_id,
                "status": "ok",
                "message": (
                    f"Pont Home Assistant actif ({count} entité(s)). "
                    "Alfred peut piloter via HA — dis par ex. « éteins la lumière du salon »."
                ),
            }
        return {
            "provider": provider_id,
            "status": "bridge_ha_required",
            "message": (
                "Identifiants enregistrés. Pour actions réelles : connecte Home Assistant "
                "(URL + token) et définis MAJORDOME_HOME_ADAPTER_MODE=home_assistant sur le serveur."
            ),
        }

    return {
        "provider": provider_id,
        "status": "pending_api",
        "message": "Connecteur enregistré. Test API native à implémenter avec OAuth partenaire.",
    }


def _tahoma_login_context(scoped: dict[str, str]):
    username = str(scoped.get("username") or "").strip()
    password = decrypt_credential_field(str(scoped.get("password") or ""))
    base_url = str(scoped.get("base_url") or "https://ha101-1.overkiz.com").strip().rstrip("/")
    if not username or not password:
        return None, base_url, "missing_credentials"
    client = httpx.Client(timeout=15)
    try:
        response = client.post(
            f"{base_url}/enduser-mobile-web/enduserAPI/login",
            data={"userId": username, "userPassword": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code not in {200, 204}:
            client.close()
            return None, base_url, f"login_http_{response.status_code}"
        return client, base_url, None
    except Exception:
        client.close()
        return None, base_url, "login_failed"


_HA_DEVICE_DOMAINS = frozenset({"light", "cover", "switch", "climate", "fan", "lock", "scene"})

_HA_CAPABILITY_DOMAINS: dict[str, frozenset[str]] = {
    "lights": frozenset({"light", "switch"}),
    "heating": frozenset({"climate"}),
    "ventilation": frozenset({"fan"}),
    "opening": frozenset({"cover"}),
    "scene": frozenset({"scene"}),
}


def _ha_domains_for_capability(capability_id: str) -> frozenset[str]:
    return _HA_CAPABILITY_DOMAINS.get(capability_id, frozenset())


def _ha_candidates(
    devices: list[dict],
    *,
    lowered_command: str,
    zone_hint: str,
    capability_id: str,
) -> list[dict]:
    if not devices:
        return []
    allowed = _ha_domains_for_capability(capability_id)
    if not allowed:
        return []
    normalized_zone = (zone_hint or "").strip().lower()
    normalized_command = lowered_command.lower()
    out: list[dict] = []

    def name_matches(device: dict, token: str) -> bool:
        if not token:
            return False
        name = str(device.get("name") or "").strip().lower()
        entity = str(device.get("id") or "").strip().lower()
        return token in name or token in entity.replace("_", " ")

    for device in devices:
        if not isinstance(device, dict):
            continue
        domain = str(device.get("device_type") or "").strip().lower()
        if domain not in allowed:
            continue
        if normalized_zone and name_matches(device, normalized_zone):
            out.append(device)
            continue
        if not normalized_zone:
            continue
        if any(k in normalized_command for k in ("chambres", "chambre")) and "chambre" in str(
            device.get("name") or ""
        ).lower():
            out.append(device)
            continue
        if any(k in normalized_command for k in ("rdc", "rez de chaussee", "rez-de-chaussee")) and any(
            k in str(device.get("name") or "").lower() for k in ("rdc", "rez", "salon", "cuisine", "entree", "entrée")
        ):
            out.append(device)
            continue
        if any(k in normalized_command for k in ("etage", "étage")) and any(
            k in str(device.get("name") or "").lower() for k in ("etage", "étage", "chambre", "bureau")
        ):
            out.append(device)

    if out:
        return out

    if not normalized_zone:
        return [d for d in devices if isinstance(d, dict) and str(d.get("device_type") or "") in allowed]

    tokens = [t for t in re.split(r"[^a-z0-9àâäéèêëïîôùûüç]+", normalized_command) if len(t) >= 4]
    fuzzy: list[dict] = []
    for device in devices:
        if not isinstance(device, dict):
            continue
        if str(device.get("device_type") or "") not in allowed:
            continue
        label = str(device.get("name") or "").lower()
        if any(t in label for t in tokens):
            fuzzy.append(device)
    return fuzzy[:12]


def _list_home_assistant_devices(db: Session, user_id: int) -> dict:
    account = _load_home_assistant_account(db=db, user_id=user_id)
    creds = _parse_home_assistant_credentials(account)
    if creds is None:
        return {"provider": "home_assistant", "devices": [], "error": "not_configured"}
    base_url, token = creds
    headers = {"Authorization": f"Bearer {token}"}
    try:
        with httpx.Client(timeout=12) as client:
            response = client.get(f"{base_url}/api/states", headers=headers)
            response.raise_for_status()
            states = response.json()
    except Exception:
        return {"provider": "home_assistant", "devices": [], "error": "states_failed"}

    devices: list[dict[str, str | bool | None]] = []
    if isinstance(states, list):
        for state in states[:200]:
            if not isinstance(state, dict):
                continue
            entity_id = str(state.get("entity_id") or "").strip()
            if not entity_id or "." not in entity_id:
                continue
            domain = entity_id.split(".", 1)[0]
            if domain not in _HA_DEVICE_DOMAINS:
                continue
            attrs = state.get("attributes") if isinstance(state.get("attributes"), dict) else {}
            name = str(attrs.get("friendly_name") or entity_id).strip()[:160]
            devices.append(
                {
                    "id": entity_id,
                    "name": name,
                    "provider": "home_assistant",
                    "device_type": domain,
                    "controllable": domain != "scene",
                    "state": str(state.get("state") or "")[:40] or None,
                }
            )
    devices.sort(key=lambda d: str(d.get("name") or "").lower())
    return {"provider": "home_assistant", "devices": devices[:120]}


def _ezviz_credentials_from_scoped(scoped: dict[str, Any]) -> tuple[str, str] | None:
    username = str(scoped.get("username") or "").strip()
    password = decrypt_credential_field(str(scoped.get("password") or ""))
    if not username or not password:
        return None
    return username, password


def _list_ezviz_devices(db: Session, user_id: int) -> dict:
    account = _load_provider_account(db, user_id, "ezviz")
    if account is None:
        return {"provider": "ezviz", "devices": []}
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}
    creds = _ezviz_credentials_from_scoped(scoped)
    if creds is None:
        return {"provider": "ezviz", "devices": [], "error": "missing_credentials"}
    username, password = creds
    try:
        from pyezviz import EzvizClient  # type: ignore[import-untyped]

        client = EzvizClient(account=username, password=password)
        cameras = client.load_cameras() or {}
    except ImportError:
        return {"provider": "ezviz", "devices": [], "error": "missing_dependency"}
    except Exception:
        return {"provider": "ezviz", "devices": [], "error": "login_failed"}

    devices: list[dict[str, str | bool | None]] = []
    if isinstance(cameras, dict):
        for serial, data in list(cameras.items())[:80]:
            serial_s = str(serial).strip()
            if not serial_s:
                continue
            name = serial_s
            device_type = "camera"
            state: str | None = None
            if isinstance(data, dict):
                name = str(data.get("name") or serial_s).strip()[:160]
                device_type = str(data.get("device_sub_category") or data.get("device_category") or "camera")[
                    :120
                ]
                raw_status = data.get("status")
                if raw_status is not None:
                    state = str(raw_status)[:40]
            devices.append(
                {
                    "id": serial_s,
                    "name": name,
                    "provider": "ezviz",
                    "device_type": device_type,
                    "state": state,
                    "controllable": True,
                }
            )
    return {"provider": "ezviz", "devices": devices}


def _home_assistant_service_call(
    base_url: str,
    token: str,
    entity_id: str,
    action_id: str,
) -> tuple[str, dict] | None:
    domain = entity_id.split(".", 1)[0]
    if domain == "cover":
        service = {
            "open": "open",
            "close": "close",
            "up": "open",
            "down": "close",
            "stop": "stop",
            "on": "open",
            "off": "close",
        }.get(action_id)
        if service:
            return f"cover/{service}", {"entity_id": entity_id}
    if domain in {"light", "switch", "fan"}:
        service = {
            "on": "turn_on",
            "off": "turn_off",
            "toggle": "toggle",
            "open": "turn_on",
            "close": "turn_off",
        }.get(action_id)
        if service:
            return f"{domain}/{service}", {"entity_id": entity_id}
    if domain == "climate":
        service = {"on": "turn_on", "off": "turn_off", "toggle": "toggle"}.get(action_id)
        if service:
            return f"climate/{service}", {"entity_id": entity_id}
    if domain == "lock":
        service = {"on": "open", "off": "lock", "open": "open", "close": "lock"}.get(action_id)
        if service:
            return f"lock/{service}", {"entity_id": entity_id}
    if domain == "scene" and action_id in {"on", "open", "activate", "toggle"}:
        return "scene/turn_on", {"entity_id": entity_id}
    return None


def list_provider_devices(db: Session, user_id: int, provider: str) -> dict:
    provider_id = (provider or "").strip().lower()
    if provider_id == "home_assistant":
        return _list_home_assistant_devices(db=db, user_id=user_id)
    if provider_id == "ezviz":
        return _list_ezviz_devices(db=db, user_id=user_id)

    account = _load_provider_account(db, user_id, provider_id)
    if account is None:
        return {"provider": provider_id, "devices": []}
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}

    if provider_id != "tahoma":
        return {"provider": provider_id, "devices": []}

    client, base_url, error = _tahoma_login_context(scoped)
    if client is None:
        return {"provider": provider_id, "devices": [], "error": error}
    try:
        response = client.get(f"{base_url}/enduser-mobile-web/enduserAPI/setup")
        response.raise_for_status()
        payload = response.json()
        raw_devices = payload.get("devices") if isinstance(payload, dict) else []
        devices: list[dict[str, str | bool | None]] = []
        if isinstance(raw_devices, list):
            for d in raw_devices[:120]:
                if not isinstance(d, dict):
                    continue
                device_id = str(d.get("deviceURL") or d.get("oid") or d.get("id") or "").strip()
                if not device_id:
                    continue
                name = str(d.get("label") or d.get("name") or device_id).strip()[:160]
                device_type = str(d.get("uiClass") or d.get("controllableName") or "").strip()[:120] or None
                devices.append(
                    {
                        "id": device_id,
                        "name": name,
                        "provider": provider_id,
                        "device_type": device_type,
                        "controllable": True,
                    }
                )
        return {"provider": provider_id, "devices": devices}
    except Exception:
        return {"provider": provider_id, "devices": [], "error": "setup_failed"}
    finally:
        client.close()


def execute_provider_device_action(
    db: Session,
    user_id: int,
    provider: str,
    device_id: str,
    action: str,
) -> dict:
    provider_id = (provider or "").strip().lower()
    device = (device_id or "").strip()
    action_id = (action or "").strip().lower()
    if not device:
        return {
            "provider": provider_id,
            "device_id": "",
            "action": action_id,
            "status": "invalid_device",
            "message": "Identifiant appareil manquant.",
        }

    account = _load_provider_account(db, user_id, provider_id)
    if account is None:
        return {
            "provider": provider_id,
            "device_id": device,
            "action": action_id,
            "status": "not_connected",
            "message": "Provider non connecté.",
        }
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}

    if provider_id == "home_assistant":
        account = _load_home_assistant_account(db=db, user_id=user_id)
        creds = _parse_home_assistant_credentials(account)
        if creds is None:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "not_connected",
                "message": "Home Assistant non configuré (URL/token).",
            }
        base_url, token = creds
        call = _home_assistant_service_call(base_url, token, device, action_id)
        if call is None:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "unsupported_action",
                "message": f"Action « {action_id} » non supportée pour {device}.",
            }
        endpoint, payload = call
        headers = {"Authorization": f"Bearer {token}"}
        try:
            with httpx.Client(timeout=12) as client:
                response = client.post(
                    f"{base_url}/api/services/{endpoint}",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "executed",
                "message": "Action exécutée via Home Assistant.",
            }
        except Exception:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "failed",
                "message": "Home Assistant n’a pas accepté la commande.",
            }

    if provider_id == "ezviz":
        creds = _ezviz_credentials_from_scoped(scoped)
        if creds is None:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "missing_credentials",
                "message": "Identifiants Ezviz manquants.",
            }
        if action_id not in {"on", "off", "privacy_on", "privacy_off"}:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "unsupported_action",
                "message": "Actions Ezviz : on, off, privacy_on, privacy_off.",
            }
        try:
            from pyezviz import EzvizClient  # type: ignore[import-untyped]

            username, password = creds
            ez_client = EzvizClient(account=username, password=password)
            ez_client.load_cameras()
            cam = getattr(ez_client, "_cameras", {}).get(device)
            if cam is None:
                return {
                    "provider": provider_id,
                    "device_id": device,
                    "action": action_id,
                    "status": "device_not_found",
                    "message": "Caméra introuvable sur le compte Ezviz.",
                }
            if action_id == "on":
                cam.switch_sleep_mode(0)
            elif action_id == "off":
                cam.switch_sleep_mode(1)
            elif action_id == "privacy_on":
                cam.switch_privacy_mode(1)
            else:
                cam.switch_privacy_mode(0)
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "executed",
                "message": "Commande Ezviz envoyée.",
            }
        except ImportError:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "missing_dependency",
                "message": "Paquet pyezviz manquant sur le serveur.",
            }
        except Exception as exc:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "failed",
                "message": f"Ezviz : {str(exc).strip()[:160]}",
            }

    if provider_id != "tahoma":
        return {
            "provider": provider_id,
            "device_id": device,
            "action": action_id,
            "status": "pending_api",
            "message": "Action device non implémentée pour ce provider.",
        }

    client, base_url, error = _tahoma_login_context(scoped)
    if client is None:
        return {
            "provider": provider_id,
            "device_id": device,
            "action": action_id,
            "status": error or "login_failed",
            "message": "Connexion TaHoma impossible pour exécuter l’action.",
        }

    command_name = {
        "on": "on",
        "off": "off",
        "open": "open",
        "close": "close",
        "up": "open",
        "down": "close",
        "stop": "stop",
        "toggle": "my",
    }.get(action_id, action_id or "my")
    payload = {
        "label": f"MajorDome {command_name}",
        "actions": [
            {
                "deviceURL": device,
                "commands": [{"name": command_name}],
            }
        ],
    }
    try:
        response = client.post(f"{base_url}/enduser-mobile-web/enduserAPI/exec/apply", json=payload)
        if response.status_code in {200, 201, 202, 204}:
            return {
                "provider": provider_id,
                "device_id": device,
                "action": action_id,
                "status": "executed",
                "message": f"Action {command_name} envoyée à TaHoma.",
            }
        return {
            "provider": provider_id,
            "device_id": device,
            "action": action_id,
            "status": "failed",
            "message": f"TaHoma a refusé la commande (HTTP {response.status_code}).",
        }
    except Exception:
        return {
            "provider": provider_id,
            "device_id": device,
            "action": action_id,
            "status": "failed",
            "message": "Erreur réseau TaHoma lors de l’exécution de la commande.",
        }
    finally:
        client.close()


def _read_groups_from_account(account: ConnectedAccount | None) -> list[dict]:
    if account is None:
        return []
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        return []
    groups = scoped.get("device_groups")
    if not isinstance(groups, list):
        return []
    out: list[dict] = []
    for g in groups:
        if not isinstance(g, dict):
            continue
        name = str(g.get("name") or "").strip().lower()
        provider = str(g.get("provider") or "tahoma").strip().lower()
        device_ids = g.get("device_ids")
        if not name or not isinstance(device_ids, list):
            continue
        clean_ids = [str(x).strip() for x in device_ids if str(x).strip()][:120]
        if not clean_ids:
            continue
        out.append({"name": name, "provider": provider, "device_ids": clean_ids})
    return out


def list_device_groups(db: Session, user_id: int) -> dict:
    account = _load_provider_account(db, user_id, "tahoma")
    groups = _read_groups_from_account(account)
    return {"groups": groups}


def upsert_device_group(
    db: Session,
    user_id: int,
    group_name: str,
    provider: str,
    device_ids: list[str],
) -> dict:
    name = (group_name or "").strip().lower()
    provider_id = (provider or "tahoma").strip().lower()
    if not name:
        return {"groups": []}
    account = _load_provider_account(db, user_id, provider_id)
    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider=provider_id,
            status="connected",
            scopes_json=json.dumps({}),
        )
        db.add(account)
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}
    groups = _read_groups_from_account(account)
    clean_ids = [str(x).strip() for x in device_ids if str(x).strip()][:120]
    updated = False
    for g in groups:
        if g["name"] == name:
            g["provider"] = provider_id
            g["device_ids"] = clean_ids
            updated = True
            break
    if not updated and clean_ids:
        groups.append({"name": name, "provider": provider_id, "device_ids": clean_ids})
    scoped["device_groups"] = groups
    account.scopes_json = json.dumps(scoped)
    db.commit()
    return {"groups": groups}


def delete_device_group(db: Session, user_id: int, group_name: str) -> dict:
    name = (group_name or "").strip().lower()
    if not name:
        return {"groups": list_device_groups(db, user_id).get("groups") or []}
    account = _load_provider_account(db, user_id, "tahoma")
    if account is None:
        return {"groups": []}
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}
    groups = _read_groups_from_account(account)
    groups = [g for g in groups if str(g.get("name") or "") != name]
    scoped["device_groups"] = groups
    account.scopes_json = json.dumps(scoped)
    db.commit()
    return {"groups": groups}


def update_device_group_members(
    db: Session,
    user_id: int,
    group_name: str,
    operation: str,
    provider: str,
    device_ids: list[str],
) -> dict:
    name = (group_name or "").strip().lower()
    op = (operation or "").strip().lower()
    provider_id = (provider or "tahoma").strip().lower()
    clean_ids = [str(x).strip() for x in (device_ids or []) if str(x).strip()][:120]
    if not name:
        return {"groups": []}
    if op not in {"add", "remove"}:
        return {"groups": list_device_groups(db, user_id).get("groups") or []}

    account = _load_provider_account(db, user_id, provider_id)
    if account is None:
        account = ConnectedAccount(
            user_id=user_id,
            provider=provider_id,
            status="connected",
            scopes_json=json.dumps({}),
        )
        db.add(account)
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}
    groups = _read_groups_from_account(account)
    group = next((g for g in groups if g.get("name") == name), None)
    if group is None:
        group = {"name": name, "provider": provider_id, "device_ids": []}
        groups.append(group)
    existing = [str(x).strip() for x in group.get("device_ids") or [] if str(x).strip()]
    if op == "add":
        merged = list(dict.fromkeys([*existing, *clean_ids]))
        group["device_ids"] = merged[:120]
    else:
        to_remove = set(clean_ids)
        group["device_ids"] = [x for x in existing if x not in to_remove][:120]
    if not group.get("device_ids"):
        groups = [g for g in groups if g.get("name") != name]

    scoped["device_groups"] = groups
    account.scopes_json = json.dumps(scoped)
    db.commit()
    return {"groups": groups}


def rename_device_group(
    db: Session,
    user_id: int,
    group_name: str,
    new_name: str,
) -> dict:
    current = (group_name or "").strip().lower()
    target = (new_name or "").strip().lower()
    if not current or not target:
        return {"groups": list_device_groups(db, user_id).get("groups") or []}
    account = _load_provider_account(db, user_id, "tahoma")
    if account is None:
        return {"groups": []}
    try:
        scoped = json.loads(account.scopes_json or "{}")
    except Exception:
        scoped = {}
    groups = _read_groups_from_account(account)
    source = next((g for g in groups if str(g.get("name") or "") == current), None)
    if source is None:
        return {"groups": groups}

    dest = next((g for g in groups if str(g.get("name") or "") == target), None)
    if dest and dest is not source:
        merged_ids = list(
            dict.fromkeys(
                [
                    *[str(x).strip() for x in (dest.get("device_ids") or []) if str(x).strip()],
                    *[str(x).strip() for x in (source.get("device_ids") or []) if str(x).strip()],
                ]
            )
        )[:120]
        dest["device_ids"] = merged_ids
        groups = [g for g in groups if g is not source]
    else:
        source["name"] = target

    scoped["device_groups"] = groups
    account.scopes_json = json.dumps(scoped)
    db.commit()
    return {"groups": groups}


def duplicate_device_group(
    db: Session,
    user_id: int,
    group_name: str,
    new_name: str,
) -> dict:
    current = (group_name or "").strip().lower()
    target = (new_name or "").strip().lower()
    if not current or not target:
        return {"groups": list_device_groups(db, user_id).get("groups") or []}
    groups = list_device_groups(db, user_id).get("groups") or []
    source = next((g for g in groups if str(g.get("name") or "") == current), None)
    if source is None:
        return {"groups": groups}
    provider = str(source.get("provider") or "tahoma")
    ids = [str(x).strip() for x in (source.get("device_ids") or []) if str(x).strip()]
    return upsert_device_group(
        db=db,
        user_id=user_id,
        group_name=target,
        provider=provider,
        device_ids=ids,
    )


def execute_device_group_action(
    db: Session,
    user_id: int,
    group_name: str,
    action: str,
) -> dict:
    name = (group_name or "").strip().lower()
    groups = list_device_groups(db, user_id).get("groups") or []
    group = next((g for g in groups if str(g.get("name") or "") == name), None)
    if not group:
        return {
            "group_name": name,
            "provider": "tahoma",
            "action": action,
            "status": "group_not_found",
            "message": "Groupe domotique introuvable.",
        }
    provider = str(group.get("provider") or "tahoma")
    ids = group.get("device_ids") if isinstance(group.get("device_ids"), list) else []
    ok = 0
    for did in ids:
        out = execute_provider_device_action(
            db=db,
            user_id=user_id,
            provider=provider,
            device_id=str(did),
            action=action,
        )
        if str(out.get("status")) == "executed":
            ok += 1
    return {
        "group_name": name,
        "provider": provider,
        "action": action,
        "status": "executed" if ok > 0 else "failed",
        "message": f"Action appliquée sur {ok}/{len(ids)} appareil(s) du groupe « {name} ».",
    }


def get_home_status(db: Session, user_id: int) -> dict:
    account = _load_home_assistant_account(db=db, user_id=user_id)
    creds = _parse_home_assistant_credentials(account)
    if not home_assistant_active_with_creds(creds):
        return _mock_home_status()

    base_url, token = creds
    headers = {"Authorization": f"Bearer {token}"}
    try:
        with httpx.Client(timeout=10) as client:
            states_res = client.get(f"{base_url}/api/states", headers=headers)
            states_res.raise_for_status()
            states = states_res.json()
    except Exception:
        # Fail open to avoid breaking product UX if HA is temporary unavailable.
        return _mock_home_status()

    lights_on = 0
    robot_last_run_hours = 36
    for state in states:
        entity_id = str(state.get("entity_id") or "")
        entity_state = str(state.get("state") or "")
        if entity_id.startswith("light.") and entity_state == "on":
            lights_on += 1
        if entity_id.startswith("vacuum.") and entity_state in {"cleaning", "docked"}:
            robot_last_run_hours = 6 if entity_state == "cleaning" else 18

    return {
        "mode": "home_assistant",
        "lights_on": lights_on,
        "energy_alert": lights_on >= 6,
        "robot_last_run_hours": robot_last_run_hours,
        "recommended_actions": [
            "Eteindre les pieces inactives",
            "Lancer la scene soir depuis l app Maison",
        ],
    }


def _execute_home_assistant_inferred(
    db: Session,
    user_id: int,
    parsed: dict[str, str],
    lowered: str,
) -> dict:
    creds = _parse_home_assistant_credentials(_load_home_assistant_account(db=db, user_id=user_id))
    if not home_assistant_active_with_creds(creds):
        return execute_device_control(
            db=db,
            user_id=user_id,
            provider="home_assistant",
            capability=parsed["capability"],
            action=parsed["action"],
            target=parsed.get("zone") or None,
        )

    listing = _list_home_assistant_devices(db=db, user_id=user_id)
    devices = listing.get("devices") if isinstance(listing.get("devices"), list) else []
    capability_id = parsed["capability"]
    action_id = parsed["action"]
    zone = (parsed.get("zone") or "").strip().lower()

    if not devices:
        return {
            "provider": "home_assistant",
            "capability": capability_id,
            "action": action_id,
            "target": zone or None,
            "status": "no_device_found",
            "message": "Home Assistant est connecté mais aucune entité n’a été chargée.",
        }

    if capability_id == "scene":
        scenes = [d for d in devices if isinstance(d, dict) and str(d.get("device_type") or "") == "scene"]
        picked_scene: dict | None = None
        if zone:
            matches = [s for s in scenes if zone in str(s.get("name") or "").lower()]
            if len(matches) == 1:
                picked_scene = matches[0]
        if picked_scene is None:
            for token in ("soir", "nuit", "matin", "jour", "absent"):
                if token in lowered:
                    matches = [s for s in scenes if token in str(s.get("name") or "").lower()]
                    if len(matches) == 1:
                        picked_scene = matches[0]
                        break
        if picked_scene is None and len(scenes) == 1:
            picked_scene = scenes[0]
        if picked_scene is not None:
            out = execute_provider_device_action(
                db=db,
                user_id=user_id,
                provider="home_assistant",
                device_id=str(picked_scene.get("id") or ""),
                action="on",
            )
            out["message"] = f"Scène « {picked_scene.get('name') or picked_scene.get('id')} » activée."
            return out

    entity_match = re.search(
        r"\b(light|switch|cover|climate|fan|lock|scene)\.[a-z0-9_]+\b",
        lowered,
    )
    if entity_match:
        entity_id = entity_match.group(0)
        out = execute_provider_device_action(
            db=db,
            user_id=user_id,
            provider="home_assistant",
            device_id=entity_id,
            action=action_id,
        )
        out["message"] = f"Commande envoyée à {entity_id} via Home Assistant."
        return out

    request_all = any(k in lowered for k in ("tous", "toutes", "tout ", "all "))
    candidates = _ha_candidates(
        [x for x in devices if isinstance(x, dict)],
        lowered_command=lowered,
        zone_hint=zone,
        capability_id=capability_id,
    )

    mass_confirmed = any(
        phrase in lowered
        for phrase in (
            "confirme toutes les lumieres",
            "confirme toutes les lumières",
            "confirme tous les radiateurs",
            "confirme toutes les prises",
        )
    ) or ("confirme" in lowered and "home assistant" in lowered and request_all)

    if mass_confirmed and candidates:
        ok = 0
        for device in candidates:
            out = execute_provider_device_action(
                db=db,
                user_id=user_id,
                provider="home_assistant",
                device_id=str(device.get("id") or ""),
                action=action_id,
            )
            if str(out.get("status")) == "executed":
                ok += 1
        return {
            "provider": "home_assistant",
            "capability": capability_id,
            "action": action_id,
            "target": zone or None,
            "status": "executed" if ok > 0 else "failed",
            "message": f"Action appliquée sur {ok}/{len(candidates)} entité(s) Home Assistant.",
        }

    if request_all and len(candidates) > 1:
        labels = ", ".join(str(c.get("name") or c.get("id") or "") for c in candidates[:6])
        return {
            "provider": "home_assistant",
            "capability": capability_id,
            "action": action_id,
            "target": zone or None,
            "status": "requires_mass_confirm",
            "message": (
                f"J’ai trouvé {len(candidates)} entités ({labels}). "
                "Confirme : « confirme toutes les lumières » (ou précise une pièce)."
            ),
        }

    if len(candidates) > 1:
        labels = ", ".join(str(c.get("name") or "") for c in candidates[:5])
        return {
            "provider": "home_assistant",
            "capability": capability_id,
            "action": action_id,
            "target": zone or None,
            "status": "ambiguous",
            "message": (
                f"Plusieurs appareils correspondent ({labels}). "
                "Précise la pièce (ex. salon) ou le nom exact de l’entité."
            ),
        }

    if len(candidates) == 1:
        picked = candidates[0]
        out = execute_provider_device_action(
            db=db,
            user_id=user_id,
            provider="home_assistant",
            device_id=str(picked.get("id") or ""),
            action=action_id,
        )
        label = str(picked.get("name") or picked.get("id") or "appareil")
        if str(out.get("status")) == "executed":
            out["message"] = f"Action « {action_id} » sur « {label} » via Home Assistant."
        return out

    return {
        "provider": "home_assistant",
        "capability": capability_id,
        "action": action_id,
        "target": zone or None,
        "status": "no_device_found",
        "message": (
            "Aucune entité Home Assistant trouvée pour cette commande. "
            "Recharge les appareils dans Intégrations ou précise le nom (ex. light.salon)."
        ),
    }


def execute_device_control(
    db: Session,
    user_id: int,
    *,
    provider: str,
    capability: str,
    action: str,
    target: str | None = None,
) -> dict:
    provider_id = (provider or "home_assistant").strip().lower()
    capability_id = (capability or "").strip().lower()
    action_id = (action or "").strip().lower()
    target_id = (target or "").strip()[:80] or None

    if capability_id not in {"lights", "heating", "ventilation", "scene", "opening"}:
        return {
            "provider": provider_id,
            "capability": capability_id,
            "action": action_id,
            "target": target_id,
            "status": "unsupported_capability",
            "message": "Capacité domotique non supportée.",
        }

    if provider_id == "home_assistant":
        account = _load_home_assistant_account(db=db, user_id=user_id)
        creds = _parse_home_assistant_credentials(account)
        if home_assistant_active_with_creds(creds):
            if target_id:
                listing = _list_home_assistant_devices(db=db, user_id=user_id)
                devices = listing.get("devices") if isinstance(listing.get("devices"), list) else []
                candidates = _ha_candidates(
                    [x for x in devices if isinstance(x, dict)],
                    lowered_command=target_id,
                    zone_hint=target_id,
                    capability_id=capability_id,
                )
                if len(candidates) == 1:
                    return execute_provider_device_action(
                        db=db,
                        user_id=user_id,
                        provider="home_assistant",
                        device_id=str(candidates[0].get("id") or ""),
                        action=action_id,
                    )
            parsed = {
                "capability": capability_id,
                "action": action_id,
                "zone": target_id or "",
            }
            return _execute_home_assistant_inferred(
                db=db,
                user_id=user_id,
                parsed=parsed,
                lowered=f"{action_id} {capability_id} {target_id or ''}",
            )
        return {
            "provider": provider_id,
            "capability": capability_id,
            "action": action_id,
            "target": target_id,
            "status": "executed_mock",
            "message": "Action simulée: connecte Home Assistant pour exécution réelle.",
        }

    account = _load_provider_account(db, user_id, provider_id)
    status = "planned_integration" if not account else "connector_pending"
    return {
        "provider": provider_id,
        "capability": capability_id,
        "action": action_id,
        "target": target_id,
        "status": status,
        "message": (
            "Connecteur en préparation. "
            "Ajoute d'abord l'authentification partenaire pour activer les actions réelles."
        ),
    }


def infer_and_execute_device_control(command: str, db: Session, user_id: int) -> dict:
    from app.services.ezviz_control import execute_ezviz_camera_action
    from app.services.home_provider_bridge import home_control_setup_hint, try_home_assistant_bridge
    from app.services.verisure_control import execute_verisure_alarm_action

    ez = execute_ezviz_camera_action(db, user_id, command)
    if ez is not None:
        return ez

    vs = execute_verisure_alarm_action(db, user_id, command)
    if vs is not None:
        return vs

    bridge = try_home_assistant_bridge(db, user_id, command)
    if bridge is not None:
        return bridge

    lowered = (command or "").lower()
    parsed = _parse_home_device_action(command)
    if not parsed:
        return {
            "provider": "home_assistant",
            "capability": "unknown",
            "action": "unknown",
            "target": None,
            "status": "unsupported_command",
            "message": "Commande domotique non reconnue. " + home_control_setup_hint(db, user_id),
        }
    # Priorité TaHoma sur les demandes de volets/stores ou mention explicite.
    if any(k in lowered for k in ("tahoma", "volet", "volets", "store", "stores")):
        m_group = re.search(r"groupe\s+([a-z0-9_-]{2,40})", lowered)
        if m_group:
            group_name = m_group.group(1)
            request_confirm = "confirme" in lowered
            if not request_confirm:
                return {
                    "provider": "tahoma",
                    "capability": parsed["capability"],
                    "action": parsed["action"],
                    "target": group_name,
                    "status": "requires_mass_confirm",
                    "message": f"Confirme pour exécuter sur le groupe « {group_name} » : « confirme groupe {group_name} ».",
                }
            return execute_device_group_action(
                db=db,
                user_id=user_id,
                group_name=group_name,
                action=parsed["action"],
            )
        rows = list_provider_devices(db=db, user_id=user_id, provider="tahoma").get("devices") or []
        if not isinstance(rows, list) or len(rows) == 0:
            return {
                "provider": "tahoma",
                "capability": parsed["capability"],
                "action": parsed["action"],
                "target": parsed.get("zone") or None,
                "status": "no_device_found",
                "message": "Aucun appareil TaHoma trouvé. Charge d'abord les appareils dans Intégrations.",
            }
        query = (parsed.get("zone") or "").strip().lower()
        request_all = any(k in lowered for k in ("tous", "toutes", "tout ", "all "))
        candidates: list[dict] = _tahoma_candidates(
            [x for x in rows if isinstance(x, dict)],
            lowered_command=lowered,
            zone_hint=query,
        )
        if not candidates and rows:
            candidates = [rows[0]] if isinstance(rows[0], dict) else []
        if not candidates:
            return {
                "provider": "tahoma",
                "capability": parsed["capability"],
                "action": parsed["action"],
                "target": parsed.get("zone") or None,
                "status": "no_device_found",
                "message": "Aucun appareil TaHoma compatible trouvé.",
            }
        if "confirme tous les volets" in lowered and len(candidates) > 0:
            ok = 0
            for d in candidates:
                out = execute_provider_device_action(
                    db=db,
                    user_id=user_id,
                    provider="tahoma",
                    device_id=str(d.get("id") or ""),
                    action=parsed["action"],
                )
                if str(out.get("status")) == "executed":
                    ok += 1
            return {
                "provider": "tahoma",
                "capability": parsed["capability"],
                "action": parsed["action"],
                "target": parsed.get("zone") or None,
                "status": "executed",
                "message": f"Action appliquée sur {ok}/{len(candidates)} appareil(s) TaHoma.",
            }
        if request_all and len(candidates) > 1:
            labels = ", ".join(str(c.get("name") or "") for c in candidates[:6])
            return {
                "provider": "tahoma",
                "capability": parsed["capability"],
                "action": parsed["action"],
                "target": parsed.get("zone") or None,
                "status": "requires_mass_confirm",
                "message": (
                    f"J’ai trouvé {len(candidates)} appareils ({labels}). "
                    "Confirme explicitement: « confirme tous les volets » pour action groupée."
                ),
            }
        if request_all and len(candidates) == 1:
            picked = candidates[0]
            return execute_provider_device_action(
                db=db,
                user_id=user_id,
                provider="tahoma",
                device_id=str(picked.get("id") or ""),
                action=parsed["action"],
            )
        picked = candidates[0]
        return execute_provider_device_action(
            db=db,
            user_id=user_id,
            provider="tahoma",
            device_id=str(picked.get("id") or ""),
            action=parsed["action"],
        )

    return _execute_home_assistant_inferred(db=db, user_id=user_id, parsed=parsed, lowered=lowered)


def execute_scene(scene_id: str, db: Session, user_id: int) -> dict:
    account = _load_home_assistant_account(db=db, user_id=user_id)
    creds = _parse_home_assistant_credentials(account)
    if not home_assistant_active_with_creds(creds):
        return {"scene_id": scene_id, "status": "executed_mock"}

    base_url, token = creds
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"entity_id": f"scene.{scene_id}"}
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(f"{base_url}/api/services/scene/turn_on", headers=headers, json=payload)
            response.raise_for_status()
    except Exception:
        return {"scene_id": scene_id, "status": "execution_failed"}
    return {"scene_id": scene_id, "status": "executed"}
