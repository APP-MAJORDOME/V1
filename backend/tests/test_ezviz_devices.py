import json
from unittest.mock import MagicMock, patch

from app.services.home import _list_ezviz_devices, list_provider_devices


def _mock_ezviz_account(username: str = "u@ex.com", password_enc: str = "enc") -> MagicMock:
    account = MagicMock()
    account.scopes_json = json.dumps({"username": username, "password": password_enc})
    return account


@patch("app.services.home.decrypt_credential_field", return_value="secret")
@patch("app.services.home._load_provider_account")
def test_list_ezviz_devices_empty_when_not_connected(mock_load, _decrypt):
    db = MagicMock()
    mock_load.return_value = None
    out = _list_ezviz_devices(db, user_id=1)
    assert out["provider"] == "ezviz"
    assert out["devices"] == []


@patch("pyezviz.EzvizClient")
@patch("app.services.home.decrypt_credential_field", return_value="secret")
@patch("app.services.home._load_provider_account")
def test_list_ezviz_devices_maps_cameras(mock_load, _decrypt, mock_client_cls):
    db = MagicMock()
    mock_load.return_value = _mock_ezviz_account()
    client = MagicMock()
    client.load_cameras.return_value = {
        "ABC123": {"name": "Salon", "device_category": "Camera", "status": 1},
    }
    mock_client_cls.return_value = client

    out = _list_ezviz_devices(db, user_id=1)

    assert len(out["devices"]) == 1
    assert out["devices"][0]["id"] == "ABC123"
    assert out["devices"][0]["name"] == "Salon"


@patch("app.services.home._list_ezviz_devices")
def test_list_provider_devices_delegates_ezviz(mock_list):
    db = MagicMock()
    mock_list.return_value = {"provider": "ezviz", "devices": [{"id": "X"}]}
    out = list_provider_devices(db, user_id=2, provider="ezviz")
    assert out["devices"][0]["id"] == "X"
    mock_list.assert_called_once_with(db=db, user_id=2)
