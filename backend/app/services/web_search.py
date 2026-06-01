"""Recherche web pour Alfred (DuckDuckGo, sans clé API obligatoire)."""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import unquote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_WEB_PREFIX = "recherche web:"

_WEB_TRIGGERS = (
    "sur internet",
    "sur le web",
    "sur le net",
    "en ligne",
    "duckduckgo",
    "google ",
    "recherche web",
    "cherche sur",
    "trouve sur",
    "regarde sur",
    "météo",
    "meteo",
    "actualité",
    "actualite",
    "c'est quoi",
    "c est quoi",
    "qu'est-ce que",
    "quest ce que",
    "qui est ",
    "combien coûte",
    "combien coute",
    "prix de",
    "horaires de",
    "adresse de",
    "http://",
    "https://",
)

_APP_ACTION_BLOCK = (
    "ajoute",
    "rajoute",
    "crée",
    "cree",
    "assigne",
    "termine",
    "liste de courses",
    "agenda",
    "nouvelle tâche",
    "nouvelle tache",
    "souviens-toi",
    "note que",
)


def command_wants_web_search(command: str) -> bool:
    if not settings.web_search_enabled:
        return False
    raw = (command or "").strip()
    if not raw:
        return False
    lowered = raw.lower()
    if lowered.startswith(_WEB_PREFIX):
        return True
    if any(b in lowered for b in _APP_ACTION_BLOCK):
        return False
    return any(t in lowered for t in _WEB_TRIGGERS)


def normalize_search_query(command: str) -> str:
    text = (command or "").strip()
    if text.lower().startswith(_WEB_PREFIX):
        text = text[len(_WEB_PREFIX) :].strip()
    for prefix in (
        r"^(?:cherche|recherche|trouve|regarde)(?:\s+moi)?(?:\s+sur)?(?:\s+internet|\s+le\s+web|\s+en\s+ligne)\s*:?\s*",
        r"^(?:sur\s+internet|sur\s+le\s+web)\s*:?\s*",
        r"^(?:peux-tu|peux tu|tu peux)\s+(?:chercher|rechercher|trouver)\s+",
    ):
        text = re.sub(prefix, "", text, flags=re.IGNORECASE).strip()
    return text[:240] or command.strip()[:240]


def _search_via_ddgs(query: str, max_results: int) -> list[dict[str, str]]:
    try:
        from duckduckgo_search import DDGS  # type: ignore[import-untyped]
    except ImportError:
        return []
    rows: list[dict[str, str]] = []
    try:
        with DDGS() as ddgs:
            for item in ddgs.text(query, max_results=max_results):
                if not isinstance(item, dict):
                    continue
                url = str(item.get("href") or item.get("link") or "").strip()
                title = str(item.get("title") or "").strip()
                snippet = str(item.get("body") or item.get("snippet") or "").strip()
                if url and title:
                    rows.append({"title": title[:200], "snippet": snippet[:500], "url": url[:500]})
    except Exception as exc:
        logger.warning("DDGS search failed: %s", exc)
    return rows


def _search_via_html(query: str, max_results: int) -> list[dict[str, str]]:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; MajorDome/1.0; +https://majordom.eu)",
        "Accept-Language": "fr-FR,fr;q=0.9",
    }
    try:
        with httpx.Client(timeout=14, follow_redirects=True) as client:
            response = client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
                headers=headers,
            )
            response.raise_for_status()
            html = response.text
    except Exception as exc:
        logger.warning("DuckDuckGo HTML search failed: %s", exc)
        return []

    rows: list[dict[str, str]] = []
    for match in re.finditer(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
        html,
        flags=re.IGNORECASE,
    ):
        href, title = match.group(1), unquote(re.sub(r"<[^>]+>", "", match.group(2))).strip()
        if "uddg=" in href:
            uddg = re.search(r"uddg=([^&]+)", href)
            if uddg:
                href = unquote(uddg.group(1))
        if not href.startswith("http"):
            continue
        rows.append({"title": title[:200], "snippet": "", "url": href[:500]})
        if len(rows) >= max_results:
            break

    snippets = re.findall(r'class="result__snippet"[^>]*>([^<]+)', html, flags=re.IGNORECASE)
    for i, snip in enumerate(snippets):
        if i >= len(rows):
            break
        clean = re.sub(r"<[^>]+>", "", snip).strip()
        if clean:
            rows[i]["snippet"] = clean[:500]
    return rows


def fetch_search_results(query: str, max_results: int | None = None) -> list[dict[str, str]]:
    limit = max_results if max_results is not None else settings.web_search_max_results
    limit = max(1, min(limit, 8))
    q = normalize_search_query(query)
    if not q:
        return []
    rows = _search_via_ddgs(q, limit)
    if not rows:
        rows = _search_via_html(q, limit)
    return rows


def fallback_web_answer(query: str, sources: list[dict[str, str]]) -> str:
    if not sources:
        return (
            f"Je n’ai pas trouvé de résultat web clair pour « {query} ». "
            "Reformule ta question ou précise le sujet."
        )
    lines = [f"Voici ce que j’ai trouvé sur le web pour « {query} » :\n"]
    for src in sources[:5]:
        title = src.get("title") or "Lien"
        snippet = (src.get("snippet") or "").strip()
        url = src.get("url") or ""
        block = f"• {title}"
        if snippet:
            block += f"\n  {snippet[:220]}"
        if url:
            block += f"\n  {url}"
        lines.append(block)
    return "\n\n".join(lines)


def build_web_lookup_response(
    command: str,
    memory_lines: list[str] | None,
    *,
    synthesize: Any | None = None,
) -> dict[str, Any]:
    from app.services.llm import synthesize_web_answer

    query = normalize_search_query(command)
    sources = fetch_search_results(query)
    synth_fn = synthesize if synthesize is not None else synthesize_web_answer
    explanation = synth_fn(query, sources, memory_lines) if synth_fn else None
    if not explanation or not str(explanation).strip():
        explanation = fallback_web_answer(query, sources)
    return {
        "intent": "web_search",
        "mode": "auto",
        "proposal": {"query": query, "sources": sources},
        "explanation": str(explanation).strip()[:4000],
    }
