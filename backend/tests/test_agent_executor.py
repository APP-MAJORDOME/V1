"""Tests exécution Alfred côté serveur."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.core.security import AuthContext
from app.services.agent_executor import execute_agent_act, interpret_for_act


@patch("app.services.agent_executor.build_household_answer")
@patch("app.services.agent_executor.command_wants_household_answer", return_value=True)
def test_interpret_for_act_household_short_circuit(mock_wants, mock_build):
    mock_build.return_value = {
        "intent": "household_answer",
        "mode": "auto",
        "proposal": {},
        "explanation": "ok",
    }
    db = MagicMock()
    out = interpret_for_act("budget ?", db, 1, 2, [])
    assert out["intent"] == "household_answer"
    mock_wants.assert_called_once()


def test_execute_agent_act_preview_only_for_email():
    db = MagicMock()
    auth = AuthContext(user_id=1, household_id=1, token="x", jti="j", token_type="access")
    out = execute_agent_act("envoie un mail au médecin", db, auth, [])
    assert out["status"] == "preview_only"
    assert out["preview"]["intent"] == "email_draft"
