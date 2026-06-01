from unittest.mock import patch

from app.services import agent as agent_service
from app.services.web_search import (
    build_web_lookup_response,
    command_wants_web_search,
    fetch_search_results,
    normalize_search_query,
)


def test_command_wants_web_search_triggers():
    assert command_wants_web_search("Quelle est la météo à Paris demain ?")
    assert command_wants_web_search("recherche web: horaires bibliothèque Lyon")
    assert not command_wants_web_search("Ajoute du lait à la liste de courses")


def test_normalize_search_query_strips_prefix():
    assert normalize_search_query("recherche web: prix du gazole") == "prix du gazole"
    assert "météo" in normalize_search_query("cherche sur internet la météo à Lille")


@patch("app.services.web_search.fetch_search_results")
@patch("app.services.llm.synthesize_web_answer", return_value="Il fait beau demain.")
def test_build_web_lookup_response(mock_synth, mock_fetch):
    mock_fetch.return_value = [
        {"title": "Météo Lille", "snippet": "Ensoleillé", "url": "https://example.com/meteo"},
    ]
    out = build_web_lookup_response("météo Lille", None)
    assert out["intent"] == "web_search"
    assert out["mode"] == "auto"
    assert "beau" in out["explanation"]
    assert out["proposal"]["query"]
    assert len(out["proposal"]["sources"]) == 1


@patch("app.services.agent.interpret_with_openai", return_value=None)
@patch("app.services.agent.interpret_with_anthropic", return_value=None)
@patch("app.services.agent.build_web_lookup_response")
def test_interpret_command_web_short_circuit(mock_build, _a, _o):
    mock_build.return_value = {
        "intent": "web_search",
        "mode": "auto",
        "proposal": {"query": "test"},
        "explanation": "ok",
    }
    result = agent_service.interpret_command("cherche sur internet les horaires du musée")
    mock_build.assert_called_once()
    assert result["intent"] == "web_search"


@patch("app.services.web_search._search_via_ddgs", return_value=[])
@patch("app.services.web_search._search_via_html")
def test_fetch_search_results_html_fallback(mock_html, _ddgs):
    mock_html.return_value = [{"title": "A", "snippet": "B", "url": "https://a.test"}]
    rows = fetch_search_results("test query", max_results=3)
    assert len(rows) == 1
    assert rows[0]["url"] == "https://a.test"
