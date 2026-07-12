from unittest.mock import MagicMock, patch

from app.services.drive_automation import attempt_drive_login, drive_automation_available
from app.services.drive_integration import automate_drive_login
from app.services.verisure_control import execute_verisure_alarm_action, parse_verisure_alarm_action


def test_parse_verisure_alarm_action():
    assert parse_verisure_alarm_action("Arme verisure mode absent") == "arm_away"
    assert parse_verisure_alarm_action("Désarme l'alarme verisure 1234") == "disarm"
    assert parse_verisure_alarm_action("Verisure maison 5678") == "arm_home"
    assert parse_verisure_alarm_action("Bonjour") is None


@patch("app.services.drive_automation.settings.drive_automation_enabled", False)
def test_attempt_drive_login_disabled():
    out = attempt_drive_login("carrefour", "a@b.com", "secret")
    assert out["status"] == "disabled"
    assert out["logged_in"] is False


@patch("app.services.drive_automation.settings.drive_automation_enabled", True)
def test_attempt_drive_login_unsupported_store():
    out = attempt_drive_login("leclerc", "a@b.com", "secret")
    assert out["status"] == "unsupported_store"


@patch("app.services.drive_automation.settings.drive_automation_enabled", True)
@patch("app.services.drive_automation.drive_automation_available", return_value=False)
def test_attempt_drive_login_missing_playwright(_mock_avail):
    out = attempt_drive_login("carrefour", "a@b.com", "secret")
    assert out["status"] == "missing_playwright"


def test_automate_drive_login_needs_credentials():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    out = automate_drive_login(db, user_id=1, service_key="carrefour")
    assert out["status"] == "needs_credentials"


def test_execute_verisure_not_connected():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    out = execute_verisure_alarm_action(db, 1, "Arme verisure 1234")
    assert out is not None
    assert out["status"] == "not_connected"


@patch("app.services.drive_automation.settings.drive_automation_enabled", True)
def test_drive_automation_available_without_playwright():
    # Playwright may or may not be installed in CI — just ensure callable.
    _ = drive_automation_available()
