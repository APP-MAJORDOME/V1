from unittest.mock import MagicMock, patch

from app.services import agent as agent_service
from app.services.home import execute_device_control, get_home_providers


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
