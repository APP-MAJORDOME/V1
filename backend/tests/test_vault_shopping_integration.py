from unittest.mock import MagicMock, patch

from app.services.shopping_advisor import build_shopping_plan_response
from app.services.user_secrets_vault import (
    credential_hints_for_stores,
    decrypt_credential_field,
    encrypt_credential_field,
)


def test_encrypt_credential_field_roundtrip():
    plain = "secret-tahoma"
    stored = encrypt_credential_field(plain)
    assert stored.startswith("enc:v1:")
    assert decrypt_credential_field(stored) == plain
    assert decrypt_credential_field(plain) == plain


def test_credential_hints_for_stores_match():
    hints = [
        {
            "service_key": "carrefour",
            "label": "Carrefour perso",
            "username": "a@b.com",
            "has_password": True,
            "login_url": "https://www.carrefour.fr",
        }
    ]
    links = credential_hints_for_stores(hints, ["Carrefour"])
    assert len(links) == 1
    assert links[0]["drive_status"] == "credentials_ready"


@patch("app.services.shopping_advisor.compose_shopping_plan", return_value=None)
@patch("app.services.shopping_advisor.fetch_search_results", return_value=[])
@patch("app.services.shopping_advisor.list_credential_hints")
def test_shopping_plan_includes_vault_links(mock_hints, _fetch, _llm):
    mock_hints.return_value = [
        {
            "service_key": "carrefour",
            "label": "Mon Drive",
            "username": "user@test.fr",
            "has_password": True,
            "login_url": None,
        }
    ]
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    out = build_shopping_plan_response(
        "Promos Carrefour et recette pas chère",
        db,
        household_id=1,
        memory_lines=[],
        user_id=42,
    )
    plan = out["proposal"]["shopping_plan"]
    assert plan.get("vault_links")
    assert plan["vault_links"][0]["store"] == "Carrefour"
