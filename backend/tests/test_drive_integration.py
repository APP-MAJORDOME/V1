from unittest.mock import MagicMock, patch

from app.services.drive_integration import (
    command_wants_drive_prepare,
    enrich_vault_links,
    prepare_drive_session,
)
from app.services.agent_executor import interpret_for_act


def test_command_wants_drive_prepare():
    assert command_wants_drive_prepare("Ouvre le drive Carrefour")
    assert not command_wants_drive_prepare("Recette pas chère au supermarché")


def test_command_drive_not_when_recipe_only_with_drive_word():
    assert not command_wants_drive_prepare("Promos carrefour drive et recette économique")


def test_enrich_vault_links_adds_open_url():
    links = enrich_vault_links(
        [
            {
                "store": "Carrefour",
                "service_key": "carrefour",
                "drive_status": "credentials_ready",
                "login_url": None,
            }
        ]
    )
    assert links[0]["open_url"] == "https://www.carrefour.fr/drive"
    assert links[0]["drive_action"] == "open_manual"


@patch("app.services.drive_integration.attempt_drive_login")
@patch("app.services.drive_integration.vault_secret_plain_password", return_value="pw")
def test_prepare_drive_session_ready(mock_pw, mock_auto):
    mock_auto.return_value = {
        "status": "disabled",
        "automation": "manual_open",
        "logged_in": False,
        "message": "auto off",
    }
    row = MagicMock()
    row.id = 7
    row.label = "Mon Drive"
    row.username = "a@b.com"
    row.password_blob = "enc"
    row.login_url = None
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = row
    prep = prepare_drive_session(db, user_id=1, service_key="carrefour")
    assert prep["status"] == "ready"
    assert prep["open_url"] == "https://www.carrefour.fr/drive"
    assert prep["secret_id"] == 7
    assert prep["logged_in"] is False


def test_list_grocery_cart_items():
    row = MagicMock()
    row.id = 3
    row.label = "Lait"
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
        row
    ]
    from app.services.drive_integration import list_grocery_cart_items

    items = list_grocery_cart_items(db, household_id=9)
    assert len(items) == 1
    assert items[0]["label"] == "Lait"


def test_prepare_drive_session_includes_cart():
    row = MagicMock()
    row.id = 7
    row.label = "Mon Drive"
    row.username = "a@b.com"
    row.password_blob = "enc"
    row.login_url = None
    g = MagicMock()
    g.id = 1
    g.label = "Pain"
    db = MagicMock()
    secret_q = db.query.return_value.filter.return_value.order_by.return_value
    secret_q.first.return_value = row
    grocery_q = db.query.return_value.filter.return_value.order_by.return_value.limit.return_value
    grocery_q.all.return_value = [g]
    prep = prepare_drive_session(db, user_id=1, service_key="carrefour", household_id=5)
    assert prep["cart_count"] == 1
    assert "Pain" in prep["cart_text"]


def test_command_wants_drive_with_grocery_list():
    assert command_wants_drive_prepare("Passe ma liste de courses sur le drive carrefour")


def test_prepare_drive_session_needs_credentials():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    prep = prepare_drive_session(db, user_id=1, service_key="carrefour")
    assert prep["status"] == "needs_credentials"


@patch("app.services.drive_integration.settings.shopping_advisor_enabled", True)
def test_interpret_for_act_drive():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    out = interpret_for_act("Ouvre carrefour drive", db, household_id=1, user_id=2, memory_lines=[])
    assert out["intent"] == "drive_prepare"
