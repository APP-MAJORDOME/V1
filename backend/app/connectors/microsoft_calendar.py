"""Microsoft Graph Calendar — OAuth, sync et création d’événements."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorResult
from app.core.config import settings
from app.core.dt import utc_now_naive
from app.models.models import CanonicalEvent, ConnectedAccount

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL_TEMPLATE = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
AUTHORIZE_URL_TEMPLATE = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"


def microsoft_oauth_authorize_url(state: str) -> str:
    tenant = settings.microsoft_oauth_tenant or "common"
    query = urlencode(
        {
            "client_id": settings.microsoft_oauth_client_id,
            "redirect_uri": settings.microsoft_oauth_redirect_uri,
            "response_type": "code",
            "scope": settings.microsoft_oauth_scopes,
            "state": state,
            "prompt": "consent",
        }
    )
    return f"{AUTHORIZE_URL_TEMPLATE.format(tenant=tenant)}?{query}"


def exchange_microsoft_code_for_tokens(code: str) -> dict[str, Any]:
    tenant = settings.microsoft_oauth_tenant or "common"
    payload = {
        "client_id": settings.microsoft_oauth_client_id,
        "client_secret": settings.microsoft_oauth_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.microsoft_oauth_redirect_uri,
    }
    with httpx.Client(timeout=20.0) as client:
        response = client.post(TOKEN_URL_TEMPLATE.format(tenant=tenant), data=payload)
        response.raise_for_status()
        return response.json()


def refresh_microsoft_access_token(refresh_token: str) -> dict[str, Any]:
    tenant = settings.microsoft_oauth_tenant or "common"
    payload = {
        "client_id": settings.microsoft_oauth_client_id,
        "client_secret": settings.microsoft_oauth_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    with httpx.Client(timeout=20.0) as client:
        response = client.post(TOKEN_URL_TEMPLATE.format(tenant=tenant), data=payload)
        response.raise_for_status()
        return response.json()


def _parse_graph_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _load_token_payload(account: ConnectedAccount) -> dict[str, Any] | None:
    try:
        return json.loads(account.scopes_json or "{}")
    except json.JSONDecodeError:
        return None


def _authorized_graph_request(
    db: Session,
    account: ConnectedAccount,
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    token_payload = _load_token_payload(account)
    if not token_payload:
        raise ValueError("invalid_token_payload")

    access_token = token_payload.get("access_token")
    if not access_token:
        raise ValueError("missing_access_token")

    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {access_token}"
    with httpx.Client(timeout=25.0) as client:
        response = client.request(method, url, headers=headers, **kwargs)
        if response.status_code != 401:
            return response

        refresh_token = token_payload.get("refresh_token")
        if not refresh_token:
            account.status = "reauth_required"
            db.commit()
            return response
        try:
            refreshed = refresh_microsoft_access_token(refresh_token)
        except httpx.HTTPError:
            account.status = "reauth_required"
            db.commit()
            return response

        token_payload["access_token"] = refreshed.get("access_token", "")
        token_payload["token_type"] = refreshed.get("token_type", token_payload.get("token_type", "Bearer"))
        token_payload["expires_in"] = refreshed.get("expires_in", token_payload.get("expires_in"))
        if refreshed.get("refresh_token"):
            token_payload["refresh_token"] = refreshed["refresh_token"]
        account.scopes_json = json.dumps(token_payload)
        db.commit()
        new_access = token_payload.get("access_token")
        if not new_access:
            account.status = "reauth_required"
            db.commit()
            return response
        headers["Authorization"] = f"Bearer {new_access}"
        return client.request(method, url, headers=headers, **kwargs)


def _fetch_calendar_events(access_token: str) -> httpx.Response:
    headers = {"Authorization": f"Bearer {access_token}"}
    now = utc_now_naive()
    start = (now - timedelta(days=7)).isoformat()
    end = (now + timedelta(days=120)).isoformat()
    params = {
        "$top": "250",
        "$orderby": "start/dateTime",
        "startDateTime": start,
        "endDateTime": end,
    }
    with httpx.Client(timeout=25.0) as client:
        return client.get(
            f"{GRAPH_BASE}/me/calendarView",
            headers=headers,
            params=params,
        )


def sync_microsoft_events(db: Session, account: ConnectedAccount, household_id: int) -> ConnectorResult:
    token_payload = _load_token_payload(account)
    if not token_payload:
        return ConnectorResult(ok=False, payload={"provider": "microsoft_calendar"}, message="invalid_token_payload")

    access_token = token_payload.get("access_token")
    if not access_token:
        return ConnectorResult(ok=False, payload={"provider": "microsoft_calendar"}, message="missing_access_token")

    try:
        response = _fetch_calendar_events(access_token)
        if response.status_code == 401:
            refresh_token = token_payload.get("refresh_token")
            if refresh_token:
                try:
                    refreshed = refresh_microsoft_access_token(refresh_token)
                    token_payload["access_token"] = refreshed.get("access_token", "")
                    if refreshed.get("refresh_token"):
                        token_payload["refresh_token"] = refreshed["refresh_token"]
                    account.scopes_json = json.dumps(token_payload)
                    db.commit()
                    access_token = token_payload.get("access_token")
                    if not access_token:
                        account.status = "reauth_required"
                        db.commit()
                        return ConnectorResult(
                            ok=False,
                            payload={"provider": "microsoft_calendar"},
                            message="access_token_expired",
                        )
                    response = _fetch_calendar_events(access_token)
                except httpx.HTTPError:
                    account.status = "reauth_required"
                    db.commit()
                    return ConnectorResult(
                        ok=False,
                        payload={"provider": "microsoft_calendar"},
                        message="refresh_token_failed",
                    )
            else:
                account.status = "reauth_required"
                db.commit()
                return ConnectorResult(
                    ok=False,
                    payload={"provider": "microsoft_calendar"},
                    message="access_token_expired",
                )
        if response.status_code == 401:
            account.status = "reauth_required"
            db.commit()
            return ConnectorResult(
                ok=False,
                payload={"provider": "microsoft_calendar"},
                message="access_token_expired",
            )
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException:
        return ConnectorResult(ok=False, payload={"provider": "microsoft_calendar"}, message="microsoft_api_timeout")
    except httpx.HTTPError:
        return ConnectorResult(ok=False, payload={"provider": "microsoft_calendar"}, message="microsoft_api_error")

    items = data.get("value") or []
    synced = 0
    for raw_event in items:
        start_value = (raw_event.get("start") or {}).get("dateTime")
        end_value = (raw_event.get("end") or {}).get("dateTime")
        starts_at = _parse_graph_datetime(start_value)
        ends_at = _parse_graph_datetime(end_value)
        if not starts_at or not ends_at:
            continue
        source_event_id = raw_event.get("id")
        if not source_event_id:
            continue

        event = (
            db.query(CanonicalEvent)
            .filter(
                CanonicalEvent.household_id == household_id,
                CanonicalEvent.source_provider == "microsoft_calendar",
                CanonicalEvent.source_event_id == source_event_id,
            )
            .first()
        )
        title = raw_event.get("subject") or "Événement Outlook sans titre"
        if event is None:
            event = CanonicalEvent(
                household_id=household_id,
                title=title,
                description=raw_event.get("bodyPreview"),
                location=(raw_event.get("location") or {}).get("displayName"),
                category="calendar_sync",
                starts_at=starts_at,
                ends_at=ends_at,
                timezone=(raw_event.get("start") or {}).get("timeZone") or "UTC",
                source_provider="microsoft_calendar",
                source_event_id=source_event_id,
                raw_payload_json=json.dumps(raw_event),
            )
            db.add(event)
        else:
            event.title = title
            event.description = raw_event.get("bodyPreview")
            event.location = (raw_event.get("location") or {}).get("displayName")
            event.starts_at = starts_at
            event.ends_at = ends_at
            event.timezone = (raw_event.get("start") or {}).get("timeZone") or event.timezone
            event.raw_payload_json = json.dumps(raw_event)
        synced += 1

    account.last_sync_at = utc_now_naive()
    account.status = "connected"
    db.commit()
    return ConnectorResult(
        ok=True,
        payload={"provider": "microsoft_calendar", "events_synced": synced},
        message="microsoft_sync_ok",
    )


def create_microsoft_event(
    db: Session,
    account: ConnectedAccount,
    *,
    title: str,
    starts_at: datetime,
    ends_at: datetime,
    description: str | None = None,
    location: str | None = None,
    timezone: str = "Europe/Paris",
) -> ConnectorResult:
    body: dict[str, Any] = {
        "subject": title,
        "body": {"contentType": "text", "content": description or ""},
        "start": {"dateTime": starts_at.isoformat(), "timeZone": timezone},
        "end": {"dateTime": ends_at.isoformat(), "timeZone": timezone},
    }
    if location:
        body["location"] = {"displayName": location}
    try:
        response = _authorized_graph_request(
            db=db,
            account=account,
            method="POST",
            url=f"{GRAPH_BASE}/me/events",
            json=body,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return ConnectorResult(ok=False, payload={"provider": "microsoft_calendar"}, message="microsoft_create_failed")
    return ConnectorResult(
        ok=True,
        payload={"provider": "microsoft_calendar", "event_id": payload.get("id"), "raw": payload},
        message="microsoft_create_ok",
    )
