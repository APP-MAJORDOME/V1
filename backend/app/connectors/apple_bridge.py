from datetime import UTC, datetime, timedelta
import json
from typing import Any

import vobject
from sqlalchemy.orm import Session

from app.connectors.base import BaseConnector, ConnectorResult
from app.core.dt import utc_now_naive
from app.models.models import CanonicalEvent, ConnectedAccount

try:
    import caldav as _caldav
except ModuleNotFoundError:  # pragma: no cover - optional dep in minimal test envs
    _caldav = None

CALDAV_AVAILABLE: bool = _caldav is not None


def _caldav_unavailable_result() -> ConnectorResult:
    return ConnectorResult(
        ok=False,
        payload={"provider": "apple_calendar"},
        message="caldav_not_installed",
    )


class AppleBridgeConnector(BaseConnector):
    provider_name = "apple_calendar"

    def sync(self) -> ConnectorResult:
        return ConnectorResult(ok=True, payload={"provider": self.provider_name, "events": []}, message="Apple bridge sync completed")


def _dt_to_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    return None


def _apple_credentials(account: ConnectedAccount) -> tuple[str, str, str | None] | None:
    try:
        payload = json.loads(account.scopes_json or "{}")
    except json.JSONDecodeError:
        return None
    apple_id = payload.get("apple_id")
    app_password = payload.get("app_password")
    calendar_url = payload.get("calendar_url")
    if not apple_id or not app_password:
        return None
    return str(apple_id), str(app_password), str(calendar_url) if calendar_url else None


def _resolve_apple_calendar(client: Any, calendar_url: str | None):
    principal = client.principal()
    calendars = principal.calendars()
    if calendar_url:
        target = [c for c in calendars if str(c.url).rstrip("/") == str(calendar_url).rstrip("/")]
        if target:
            return target[0]
    if calendars:
        return calendars[0]
    return None


def sync_apple_events(db: Session, account: ConnectedAccount, household_id: int) -> ConnectorResult:
    if _caldav is None:
        return _caldav_unavailable_result()
    try:
        payload = json.loads(account.scopes_json or "{}")
    except json.JSONDecodeError:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="invalid_apple_credentials_payload")

    apple_id = payload.get("apple_id")
    app_password = payload.get("app_password")
    calendar_url = payload.get("calendar_url")
    if not apple_id or not app_password:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="missing_apple_credentials")

    principal_url = "https://caldav.icloud.com/"
    synced = 0
    now = datetime.now(UTC)
    horizon = now + timedelta(days=120)
    try:
        client = _caldav.DAVClient(url=principal_url, username=apple_id, password=app_password)
        principal = client.principal()
        calendars = principal.calendars()
        target_calendars = calendars
        if calendar_url:
            target_calendars = [c for c in calendars if str(c.url).rstrip("/") == str(calendar_url).rstrip("/")]
        for calendar in target_calendars:
            events = calendar.date_search(start=now, end=horizon, expand=True)
            for ev in events:
                vevent = ev.vobject_instance.vevent
                title = str(getattr(vevent, "summary", None).value) if hasattr(vevent, "summary") else "Evenement Apple sans titre"
                starts_at = _dt_to_utc(getattr(getattr(vevent, "dtstart", None), "value", None))
                ends_at = _dt_to_utc(getattr(getattr(vevent, "dtend", None), "value", None))
                if starts_at is None or ends_at is None:
                    continue
                source_event_id = str(ev.url)
                location = str(getattr(getattr(vevent, "location", None), "value", "")) or None
                description = str(getattr(getattr(vevent, "description", None), "value", "")) or None

                existing = (
                    db.query(CanonicalEvent)
                    .filter(
                        CanonicalEvent.household_id == household_id,
                        CanonicalEvent.source_provider == "apple_calendar",
                        CanonicalEvent.source_event_id == source_event_id,
                    )
                    .first()
                )
                raw_payload = {
                    "calendar_url": str(calendar.url),
                    "event_url": source_event_id,
                    "title": title,
                }
                if existing is None:
                    db.add(
                        CanonicalEvent(
                            household_id=household_id,
                            title=title,
                            description=description,
                            location=location,
                            category="calendar_sync",
                            starts_at=starts_at.replace(tzinfo=None),
                            ends_at=ends_at.replace(tzinfo=None),
                            timezone="UTC",
                            source_provider="apple_calendar",
                            source_event_id=source_event_id,
                            raw_payload_json=json.dumps(raw_payload),
                        )
                    )
                else:
                    existing.title = title
                    existing.description = description
                    existing.location = location
                    existing.starts_at = starts_at.replace(tzinfo=None)
                    existing.ends_at = ends_at.replace(tzinfo=None)
                    existing.raw_payload_json = json.dumps(raw_payload)
                synced += 1
    except Exception:
        account.status = "reauth_required"
        db.commit()
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="apple_sync_failed")

    account.status = "connected"
    account.last_sync_at = utc_now_naive()
    db.commit()
    return ConnectorResult(ok=True, payload={"provider": "apple_calendar", "events_synced": synced}, message="apple_sync_ok")


