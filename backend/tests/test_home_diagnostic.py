from unittest.mock import MagicMock, patch

from app.services.home import diagnose_home_assistant


@patch("app.services.home._list_home_assistant_devices")
@patch("app.services.home.httpx.Client")
@patch("app.services.home._parse_home_assistant_credentials", return_value=("https://ha.example", "tok"))
@patch("app.services.home._load_home_assistant_account")
@patch("app.services.home.home_assistant_active_with_creds", return_value=True)
@patch("app.services.home.settings.home_assistant_auto_when_connected", True)
def test_diagnose_ha_ok(mock_active, _load, _creds, mock_client_cls, mock_list):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
    mock_list.return_value = {"devices": [{"id": "light.x", "name": "Salon"}]}
    out = diagnose_home_assistant(MagicMock(), 1)
    assert out["status"] == "ok"
    assert out["reachable_from_server"] is True
    assert out["entity_count"] == 1


@patch("app.services.home._parse_home_assistant_credentials", return_value=None)
def test_diagnose_ha_not_configured(_creds):
    out = diagnose_home_assistant(MagicMock(), 1)
    assert out["status"] == "not_connected"
