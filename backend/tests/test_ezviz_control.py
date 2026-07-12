from unittest.mock import MagicMock, patch

from app.services.ezviz_control import execute_ezviz_camera_action, parse_ezviz_camera_action


def test_parse_ezviz_camera_action_none_without_keywords():
    assert parse_ezviz_camera_action("Allume la lumière du salon") is None


def test_parse_ezviz_camera_action_privacy_on():
    assert parse_ezviz_camera_action("Active la confidentialité caméra salon") == (
        "privacy_on",
        "salon",
    )


def test_parse_ezviz_camera_action_veille():
    parsed = parse_ezviz_camera_action("Mets la caméra du garage en veille")
    assert parsed is not None
    assert parsed[0] == "off"
    assert parsed[1] == "garage"


@patch("app.services.home.execute_provider_device_action")
@patch("app.services.ezviz_control.list_provider_devices")
@patch("app.services.ezviz_control._ezviz_credentials_from_scoped", return_value=("u@x.com", "pw"))
@patch("app.services.ezviz_control._load_provider_account")
def test_execute_ezviz_camera_action_runs_device(mock_load, _creds, mock_list, mock_exec):
    mock_load.return_value = MagicMock(scopes_json='{"username":"u"}')
    mock_list.return_value = {
        "devices": [{"id": "SER1", "name": "Salon"}],
    }
    mock_exec.return_value = {
        "status": "executed",
        "message": "Commande Ezviz envoyée.",
    }
    db = MagicMock()
    out = execute_ezviz_camera_action(db, user_id=1, command="Réveille la caméra salon")
    assert out is not None
    assert out["status"] == "executed"
    mock_exec.assert_called_once()
    assert mock_exec.call_args.kwargs["device_id"] == "SER1"
    assert mock_exec.call_args.kwargs["action"] == "on"
