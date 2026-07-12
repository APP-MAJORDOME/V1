"""Liens de recherche Drive par article (sans API enseigne — ouverture ciblée sur le site)."""

from __future__ import annotations

import re
import unicodedata
from typing import Any
from urllib.parse import quote_plus

_STORE_SEARCH_TEMPLATES: dict[str, str] = {
    "carrefour": "https://www.carrefour.fr/s?q={q}",
    "marche_u": "https://www.coursesu.com/recherche?q={q}",
    "leclerc": "https://www.e.leclerc/recherche?term={q}",
    "auchan": "https://www.auchan.fr/recherche?text={q}",
    "intermarche": "https://www.intermarche.com/recherche/{q}",
}


def _normalize_query(label: str) -> str:
    raw = (label or "").strip()
    raw = re.sub(r"\s*\([^)]*\)\s*", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw[:80]


def build_cart_search_urls(service_key: str, cart_items: list[dict]) -> list[dict[str, Any]]:
    sk = (service_key or "carrefour").strip().lower()
    template = _STORE_SEARCH_TEMPLATES.get(sk)
    if not template:
        return []
    out: list[dict[str, Any]] = []
    for item in cart_items:
        if not isinstance(item, dict):
            continue
        label = _normalize_query(str(item.get("label") or ""))
        if not label or len(label) < 2:
            continue
        q = quote_plus(label)
        out.append(
            {
                "id": item.get("id"),
                "label": label,
                "search_url": template.format(q=q),
            }
        )
        if len(out) >= 25:
            break
    return out
