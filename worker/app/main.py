import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


BACKEND_PATH = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.append(str(BACKEND_PATH))

from app.connectors.google_calendar import sync_google_events  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models.models import ConnectedAccount, Household  # noqa: E402
from app.services.briefing import build_today_briefing  # noqa: E402
from app.services.partner_delegation import process_due_reminders  # noqa: E402

INTERVAL_SECONDS = int(os.getenv("MAJORDOME_WORKER_INTERVAL_SECONDS", "30"))
MAX_RETRIES = int(os.getenv("MAJORDOME_WORKER_MAX_RETRIES", "3"))
RETRY_BASE_DELAY_SECONDS = int(os.getenv("MAJORDOME_WORKER_RETRY_BASE_DELAY_SECONDS", "2"))
INSTANCE_ID = os.getenv("MAJORDOME_WORKER_INSTANCE_ID", str(uuid4()))


def log(event: str, **payload: object) -> None:
    print(
        json.dumps(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "instance_id": INSTANCE_ID,
                "event": event,
                **payload,
            }
        ),
        flush=True,
    )


def sync_google_account_with_retry(account_id: int, household_id: int, cycle_id: str) -> tuple[bool, str]:
    for attempt in range(1, MAX_RETRIES + 1):
        db = SessionLocal()
        try:
            account = db.get(ConnectedAccount, account_id)
            if account is None:
                return False, "account_not_found"
            result = sync_google_events(db=db, account=account, household_id=household_id)
            if result.ok:
                return True, result.message
            message = result.message or "sync_failed"
            if message in {"access_token_expired", "refresh_token_failed"}:
                return False, message
            if attempt == MAX_RETRIES:
                return False, message
            delay_seconds = RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1))
            log(
                "sync_retry_scheduled",
                cycle_id=cycle_id,
                account_id=account_id,
                attempt=attempt,
                max_retries=MAX_RETRIES,
                reason=message,
                retry_in_seconds=delay_seconds,
            )
            time.sleep(delay_seconds)
        except Exception as exc:  # noqa: BLE001
            if attempt == MAX_RETRIES:
                return False, f"exception:{type(exc).__name__}"
            delay_seconds = RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1))
            log(
                "sync_retry_scheduled",
                cycle_id=cycle_id,
                account_id=account_id,
                attempt=attempt,
                max_retries=MAX_RETRIES,
                reason=f"exception:{type(exc).__name__}",
                retry_in_seconds=delay_seconds,
            )
            time.sleep(delay_seconds)
        finally:
            db.close()
    return False, "unreachable"


def run_sync_cycle(cycle_id: str) -> None:
    db = SessionLocal()
    try:
        reminders = process_due_reminders(db)
        if reminders:
            log("partner_delegation_reminders_sent", cycle_id=cycle_id, count=reminders)

        households = db.query(Household).all()
        synced_accounts = 0
        failed_accounts = 0
        for household in households:
            if household.owner_user_id is None:
                continue
            accounts = (
                db.query(ConnectedAccount)
                .filter(
                    ConnectedAccount.user_id == household.owner_user_id,
                    ConnectedAccount.provider == "google_calendar",
                    ConnectedAccount.status.in_(["connected", "reauth_required"]),
                )
                .all()
            )
            for account in accounts:
                ok, status = sync_google_account_with_retry(account.id, household.id, cycle_id=cycle_id)
                if ok:
                    synced_accounts += 1
                    log("account_sync_ok", cycle_id=cycle_id, account_id=account.id, household_id=household.id, status=status)
                else:
                    failed_accounts += 1
                    log("account_sync_failed", cycle_id=cycle_id, account_id=account.id, household_id=household.id, status=status)

            briefing = build_today_briefing(db, household_id=household.id)
            log(
                "household_briefing_snapshot",
                cycle_id=cycle_id,
                household_id=household.id,
                events_count=briefing["events_count"],
                tasks_count=briefing["tasks_count"],
                conflicts_count=briefing.get("conflicts_count", 0),
                opportunities_count=briefing["opportunities_count"],
            )

        log(
            "sync_cycle_completed",
            cycle_id=cycle_id,
            synced_accounts=synced_accounts,
            failed_accounts=failed_accounts,
            households_scanned=len(households),
        )
    finally:
        db.close()


def tick() -> None:
    started = time.perf_counter()
    cycle_id = str(uuid4())
    log("worker_tick_started", cycle_id=cycle_id)
    run_sync_cycle(cycle_id=cycle_id)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    log("worker_tick_completed", cycle_id=cycle_id, elapsed_ms=elapsed_ms)


if __name__ == "__main__":
    log("worker_started", interval_seconds=INTERVAL_SECONDS, max_retries=MAX_RETRIES)
    while True:
        tick()
        time.sleep(INTERVAL_SECONDS)
