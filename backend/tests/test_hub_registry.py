from unittest.mock import MagicMock, patch

from app.services.hub_registry import build_hub_overview, _HUB_CATALOG


def test_hub_catalog_not_empty():
    assert len(_HUB_CATALOG) >= 15


@patch("app.services.hub_registry.list_drive_status", return_value={"stores": [], "automation": "manual_open"})
@patch("app.services.hub_registry.list_user_vault_secrets", return_value={"secrets": [], "encryption_at_rest": False})
@patch("app.services.hub_registry.get_home_providers", return_value={"providers": []})
def test_build_hub_overview_structure(_home, _vault, _drive):
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    out = build_hub_overview(db, user_id=1)
    assert "summary" in out
    assert "connectors" in out
    assert len(out["connectors"]) == len(_HUB_CATALOG)
    assert out["summary"]["total_catalog"] == len(_HUB_CATALOG)


@patch("app.services.hub_registry.list_drive_status")
@patch("app.services.hub_registry.list_user_vault_secrets")
@patch("app.services.hub_registry.get_home_providers")
def test_drive_carrefour_connected_when_vault_ready(_home, mock_vault, mock_drive):
    mock_vault.return_value = {
        "secrets": [{"service_key": "carrefour", "has_password": True}],
        "encryption_at_rest": True,
    }
    mock_drive.return_value = {
        "stores": [
            {
                "store": "Carrefour",
                "service_key": "carrefour",
                "drive_status": "credentials_ready",
                "open_url": "https://www.carrefour.fr/drive",
            }
        ],
        "automation": "manual_open",
    }
    _home.return_value = {"providers": []}
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    out = build_hub_overview(db, user_id=2)
    carrefour = next(c for c in out["connectors"] if c["id"] == "drive_carrefour")
    assert carrefour["connected"] is True
