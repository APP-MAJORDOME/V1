from __future__ import annotations

import json

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ConnectedAccount


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
