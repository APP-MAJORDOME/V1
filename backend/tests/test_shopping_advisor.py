"""Tests conseiller courses / promos Alfred."""

from unittest.mock import MagicMock, patch

from app.services.shopping_advisor import (
    build_shopping_plan_response,
    command_wants_shopping_plan,
)


def test_command_wants_shopping_plan_triggers():
    assert command_wants_shopping_plan("Quelles promos chez Carrefour cette semaine ?")
    assert command_wants_shopping_plan("Propose une recette économique avec les promos Marché U")
    assert command_wants_shopping_plan("Idée repas pas cher selon mon humeur")
    assert not command_wants_shopping_plan("Ajoute du lait à la liste de courses")
    assert not command_wants_shopping_plan("ok")


@patch("app.services.shopping_advisor.compose_shopping_plan", return_value=None)
@patch("app.services.shopping_advisor.fetch_search_results", return_value=[])
def test_build_shopping_plan_fallback(mock_fetch, mock_compose):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    db.query.return_value.filter.return_value.count.return_value = 0
    out = build_shopping_plan_response(
        "Recette économique Carrefour pour ce soir",
        db,
        household_id=1,
        memory_lines=[],
    )
    assert out["intent"] == "shopping_plan"
    assert out["mode"] == "confirm"
    plan = out["proposal"]["shopping_plan"]
    assert plan["recipe_title"]
    assert len(plan["ingredients"]) >= 3
    assert plan["total_eur"] > 0


@patch("app.services.shopping_advisor.compose_shopping_plan")
@patch("app.services.shopping_advisor.fetch_search_results", return_value=[])
def test_build_shopping_plan_llm(mock_fetch, mock_compose):
    mock_compose.return_value = {
        "recipe_title": "Curry doux",
        "servings": 4,
        "mood_note": "Réconfortant",
        "ingredients": [
            {"label": "Poulet", "qty": "600g", "price_eur": 5.5, "on_promo": True, "store_hint": "Carrefour"},
            {"label": "Lait de coco", "qty": "400ml", "price_eur": 1.2, "on_promo": False, "store_hint": "Carrefour"},
        ],
        "total_eur": 6.7,
        "promo_tips": ["Poulet en promo"],
        "message": "Un curry léger et économique.",
    }
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    db.query.return_value.filter.return_value.count.return_value = 0
    out = build_shopping_plan_response("Menu Carrefour promo", db, 1, [])
    assert out["intent"] == "shopping_plan"
    assert out["proposal"]["shopping_plan"]["recipe_title"] == "Curry doux"
    assert out["proposal"]["shopping_plan"]["total_eur"] == 6.7
