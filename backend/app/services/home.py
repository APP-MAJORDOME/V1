from __future__ import annotations

import json
import re

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ConnectedAccount

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
    if "lumi" in lowered:
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

    if any(x in lowered for x in ("eteins", "éteins", "off", "arrete", "arrête")):
        action = "off"
    elif any(x in lowered for x in ("allume", "on", "active", "demarre", "démarre")):
        action = "on"
    elif any(x in lowered for x in ("baisse", "dim", "reduis", "réduis")):
        action = "down"
    elif any(x in lowered for x in ("augmente", "monte", "boost")):
        action = "up"
    else:
        action = "toggle"

    zone = ""
    match = re.search(r"(salon|cuisine|chambre|bureau|entree|entrée|sdb|garage)", lowered)
    if match:
        zone = match.group(1)
    return {"capability": capability, "action": action, "zone": zone}


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
        scoped["password"] = password.strip()
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
        password = str(scoped.get("password") or "").strip()
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

    return {
        "provider": provider_id,
        "status": "pending_api",
        "message": "Connecteur enregistré. Test API native à implémenter avec OAuth partenaire.",
    }


def _tahoma_login_context(scoped: dict[str, str]):
    username = str(scoped.get("username") or "").strip()
    password = str(scoped.get("password") or "").strip()
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


def list_provider_devices(db: Session, user_id: int, provider: str) -> dict:
    provider_id = (provider or "").strip().lower()
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


def get_home_status(db: Session, user_id: int) -> dict:
    account = _load_home_assistant_account(db=db, user_id=user_id)
    creds = _parse_home_assistant_credentials(account)
    if settings.home_adapter_mode != "home_assistant" or creds is None:
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
        if settings.home_adapter_mode == "home_assistant" and creds is not None:
            base_url, token = creds
            headers = {"Authorization": f"Bearer {token}"}
            if capability_id == "scene":
                scene = (target_id or "soir").replace(" ", "_")
                payload = {"entity_id": f"scene.{scene}"}
                endpoint = "scene/turn_on"
            else:
                domain = "light" if capability_id == "lights" else ("climate" if capability_id == "heating" else "fan")
                verb = "turn_on" if action_id in {"on", "up"} else "turn_off"
                payload = {"entity_id": "all"}
                endpoint = f"{domain}/{verb}"
            try:
                with httpx.Client(timeout=10) as client:
                    response = client.post(
                        f"{base_url}/api/services/{endpoint}",
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                return {
                    "provider": provider_id,
                    "capability": capability_id,
                    "action": action_id,
                    "target": target_id,
                    "status": "executed",
                    "message": "Action domotique exécutée via Home Assistant.",
                }
            except Exception:
                pass
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
    lowered = (command or "").lower()
    parsed = _parse_home_device_action(command)
    if not parsed:
        return {
            "provider": "home_assistant",
            "capability": "unknown",
            "action": "unknown",
            "target": None,
            "status": "unsupported_command",
            "message": "Commande domotique non reconnue.",
        }
    # Priorité TaHoma sur les demandes de volets/stores ou mention explicite.
    if any(k in lowered for k in ("tahoma", "volet", "volets", "store", "stores")):
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
        picked = None
        if query:
            for d in rows:
                if not isinstance(d, dict):
                    continue
                name = str(d.get("name") or "").strip().lower()
                if query and query in name:
                    picked = d
                    break
        if picked is None:
            picked = rows[0] if isinstance(rows[0], dict) else None
        if not picked:
            return {
                "provider": "tahoma",
                "capability": parsed["capability"],
                "action": parsed["action"],
                "target": parsed.get("zone") or None,
                "status": "no_device_found",
                "message": "Aucun appareil TaHoma compatible trouvé.",
            }
        return execute_provider_device_action(
            db=db,
            user_id=user_id,
            provider="tahoma",
            device_id=str(picked.get("id") or ""),
            action=parsed["action"],
        )

    return execute_device_control(
        db=db,
        user_id=user_id,
        provider="home_assistant",
        capability=parsed["capability"],
        action=parsed["action"],
        target=parsed["zone"] or None,
    )


def execute_scene(scene_id: str, db: Session, user_id: int) -> dict:
    account = _load_home_assistant_account(db=db, user_id=user_id)
    creds = _parse_home_assistant_credentials(account)
    if settings.home_adapter_mode != "home_assistant" or creds is None:
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
