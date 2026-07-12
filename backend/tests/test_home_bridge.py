from unittest.mock import MagicMock, patch

from app.services.home_provider_bridge import (
    command_mentions_provider,
    try_home_assistant_bridge,
)


def test_command_mentions_google_home():
    assert command_mentions_provider("éteins google home salon", "google_home")
    assert not command_mentions_provider("bonjour", "google_home")


@patch("app.services.home_provider_bridge.settings.home_assistant_auto_when_connected", False)
@patch("app.services.home_provider_bridge.settings.home_adapter_mode", "mock")
def test_bridge_skipped_without_ha_mode():
    out = try_home_assistant_bridge(MagicMock(), 1, "éteins google home salon")
    assert out is None


@patch(
    "app.services.home_provider_bridge.execute_provider_device_action",
    return_value={"status": "executed", "message": "ok"},
)
@patch(
    "app.services.home_provider_bridge._ha_candidates",
    return_value=[{"id": "light.salon", "name": "Salon Google"}],
)
@patch(
    "app.services.home_provider_bridge._list_home_assistant_devices",
    return_value={"devices": [{"id": "light.salon", "name": "Salon Google", "device_type": "light"}]},
)
@patch(
    "app.services.home_provider_bridge._parse_home_device_action",
    return_value={"capability": "lights", "action": "off", "zone": "salon"},
)
@patch(
    "app.services.home_provider_bridge._parse_home_assistant_credentials",
    return_value=("http://ha.local", "token"),
)
@patch("app.services.home_provider_bridge._load_home_assistant_account", return_value=MagicMock())
@patch("app.services.home_provider_bridge.home_assistant_active_for_user", return_value=True)
def test_bridge_works_with_auto_ha_when_connected(_active, _load, _creds, _parse, _list, _cand, _exec):
    out = try_home_assistant_bridge(MagicMock(), 1, "éteins la lumière du salon google home")
    assert out is not None
    assert out.get("status") == "executed"
