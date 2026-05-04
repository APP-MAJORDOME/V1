"""Envoi des notifications de délégation partenaire (journal structuré + SMS Twilio / SMTP optionnels)."""

from __future__ import annotations

import json
import re
import smtplib
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dt import utc_now_naive
from app.core.structured_log import log_event
from app.models.models import TaskDelegation


def _ack_url(token: str) -> str:
    base = settings.public_api_base_url.rstrip("/")
    return f"{base}/api/v1/public/partner-delegations/{token}/ack"


def build_message_body(*, partner_name: str, items: list[dict[str, Any]], ack_token: str, prefix: str = "") -> str:
    lines = [f"{prefix}{partner_name}, tu as des choses à prendre sur MajorDome :"]
    for i, it in enumerate(items, 1):
        title = str(it.get("title") or "").strip()
        lines.append(f"{i}. {title}")
    lines.append("")
    lines.append(f"Accusé réception (1 tap) : {_ack_url(ack_token)}")
    return "\n".join(lines)


def _looks_like_email(s: str) -> bool:
    s = s.strip()
    return bool(s and "@" in s and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s))


def _looks_like_phone(s: str) -> bool:
    s = re.sub(r"[\s.-]", "", s.strip())
    return bool(re.match(r"^\+?\d{8,15}$", s))


def _send_twilio_sms(to_e164: str, body: str) -> None:
    sid = settings.twilio_account_sid.strip()
    token = settings.twilio_auth_token.strip()
    from_num = settings.twilio_from_number.strip()
    if not sid or not token or not from_num:
        raise RuntimeError("twilio_not_configured")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    with httpx.Client(timeout=20.0) as client:
        r = client.post(
            url,
            auth=(sid, token),
            data={"From": from_num, "To": to_e164, "Body": body[:1600]},
        )
        r.raise_for_status()


def _send_smtp_email(to_addr: str, subject: str, body: str) -> None:
    host = settings.smtp_host.strip()
    if not host:
        raise RuntimeError("smtp_not_configured")
    port = int(settings.smtp_port)
    user = settings.smtp_user.strip()
    password = settings.smtp_password
    from_email = settings.smtp_from_email.strip() or user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_addr
    msg.attach(MIMEText(body, "plain", "utf-8"))
    with smtplib.SMTP(host, port, timeout=25) as smtp:
        smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.sendmail(from_email, [to_addr], msg.as_string())


def deliver_partner_delegation(
    db: Session,
    row: TaskDelegation,
    *,
    is_reminder: bool = False,
) -> list[str]:
    """Envoie ou ré-envoie le message. Met à jour last_sent_at, delivery_channels_json, next_reminder_at."""
    channels: list[str] = ["log"]
    try:
        items = json.loads(row.task_snapshot_json or "[]")
    except json.JSONDecodeError:
        items = []

    prefix = "Rappel — " if is_reminder else ""
    body = build_message_body(
        partner_name=row.partner_display_name,
        items=items if isinstance(items, list) else [],
        ack_token=row.ack_token,
        prefix=prefix,
    )
    subject = f"{prefix}MajorDome — tâches pour {row.partner_display_name}".strip()

    log_event(
        "partner_delegation_delivery",
        household_id=row.household_id,
        delegation_id=row.id,
        is_reminder=is_reminder,
        partner=row.partner_display_name,
        message_preview=body[:300],
    )

    contact = (row.partner_contact or "").strip()
    if contact:
        if _looks_like_email(contact) and settings.smtp_host.strip():
            try:
                _send_smtp_email(contact, subject.replace("\n", " ")[:200], body)
                channels.append("email")
            except Exception as exc:
                log_event(
                    "partner_delegation_email_failed",
                    household_id=row.household_id,
                    delegation_id=row.id,
                    error=str(exc),
                )
        elif _looks_like_phone(contact) and settings.twilio_account_sid.strip():
            try:
                raw = re.sub(r"[\s.-]", "", contact.strip())
                if raw.startswith("+"):
                    phone = raw
                elif raw.startswith("0") and len(raw) == 10:
                    phone = "+33" + raw[1:]
                else:
                    phone = "+" + raw.lstrip("+")
                _send_twilio_sms(phone, body)
                channels.append("sms")
            except Exception as exc:
                log_event(
                    "partner_delegation_sms_failed",
                    household_id=row.household_id,
                    delegation_id=row.id,
                    error=str(exc),
                )

    now = utc_now_naive()
    row.last_sent_at = now
    row.delivery_channels_json = json.dumps(channels)

    if is_reminder:
        row.reminder_count = int(row.reminder_count or 0) + 1

    if row.acknowledged_at is None:
        if settings.delegation_max_reminders <= 0:
            row.next_reminder_at = None
        elif is_reminder and row.reminder_count >= settings.delegation_max_reminders:
            row.next_reminder_at = None
        else:
            row.next_reminder_at = now + timedelta(hours=settings.delegation_reminder_hours)
    else:
        row.next_reminder_at = None

    db.add(row)
    db.commit()
    db.refresh(row)
    return channels


def process_due_reminders(db: Session) -> int:
    """Relances automatiques (worker). Retourne le nombre de délégations traitées."""
    now = utc_now_naive()
    q = (
        db.query(TaskDelegation)
        .filter(
            TaskDelegation.acknowledged_at.is_(None),
            TaskDelegation.next_reminder_at.isnot(None),
            TaskDelegation.next_reminder_at <= now,
        )
        .order_by(TaskDelegation.id.asc())
        .limit(50)
    )
    n = 0
    for row in q.all():
        deliver_partner_delegation(db, row, is_reminder=True)
        n += 1
    return n