def create_apple_event(
    account: ConnectedAccount,
    *,
    title: str,
    starts_at: datetime,
    ends_at: datetime,
    description: str | None = None,
    location: str | None = None,
) -> ConnectorResult:
    if _caldav is None:
        return _caldav_unavailable_result()
    creds = _apple_credentials(account)
    if creds is None:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="missing_apple_credentials")
    apple_id, app_password, calendar_url = creds
    try:
        client = _caldav.DAVClient(url="https://caldav.icloud.com/", username=apple_id, password=app_password)
        calendar = _resolve_apple_calendar(client, calendar_url)
        if calendar is None:
            return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="apple_calendar_not_found")

        cal = vobject.iCalendar()
        ve = cal.add("vevent")
        ve.add("summary").value = title
        if description:
            ve.add("description").value = description
        if location:
            ve.add("location").value = location
        ve.add("dtstart").value = starts_at.replace(tzinfo=UTC)
        ve.add("dtend").value = ends_at.replace(tzinfo=UTC)
        ve.add("uid").value = f"majordome-{int(utc_now_naive().timestamp() * 1000)}@majordome"
        event = calendar.save_event(cal.serialize())
        return ConnectorResult(
            ok=True,
            payload={"provider": "apple_calendar", "event_id": str(event.url)},
            message="apple_create_ok",
        )
    except Exception:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="apple_create_failed")


def update_apple_event(
    account: ConnectedAccount,
    *,
    event_id: str,
    title: str,
    starts_at: datetime,
    ends_at: datetime,
    description: str | None = None,
    location: str | None = None,
) -> ConnectorResult:
    if _caldav is None:
        return _caldav_unavailable_result()
    creds = _apple_credentials(account)
    if creds is None:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="missing_apple_credentials")
    apple_id, app_password, _ = creds
    try:
        client = _caldav.DAVClient(url="https://caldav.icloud.com/", username=apple_id, password=app_password)
        event = _caldav.Event(client=client, url=event_id)
        event.load()
        cal = event.vobject_instance
        ve = cal.vevent
        ve.summary.value = title
        if hasattr(ve, "description"):
            ve.description.value = description or ""
        elif description:
            ve.add("description").value = description
        if hasattr(ve, "location"):
            ve.location.value = location or ""
        elif location:
            ve.add("location").value = location
        ve.dtstart.value = starts_at.replace(tzinfo=UTC)
        ve.dtend.value = ends_at.replace(tzinfo=UTC)
        event.data = cal.serialize()
        event.save()
        return ConnectorResult(ok=True, payload={"provider": "apple_calendar", "event_id": event_id}, message="apple_update_ok")
    except Exception:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="apple_update_failed")


def delete_apple_event(account: ConnectedAccount, *, event_id: str) -> ConnectorResult:
    if _caldav is None:
        return _caldav_unavailable_result()
    creds = _apple_credentials(account)
    if creds is None:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="missing_apple_credentials")
    apple_id, app_password, _ = creds
    try:
        client = _caldav.DAVClient(url="https://caldav.icloud.com/", username=apple_id, password=app_password)
        event = _caldav.Event(client=client, url=event_id)
        event.delete()
        return ConnectorResult(ok=True, payload={"provider": "apple_calendar", "event_id": event_id}, message="apple_delete_ok")
    except Exception:
        return ConnectorResult(ok=False, payload={"provider": "apple_calendar"}, message="apple_delete_failed")
