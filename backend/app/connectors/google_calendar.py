from datetime import datetime
import json
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.connectors.base import BaseConnector, ConnectorResult
from app.core.config import settings
from app.core.dt import utc_now_naive
from app.models.models import CanonicalEvent, ConnectedAccount


class GoogleCalendarConnector(BaseConnector):
    provider_name = "google_calendar"

    def sync(self) -> ConnectorResult:
        return ConnectorResult(ok=True, payload={"provider": self.provider_name, "events": []}, message="Google stub sync completed")


def exchange_google_code_for_tokens(code: str) -> dict[str, Any]:
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.google_oauth_redirect_uri,
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(token_url, data=payload)
        response.raise_for_status()
        return response.json()


def refresh_google_access_token(refresh_token: str) -> dict[str, Any]:
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(token_url, data=payload)
        response.raise_for_status()
        return response.json()


def _fetch_primary_calendar_events(access_token: str) -> httpx.Response:
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"singleEvents": "true", "orderBy": "startTime", "maxResults": "2500"}
    with httpx.Client(timeout=20.0) as client:
        return client.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", headers=headers, params=params)


def _authorized_google_request(db: Session, account: ConnectedAccount, method: str, url: str, **kwargs) -> httpx.Response:
    try:
        token_payload = json.loads(account.scopes_json or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("invalid_token_payload") from exc

    access_token = token_payload.get("access_token")
    if not access_token:
        raise ValueError("missing_access_token")
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {access_token}"
    with httpx.Client(timeout=20.0) as client:
        response = client.request(method, url, headers=headers, **kwargs)
        if response.status_code != 401:
            return response

        refresh_token = token_payload.get("refresh_token")
        if not refresh_token:
            account.status = "reauth_required"
            db.commit()
            return response
        refreshed = refresh_google_access_token(refresh_token)
        token_payload["access_token"] = refreshed.get("access_token", "")
        token_payload["token_type"] = refreshed.get("token_type", token_payload.get("token_type", "Bearer"))
        token_payload["expires_in"] = refreshed.get("expires_in", token_payload.get("expires_in"))
        account.scopes_json = json.dumps(token_payload)
        db.commit()
        new_access = token_payload.get("access_token")
        if not new_access:
            account.status = "reauth_required"
            db.commit()
            return response
        headers["Authorization"] = f"Bearer {new_access}"
        return client.request(method, url, headers=headers, **kwargs)


def create_google_event(
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
        "summary": title,
        "description": description or "",
        "location": location or "",
        "start": {"dateTime": starts_at.isoformat(), "timeZone": timezone},
        "end": {"dateTime": ends_at.isoformat(), "timeZone": timezone},
    }
    try:
        response = _authorized_google_request(
            db=db,
            account=account,
            method="POST",
            url="https://www.googleapis.com/calendar/v3/calendars/primary/events",
            json=body,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="google_create_failed")
    return ConnectorResult(ok=True, payload={"provider": "google_calendar", "event_id": payload.get("id"), "raw": payload}, message="google_create_ok")


def update_google_event(
    db: Session,
    account: ConnectedAccount,
    *,
    event_id: str,
    title: str,
    starts_at: datetime,
    ends_at: datetime,
    description: str | None = None,
    location: str | None = None,
    timezone: str = "Europe/Paris",
) -> ConnectorResult:
    body: dict[str, Any] = {
        "summary": title,
        "description": description or "",
        "location": location or "",
        "start": {"dateTime": starts_at.isoformat(), "timeZone": timezone},
        "end": {"dateTime": ends_at.isoformat(), "timeZone": timezone},
    }
    try:
        response = _authorized_google_request(
            db=db,
            account=account,
            method="PUT",
            url=f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
            json=body,
        )
        response.raise_for_status()
    except Exception:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="google_update_failed")
    return ConnectorResult(ok=True, payload={"provider": "google_calendar", "event_id": event_id}, message="google_update_ok")


