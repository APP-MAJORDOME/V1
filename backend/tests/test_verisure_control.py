import json
from unittest.mock import MagicMock, patch

from app.services.verisure_control import execute_verisure_alarm_action


def _account(username="u@test.com", password="enc:v1:pw", pin="enc:v1:1234"):
    acc = MagicMock()
    acc.status = "connected"
    acc.scopes_json = json.dumps({"username": username, "password": password, "pin": pin})
    return acc


@patch("app.services.verisure_control.decrypt_credential_field", side_effect=lambda s: "secret" if "pw" in s else "")
def test_verisure_pin_required_without_code(mock_decrypt):
    db = MagicMock()
    acc = MagicMock()
    acc.status = "connected"
    acc.scopes_json = json.dumps({"username": "u@test.com", "password": "enc:v1:pw"})
    db.query.return_value.filter.return_value.first.return_value = acc
    out = execute_verisure_alarm_action(db, 1, "Arme verisure")
    assert out["status"] == "pin_required"


@patch("app.services.verisure_control.decrypt_credential_field", side_effect=lambda s: "secret" if "pw" in s else "1234")
@patch("verisure.Session")
def test_verisure_arm_away_executed(mock_session_cls, mock_decrypt):
    session = MagicMock()
    mock_session_cls.return_value = session
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = _account()
    out = execute_verisure_alarm_action(db, 1, "Arme verisure mode absent")
    assert out["status"] == "executed"
    session.login.assert_called_once()
    session.arm_away.assert_called_once_with("1234")
