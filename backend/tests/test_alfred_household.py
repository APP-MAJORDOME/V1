"""Tests Alfred consultation foyer (coffre, budget, etc.)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.alfred_household import (
    _fallback_household_answer,
    build_household_answer,
    command_wants_household_answer,
)


def test_command_wants_household_answer_vault():
    assert command_wants_household_answer("Consulte dans mon coffre la dernière facture téléphone")
    assert command_wants_household_answer("Est-ce que je peux m'acheter une Ferrari ?")


def test_command_wants_household_answer_skips_clear_actions():
    assert not command_wants_household_answer("Ajoute une tâche : passer à la pharmacie")
    assert not command_wants_household_answer("Crée un événement demain à 10h")
    assert not command_wants_household_answer("mail rapide au pédiatre")


@patch("app.services.alfred_household.answer_household_question")
@patch("app.services.alfred_household.build_household_context")
def test_build_household_answer_returns_intent(mock_ctx, mock_llm):
    mock_ctx.return_value = ("contexte test", [])
    mock_llm.return_value = "Voici le montant de ta facture : 42 €."
    db = MagicMock()
    out = build_household_answer(
        "Quel est le montant de ma facture Orange ?",
        db,
        household_id=1,
        user_id=2,
        memory_lines=["Allergie arachides"],
    )
    assert out["intent"] == "household_answer"
    assert out["mode"] == "auto"
    assert "42" in out["explanation"]
    mock_ctx.assert_called_once()
    mock_llm.assert_called_once()


@patch("app.services.alfred_household.answer_household_question")
@patch("app.services.alfred_household.build_household_context")
@patch("app.services.alfred_household._household_llm_available", return_value=False)
def test_build_household_answer_fallback_without_llm(mock_llm_ok, mock_ctx, mock_llm):
    mock_ctx.return_value = (
        "Budget (enveloppes, montants indicatifs) :\n"
        "- Loisirs : dépensé 500 / plafond 2000\n"
        "Total budget foyer : dépensé 500 / plafond 2000",
        [],
    )
    mock_llm.return_value = None
    db = MagicMock()
    out = build_household_answer(
        "Est-ce que je peux m'acheter une Ferrari ?",
        db,
        household_id=1,
        user_id=2,
    )
    assert out["intent"] == "household_answer"
    assert "500" in out["explanation"]
    mock_llm.assert_not_called()


def test_fallback_household_answer_budget_ferrari():
    ctx = (
        "Budget (enveloppes, montants indicatifs) :\n"
        "- Maison : dépensé 1200 / plafond 3000\n"
        "Total budget foyer : dépensé 1200 / plafond 3000"
    )
    text = _fallback_household_answer(
        "puis-je acheter une Ferrari ?",
        ctx,
        [],
        llm_unavailable=True,
    )
    assert "1200" in text
    assert "Ferrari" in text or "ampleur" in text


@patch("app.services.alfred_household.answer_household_question")
@patch("app.services.alfred_household.build_household_context")
def test_build_household_answer_includes_vault_documents(mock_ctx, mock_llm):
    mock_ctx.return_value = ("contexte", [{"document_id": 7, "name": "Facture Orange", "has_file": True, "excerpt": "42 €"}])
    mock_llm.return_value = "Montant : 42 €."
    db = MagicMock()
    out = build_household_answer("facture Orange", db, household_id=1, user_id=2)
    vault = out["proposal"]["vault_documents"]
    assert len(vault) == 1
    assert vault[0]["id"] == 7
    assert vault[0]["name"] == "Facture Orange"
