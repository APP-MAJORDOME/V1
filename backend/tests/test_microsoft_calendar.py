"""Tests connecteur Microsoft Calendar."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import httpx

from app.connectors.microsoft_calendar import sync_microsoft_events


@patch("app.connectors.microsoft_calendar._fetch_calendar_events")
def test_sync_microsoft_events_imports_events(mock_fetch):
    mock_fetch.return_value = httpx.Response(
        200,
        json={
            "value": [
                {
                    "id": "evt-1",
                    "subject": "Réunion",
                    "start": {"dateTime": "2026-06-15T10:00:00", "timeZone": "Europe/Paris"},
                    "end": {"dateTime": "2026-06-15T11:00:00", "timeZone": "Europe/Paris"},
                }
            ]
        },
    )
    db = MagicMock()
    account = MagicMock()
    account.scopes_json = json.dumps({"access_token": "tok", "refresh_token": "ref"})
    account.status = "connected"
    db.query.return_value.filter.return_value.first.return_value = None
    result = sync_microsoft_events(db, account, household_id=7)
    assert result.ok
    assert result.message == "microsoft_sync_ok"
    db.add.assert_called()
    db.commit.assert_called()