def delete_google_event(db: Session, account: ConnectedAccount, *, event_id: str) -> ConnectorResult:
    try:
        response = _authorized_google_request(
            db=db,
            account=account,
            method="DELETE",
            url=f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
        )
        if response.status_code not in (200, 204, 410):
            response.raise_for_status()
    except Exception:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="google_delete_failed")
    return ConnectorResult(ok=True, payload={"provider": "google_calendar", "event_id": event_id}, message="google_delete_ok")


def sync_google_events(db: Session, account: ConnectedAccount, household_id: int) -> ConnectorResult:
    try:
        token_payload = json.loads(account.scopes_json or "{}")
    except json.JSONDecodeError:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="invalid_token_payload")

    access_token = token_payload.get("access_token")
    if not access_token:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="missing_access_token")

    try:
        response = _fetch_primary_calendar_events(access_token)
        if response.status_code == 401:
            refresh_token = token_payload.get("refresh_token")
            if refresh_token:
                try:
                    refreshed = refresh_google_access_token(refresh_token)
                    token_payload["access_token"] = refreshed.get("access_token", "")
                    token_payload["token_type"] = refreshed.get("token_type", token_payload.get("token_type", "Bearer"))
                    token_payload["expires_in"] = refreshed.get("expires_in", token_payload.get("expires_in"))
                    account.scopes_json = json.dumps(token_payload)
                    db.commit()
                    access_token = token_payload.get("access_token")
                    if not access_token:
                        account.status = "reauth_required"
                        db.commit()
                        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="access_token_expired")
                    response = _fetch_primary_calendar_events(access_token)
                except httpx.HTTPError:
                    account.status = "reauth_required"
                    db.commit()
                    return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="refresh_token_failed")
            else:
                account.status = "reauth_required"
                db.commit()
                return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="access_token_expired")
        if response.status_code == 401:
            account.status = "reauth_required"
            db.commit()
            return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="access_token_expired")
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="google_api_timeout")
    except httpx.HTTPError:
        return ConnectorResult(ok=False, payload={"provider": "google_calendar"}, message="google_api_error")

    items = data.get("items", [])
    synced = 0
    for raw_event in items:
        start_value = (raw_event.get("start") or {}).get("dateTime")
        end_value = (raw_event.get("end") or {}).get("dateTime")
        if not start_value or not end_value:
            continue

        starts_at = datetime.fromisoformat(start_value.replace("Z", "+00:00"))
        ends_at = datetime.fromisoformat(end_value.replace("Z", "+00:00"))
        source_event_id = raw_event.get("id")
        if not source_event_id:
            continue

        event = (
            db.query(CanonicalEvent)
            .filter(
                CanonicalEvent.household_id == household_id,
                CanonicalEvent.source_provider == "google_calendar",
                CanonicalEvent.source_event_id == source_event_id,
            )
            .first()
        )

        if event is None:
            event = CanonicalEvent(
                household_id=household_id,
                title=raw_event.get("summary") or "Evenement Google sans titre",
                description=raw_event.get("description"),
                location=raw_event.get("location"),
                category="calendar_sync",
                starts_at=starts_at,
                ends_at=ends_at,
                timezone=(raw_event.get("start") or {}).get("timeZone") or "UTC",
                source_provider="google_calendar",
                source_event_id=source_event_id,
                raw_payload_json=json.dumps(raw_event),
            )
            db.add(event)
        else:
            event.title = raw_event.get("summary") or "Evenement Google sans titre"
            event.description = raw_event.get("description")
            event.location = raw_event.get("location")
            event.starts_at = starts_at
            event.ends_at = ends_at
            event.timezone = (raw_event.get("start") or {}).get("timeZone") or event.timezone
            event.raw_payload_json = json.dumps(raw_event)
        synced += 1

    account.last_sync_at = utc_now_naive()
    account.status = "connected"
    db.commit()
    return ConnectorResult(ok=True, payload={"provider": "google_calendar", "events_synced": synced}, message="google_sync_ok")
