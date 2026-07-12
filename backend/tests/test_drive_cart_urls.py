from app.services.drive_cart_urls import build_cart_search_urls


def test_build_cart_search_urls_carrefour():
    links = build_cart_search_urls(
        "carrefour",
        [{"id": 1, "label": "Lait demi-écrémé (1 L)"}, {"id": 2, "label": "Pain"}],
    )
    assert len(links) == 2
    assert "carrefour.fr" in links[0]["search_url"]
    assert "Lait" in links[0]["search_url"] or "lait" in links[0]["search_url"].lower()


def test_strips_qty_parentheses():
    links = build_cart_search_urls("carrefour", [{"id": 3, "label": "Tomates (500 g)"}])
    assert links[0]["label"] == "Tomates"
