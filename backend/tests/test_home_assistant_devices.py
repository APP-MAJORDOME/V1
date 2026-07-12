from unittest.mock import MagicMock, patch

from app.services.home import _list_home_assistant_devices, list_provider_devices


@patch("app.services.home._parse_home_assistant_credentials", return_value=("http://ha.local:8123", "token"))
@patch("app.services.home._load_home_assistant_account")
def test_list_home_assistant_devices_from_states(_account, _creds):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = [
        {
            "entity_id": "light.salon",
            "state": "on",
            "attributes": {"friendly_name": "Salon"},
        },
        {
            "entity_id": "sensor.temp",
            "state": "20",
            "attributes": {"friendly_name": "Temp"},
        },
    ]
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_response

    with patch("app.services.home.httpx.Client", return_value=mock_client):
        out = _list_home_assistant_devices(MagicMock(), user_id=1)

    assert out["provider"] == "home_assistant"
    assert len(out["devices"]) == 1
    assert out["devices"][0]["id"] == "light.salon"


def test_ha_candidates_match_zone():
    from app.services.home import _ha_candidates

    devices = [
        {"id": "light.salon", "name": "Salon plafond", "device_type": "light"},
        {"id": "light.cuisine", "name": "Cuisine", "device_type": "light"},
    ]
    out = _ha_candidates(
        devices,
        lowered_command="eteins les lumieres du salon",
        zone_hint="salon",
        capability_id="lights",
    )
    assert len(out) == 1
    assert out[0]["id"] == "light.salon"


@patch("app.services.home.execute_provider_device_action")
@patch("app.services.home._list_home_assistant_devices")
@patch("app.services.home._parse_home_assistant_credentials", return_value=("http://ha", "tok"))
@patch("app.services.home._load_home_assistant_account")
@patch("app.services.home.settings")
def test_infer_ha_single_light(mock_settings, _acc, _creds, mock_list, mock_exec):
    mock_settings.home_adapter_mode = "home_assistant"
    mock_list.return_value = {
        "devices": [{"id": "light.salon", "name": "Salon", "device_type": "light"}],
    }
    mock_exec.return_value = {"status": "executed", "message": "ok"}
    from app.services.home import infer_and_execute_device_control

    out = infer_and_execute_device_control("Eteins la lumière du salon", MagicMock(), user_id=1)
    assert out["status"] == "executed"
    mock_exec.assert_called_once()


@patch("app.services.home._list_home_assistant_devices")
def test_list_provider_devices_routes_ha(mock_list):
    mock_list.return_value = {"provider": "home_assistant", "devices": []}
    out = list_provider_devices(MagicMock(), user_id=1, provider="home_assistant")
    assert out["provider"] == "home_assistant"
    mock_list.assert_called_once()
