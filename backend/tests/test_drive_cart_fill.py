from unittest.mock import patch

from app.services.drive_automation import attempt_drive_cart_fill


@patch("app.services.drive_automation.settings.drive_automation_enabled", False)
def test_cart_fill_disabled():
    out = attempt_drive_cart_fill("carrefour", "a@b.com", "pw", [{"label": "Lait"}])
    assert out["status"] == "login_required" or out["status"] == "disabled"


@patch("app.services.drive_automation.settings.drive_automation_enabled", True)
@patch("app.services.drive_automation.attempt_drive_login")
def test_cart_fill_login_fail(mock_login):
    mock_login.return_value = {"logged_in": False, "message": "fail"}
    out = attempt_drive_cart_fill("carrefour", "a@b.com", "pw", [{"label": "Pain"}])
    assert out["status"] == "login_required"


def test_cart_fill_empty():
    with patch("app.services.drive_automation.settings.drive_automation_enabled", True):
        out = attempt_drive_cart_fill("carrefour", "a@b.com", "pw", [])
    assert out["status"] == "empty_cart"
