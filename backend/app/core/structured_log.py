import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(event: str, *, request_id: str | None = None, **fields: Any) -> None:
    payload: dict[str, Any] = {"ts": _now_iso(), "event": event, **fields}
    if request_id:
        payload["request_id"] = request_id
    print(json.dumps(payload, default=str), flush=True)


def email_fingerprint(email: str) -> str:
    normalized = email.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
