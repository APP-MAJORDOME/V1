import json
from unittest.mock import MagicMock, patch

from app.services import agent as agent_service
from app.services.home import (
    delete_device_group,
    execute_device_control,
    get_home_providers,
    duplicate_device_group,
    rename_device_group,
    update_device_group_members,
    upsert_device_group,
)


def test_interpret_command_home_control():
    out = agent_service.interpret_command("Allume les lumières du salon")
    assert out["intent"] == "home_control"
    assert out["mode"] == "confirm"


def test_get_home_providers_lists_core_connectors():
    db = MagicMock()
    # Aucun compte connecté -> not_connected.
    db.query.return_value.filter.return_value.first.return_value = None
    out = get_home_providers(db, user_id=1)
    ids = {p["id"] for p in out["providers"]}
    assert "home_assistant" in ids
    assert "google_home" in ids
    assert "legrand_control" in ids
    assert "tahoma" in ids


@patch("app.services.home._load_home_assistant_account", return_value=None)
def test_execute_device_control_home_assistant_mock(_account):
    db = MagicMock()
    out = execute_device_control(
        db,
        user_id=1,
        provider="home_assistant",
        capability="lights",
        action="off",
        target="salon",
    )
    assert out["status"] in {"executed_mock", "executed"}
    assert "Action" in out["message"]


def _mock_tahoma_account(scopes: dict) -> MagicMock:
    account = MagicMock()
    account.scopes_json = json.dumps(scopes)
    return account


@patch("app.services.home._load_provider_account")
def test_upsert_and_delete_device_group(mock_load):
    db = MagicMock()
    account = _mock_tahoma_account({"device_groups": []})
    mock_load.return_value = account

    out = upsert_device_group(
        db,
        user_id=1,
        group_name="nuit",
        provider="tahoma",
        device_ids=["dev-1", "dev-2"],
    )
    assert any(g["name"] == "nuit" for g in out["groups"])
    assert db.commit.called

    out_del = delete_device_group(db, user_id=1, group_name="nuit")
    assert not any(g["name"] == "nuit" for g in out_del["groups"])


@patch("app.services.home._load_provider_account")
def test_update_device_group_members_add_remove(mock_load):
    db = MagicMock()
    account = _mock_tahoma_account(
        {"device_groups": [{"name": "matin", "provider": "tahoma", "device_ids": ["dev-1"]}]}
    )
    mock_load.return_value = account

    out_add = update_device_group_members(
        db,
        user_id=1,
        group_name="matin",
        operation="add",
        provider="tahoma",
        device_ids=["dev-2"],
    )
    matin = next(g for g in out_add["groups"] if g["name"] == "matin")
    assert "dev-1" in matin["device_ids"]
    assert "dev-2" in matin["device_ids"]

    out_remove = update_device_group_members(
        db,
        user_id=1,
        group_name="matin",
        operation="remove",
        provider="tahoma",
        device_ids=["dev-1"],
    )
    matin2 = next(g for g in out_remove["groups"] if g["name"] == "matin")
    assert matin2["device_ids"] == ["dev-2"]


@patch("app.services.home._load_provider_account")
def test_rename_device_group(mock_load):
    db = MagicMock()
    account = _mock_tahoma_account(
        {"device_groups": [{"name": "rdc", "provider": "tahoma", "device_ids": ["dev-a"]}]}
    )
    mock_load.return_value = account

    out = rename_device_group(db, user_id=1, group_name="rdc", new_name="rez")
    assert any(g["name"] == "rez" for g in out["groups"])
    assert not any(g["name"] == "rdc" for g in out["groups"])


@patch("app.services.home._load_provider_account")
def test_duplicate_device_group(mock_load):
    db = MagicMock()
    account = _mock_tahoma_account(
        {"device_groups": [{"name": "nuit", "provider": "tahoma", "device_ids": ["dev-1", "dev-2"]}]}
    )
    mock_load.return_value = account

    out = duplicate_device_group(db, user_id=1, group_name="nuit", new_name="nuit-ete")
    assert any(g["name"] == "nuit" for g in out["groups"])
    copie = next(g for g in out["groups"] if g["name"] == "nuit-ete")
    assert copie["device_ids"] == ["dev-1", "dev-2"]
