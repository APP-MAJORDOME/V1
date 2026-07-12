"""Salon foyer : messages, captures Alfred, analyse conversation."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.core.security import AuthContext
from app.services.subscription import can_create_capture, increment_capture_usage
from app.services.grocery_intent import extract_grocery_label, looks_like_grocery_add
from app.models.models import (
    CanonicalEvent,
    GroceryItem,
    HouseholdCapture,
    HouseholdMember,
    HouseholdSalonMessage,
    Task,
    User,
)


def _author_label(db: Session, user_id: int, household_id: int) -> str:
    user = db.get(User, user_id)
    if user and user.full_name:
        return user.full_name.strip()[:120]
    member = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household_id)
        .first()
    )
    return (member.display_name if member else "Membre")[:120]


def _format_created_label(dt: datetime | None) -> str:
    if dt is None:
        return ""
    now = utc_now_naive()
    if dt.date() == now.date():
        return f"Ce matin · {dt.strftime('%H:%M')}"
    if (now - dt).days < 1 and now.date() != dt.date():
        return f"Cette nuit · {dt.strftime('%H:%M')}"
    if (now - dt).days < 2:
        return f"Hier · {dt.strftime('%H:%M')}"
    return dt.strftime("%d/%m · %H:%M")


def _structured_from_payload(kind: str, payload: dict[str, Any], excerpt: str) -> dict[str, Any]:
    proposal = payload.get("proposal") if isinstance(payload.get("proposal"), dict) else {}
    intent = str(payload.get("intent") or kind)
    type_map = {
        "event_create": "event",
        "event_proposal": "event",
        "grocery_add": "grocery",
        "task_create": "task",
    }
    ctype = type_map.get(intent, "suggestion" if kind == "suggestion" else "task")
    title = str(proposal.get("title") or proposal.get("label") or excerpt).strip("«» ").strip()[:120]
    when = str(proposal.get("when") or payload.get("when") or "")
    assignee = str(proposal.get("assignee") or payload.get("assignee") or "")
    return {"type": ctype, "title": title or "Proposition", "when": when, "assignee": assignee}


def _capture_to_read(row: HouseholdCapture) -> dict[str, Any]:
    try:
        inferences = json.loads(row.inferences_json or "[]")
    except Exception:
        inferences = []
    if not isinstance(inferences, list):
        inferences = []
    try:
        payload = json.loads(row.payload_json or "{}")
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    structured = payload.get("structured") if isinstance(payload.get("structured"), dict) else _structured_from_payload(
        row.kind, payload, row.excerpt
    )
    if isinstance(structured, dict):
        payload = {**payload, "structured": structured}
    return {
        "id": row.id,
        "household_id": row.household_id,
        "kind": row.kind,
        "status": row.status,
        "source": row.source,
        "chip": row.chip,
        "source_label": row.source_label,
        "excerpt": row.excerpt,
        "inferences": [str(x) for x in inferences][:8],
        "cta_primary": row.cta_primary,
        "cta_secondary": row.cta_secondary,
        "created_label": _format_created_label(row.created_at),
        "payload": payload,
    }


def list_salon_messages(db: Session, household_id: int, limit: int = 80) -> list[HouseholdSalonMessage]:
    return (
        db.query(HouseholdSalonMessage)
        .filter(HouseholdSalonMessage.household_id == household_id)
        .order_by(HouseholdSalonMessage.created_at.asc())
        .limit(limit)
        .all()
    )


def list_household_captures(
    db: Session,
    household_id: int,
    *,
    status: str | None = None,
    limit: int = 40,
) -> list[dict[str, Any]]:
    q = db.query(HouseholdCapture).filter(HouseholdCapture.household_id == household_id)
    if status:
        q = q.filter(HouseholdCapture.status == status)
    rows = q.order_by(HouseholdCapture.created_at.desc()).limit(limit).all()
    return [_capture_to_read(r) for r in rows]


def create_salon_message(
    db: Session,
    auth: AuthContext,
    text: str,
) -> HouseholdSalonMessage:
    body = (text or "").strip()[:2000]
    row = HouseholdSalonMessage(
        household_id=auth.household_id,
        author_user_id=auth.user_id,
        author_label=_author_label(db, auth.user_id, auth.household_id),
        body_text=body,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _is_system_or_alfred_message(m: HouseholdSalonMessage) -> bool:
    label = (m.author_label or "").strip().lower()
    body = (m.body_text or "").strip()
    if not body:
        return True
    if label in {"alfred", "asse"} or label.startswith("alfred") or label.startswith("asse"):
        return True
    if body.startswith("[[cap:") or body.startswith("Proposition"):
        return True
    if "briefing du jour" in body.lower():
        return True
    return False


def _covered_message_ids(db: Session, household_id: int) -> set[int]:
    covered: set[int] = set()
    rows = db.query(HouseholdCapture).filter(HouseholdCapture.household_id == household_id).all()
    for row in rows:
        try:
            raw = json.loads(row.message_ids_json or "[]")
        except Exception:
            raw = []
        if isinstance(raw, list):
            for x in raw:
                try:
                    covered.add(int(x))
                except (TypeError, ValueError):
                    continue
    return covered


def _clean_excerpt(text: str) -> str:
    t = re.sub(r"^\[\[cap:\d+\]\]\s*", "", (text or "").strip())
    t = re.sub(r"^(Proposition\s*:\s*)+", "", t, flags=re.IGNORECASE).strip()
    t = t.strip("«»\"' ").strip()
    return t[:180]


def _draft_from_message(m: HouseholdSalonMessage) -> dict[str, Any] | None:
    """Une capture max par message humain — jamais depuis l’historique entier."""
    text = (m.body_text or "").strip()
    if not text or _is_system_or_alfred_message(m):
        return None
    lowered = text.lower()
    excerpt = f"« {_clean_excerpt(text)[:120]} »"
    mid = [m.id]

    # Événement santé / RDV
    if any(k in lowered for k in ("dentiste", "rdv", "rendez-vous", "rendez vous", "pédiatre", "pediatre", "médecin", "medecin")):
        who = "Léo" if "léo" in lowered or "leo" in lowered else ""
        title = f"Dentiste — {who}".strip(" —") if "dentiste" in lowered else f"RDV — {who or 'famille'}"
        if "dentiste" in lowered and who:
            title = f"Dentiste — {who}"
        when = "Samedi" if "samedi" in lowered else ""
        return {
            "kind": "event_proposal",
            "source": "salon",
            "chip": "famille",
            "source_label": f"Salon · {m.author_label}",
            "excerpt": excerpt,
            "inferences": ["Événement proposé depuis le Salon", "Confirme le créneau"],
            "cta_primary": "Valider",
            "cta_secondary": "Modifier",
            "payload": {
                "intent": "event_create",
                "proposal": {"title": title[:120], "when": when, "assignee": who},
                "structured": {"type": "event", "title": title[:120], "when": when, "assignee": who},
            },
            "message_ids": mid,
        }

    # Vacances / question ouverte → suggestion (pas un événement dentiste)
    if any(k in lowered for k in ("toussaint", "vacances", "on fait quoi", "week-end", "weekend")):
        return {
            "kind": "suggestion",
            "source": "salon",
            "chip": "foyer",
            "source_label": f"Salon · {m.author_label}",
            "excerpt": excerpt,
            "inferences": ["Sujet à décider en famille", "Pas encore d’événement calendrier"],
            "cta_primary": "Noter l’idée",
            "cta_secondary": "Ignorer",
            "payload": {
                "intent": "suggestion",
                "proposal": {"title": _clean_excerpt(text)[:80], "label": _clean_excerpt(text)[:80]},
                "structured": {"type": "suggestion", "title": _clean_excerpt(text)[:80]},
            },
            "message_ids": mid,
        }

    # Courses
    if looks_like_grocery_add(text) or any(
        k in lowered for k in ("pain", "baguette", "lait", "yaourt", "courses", "acheter", "acheté", "achete")
    ):
        label = extract_grocery_label(text) or _clean_excerpt(text)
        # Nettoie formulations type « ta acheté du pain pour ce soir »
        label = re.sub(
            r"(?i)^(t[’']?as|tu as|ta)\s+(achete|acheté|acheter)\s+(du|de la|des|de l[' ]?)?\s*",
            "",
            label,
        ).strip()
        label = re.sub(r"(?i)\s+pour\s+(ce soir|demain|matin).*$", "", label).strip() or label
        if len(label) < 2:
            label = "Article courses"
        return {
            "kind": "task_proposal",
            "source": "salon",
            "chip": "today",
            "source_label": f"Salon · {m.author_label}",
            "excerpt": excerpt,
            "inferences": ["À ajouter aux courses"],
            "cta_primary": "Valider",
            "cta_secondary": "Ignorer",
            "payload": {
                "intent": "grocery_add",
                "label": label[:120],
                "proposal": {"label": label[:120], "title": label[:120]},
                "structured": {"type": "grocery", "title": label[:120]},
            },
            "message_ids": mid,
        }

    # Tâches ménagères
    if any(
        k in lowered
        for k in (
            "poubelle",
            "sors",
            "sortir",
            "ranger",
            "vaisselle",
            "linge",
            "lessive",
            "nettoie",
            "ménage",
            "menage",
        )
    ):
        title = _clean_excerpt(text)[:120] or "Tâche foyer"
        return {
            "kind": "task_proposal",
            "source": "salon",
            "chip": "today",
            "source_label": f"Salon · {m.author_label}",
            "excerpt": excerpt,
            "inferences": ["Tâche foyer proposée"],
            "cta_primary": "Valider",
            "cta_secondary": "Ignorer",
            "payload": {
                "intent": "task_create",
                "proposal": {"title": title},
                "structured": {"type": "task", "title": title},
            },
            "message_ids": mid,
        }

    return None


def _insert_capture(
    db: Session,
    household_id: int,
    *,
    kind: str,
    source: str,
    chip: str,
    source_label: str,
    excerpt: str,
    inferences: list[str],
    cta_primary: str | None,
    cta_secondary: str | None,
    payload: dict[str, Any],
    message_ids: list[int],
) -> HouseholdCapture | None:
    # Déjà couvert par message_id ?
    covered = _covered_message_ids(db, household_id)
    if message_ids and all(int(i) in covered for i in message_ids):
        return None
    # Excerpt déjà pending (évite doublons)
    needle = excerpt.strip().lower()[:80]
    if needle:
        for row in (
            db.query(HouseholdCapture)
            .filter(HouseholdCapture.household_id == household_id, HouseholdCapture.status == "pending")
            .all()
        ):
            if needle in (row.excerpt or "").lower():
                return None
    row = HouseholdCapture(
        household_id=household_id,
        kind=kind,
        status="pending",
        source=source,
        chip=chip,
        source_label=source_label,
        excerpt=excerpt,
        inferences_json=json.dumps(inferences, ensure_ascii=False),
        cta_primary=cta_primary,
        cta_secondary=cta_secondary,
        payload_json=json.dumps(payload, ensure_ascii=False),
        message_ids_json=json.dumps(message_ids),
    )
    db.add(row)
    return row


def analyze_salon_conversation(db: Session, household_id: int) -> int:
    messages = list_salon_messages(db, household_id, limit=80)
    if not messages:
        return 0

    covered = _covered_message_ids(db, household_id)
    candidates = [
        m
        for m in messages
        if not _is_system_or_alfred_message(m) and m.id not in covered
    ]
    # N’analyser que les 8 derniers messages humains non couverts (évite le spam)
    candidates = candidates[-8:]

    drafts: list[dict[str, Any]] = []
    for m in candidates:
        draft = _draft_from_message(m)
        if draft:
            drafts.append(draft)

    # LLM optionnel : uniquement sur les nouveaux messages humains, pas le fil Alfred
    if candidates:
        try:
            from app.services.llm import analyze_salon_with_openai

            llm_rows = analyze_salon_with_openai(candidates[-6:])
            if llm_rows:
                for item in llm_rows:
                    if not isinstance(item, dict) or not item.get("excerpt"):
                        continue
                    # Force le lien au dernier message candidat si message_ids manquants
                    if not item.get("message_ids"):
                        item["message_ids"] = [candidates[-1].id]
                    # Ignore si déjà une règle pour le même message
                    mids = {int(x) for x in item.get("message_ids") or [] if str(x).isdigit() or isinstance(x, int)}
                    if any(mids & set(d.get("message_ids") or []) for d in drafts):
                        continue
                    drafts.append(item)
        except Exception:
            pass

    created = 0
    for draft in drafts:
        ok, _quota_msg = can_create_capture(db, household_id)
        if not ok:
            break
        row = _insert_capture(
            db,
            household_id,
            kind=str(draft.get("kind") or "suggestion")[:32],
            source=str(draft.get("source") or "salon")[:32],
            chip=str(draft.get("chip") or "foyer")[:32],
            source_label=str(draft.get("source_label") or "Salon")[:255],
            excerpt=str(draft.get("excerpt") or "")[:500],
            inferences=[str(x) for x in (draft.get("inferences") or [])][:8],
            cta_primary=str(draft.get("cta_primary") or "Valider")[:64] or None,
            cta_secondary=str(draft.get("cta_secondary") or "Ignorer")[:64] or None,
            payload=draft.get("payload") if isinstance(draft.get("payload"), dict) else {},
            message_ids=[
                int(x)
                for x in (draft.get("message_ids") or [])
                if str(x).isdigit() or isinstance(x, int)
            ],
        )
        if row is not None:
            db.flush()
            increment_capture_usage(db, household_id, 1)
            clean = _clean_excerpt(row.excerpt)
            db.add(
                HouseholdSalonMessage(
                    household_id=household_id,
                    author_user_id=None,
                    author_label="Alfred",
                    body_text=f"[[cap:{row.id}]] {clean[:200]}",
                )
            )
            created += 1
    if created:
        db.commit()
    return created


def patch_capture_status(
    db: Session,
    auth: AuthContext,
    capture_id: int,
    status: str,
) -> dict[str, Any] | None:
    row = db.get(HouseholdCapture, capture_id)
    if row is None or row.household_id != auth.household_id:
        return None
    row.status = status
    db.commit()
    db.refresh(row)
    result = _capture_to_read(row)
    if status == "approved":
        apply = apply_capture(db, auth, row)
        result["apply"] = apply
    return result


def apply_capture(db: Session, auth: AuthContext, capture: HouseholdCapture) -> dict[str, Any]:
    try:
        payload = json.loads(capture.payload_json or "{}")
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    intent = str(payload.get("intent") or capture.kind)
    proposal = payload.get("proposal") if isinstance(payload.get("proposal"), dict) else payload

    if intent == "grocery_add" or (
        capture.kind == "task_proposal" and intent in {"grocery_add", "task_proposal"}
        and any(
            k in (str(proposal.get("label") or proposal.get("title") or capture.excerpt)).lower()
            for k in ("pain", "lait", "yaourt", "baguette", "courses", "alloco", "carotte", "patate")
        )
    ):
        label = str(proposal.get("label") or proposal.get("title") or capture.excerpt).strip()
        label = re.sub(r"[«»\"]", "", label)
        label = re.sub(r"^(Proposition\s*:\s*)+", "", label, flags=re.IGNORECASE).strip()[:120]
        if intent == "grocery_add" or any(
            k in label.lower() for k in ("pain", "lait", "yaourt", "baguette", "courses", "alloco", "carotte", "patate")
        ):
            existing = (
                db.query(GroceryItem)
                .filter(GroceryItem.household_id == auth.household_id, GroceryItem.done.is_(False))
                .all()
            )
            if not any(g.label.strip().lower() == label.lower() for g in existing):
                db.add(GroceryItem(household_id=auth.household_id, label=label, done=False))
                db.commit()
            return {"executed": True, "message": f"« {label} » ajouté à la liste courses.", "type": "grocery"}

    if intent in {"task_create", "task_proposal"} or capture.kind == "task_proposal":
        title = str(proposal.get("title") or proposal.get("label") or capture.excerpt).strip()
        title = re.sub(r"[«»\"]", "", title)
        title = re.sub(r"^(Proposition\s*:\s*)+", "", title, flags=re.IGNORECASE).strip()[:255] or "Tâche Salon"
        task = Task(
            household_id=auth.household_id,
            title=title,
            status="open",
            task_type="salon_capture",
            weight_minutes=15,
            equity_category="autre",
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return {
            "executed": True,
            "message": f"Tâche créée : {task.title}",
            "type": "task",
            "task_id": task.id,
        }

    if intent in {"event_create", "event_proposal"} or capture.kind == "event_proposal":
        title = str(proposal.get("title") or "Événement Salon")[:255]
        now = utc_now_naive()
        starts = now + timedelta(days=2)
        starts = starts.replace(hour=10, minute=0, second=0, microsecond=0)
        if "samedi" in capture.excerpt.lower():
            days_ahead = (5 - now.weekday()) % 7 or 7
            starts = (now + timedelta(days=days_ahead)).replace(hour=10, minute=0, second=0, microsecond=0)
        event = CanonicalEvent(
            household_id=auth.household_id,
            title=title,
            category="sante" if "dentiste" in title.lower() or "dentiste" in capture.excerpt.lower() else "general",
            starts_at=starts,
            ends_at=starts + timedelta(hours=1),
            timezone="Europe/Paris",
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return {
            "executed": True,
            "message": f"Événement ajouté : {event.title}",
            "type": "event",
            "event_id": event.id,
        }

    return {
        "executed": True,
        "message": "Capture enregistrée — action suggérée sans exécution automatique.",
        "type": "suggestion",
    }


def seed_salon_demo(db: Session, auth: AuthContext) -> bool:
    """Insère fil + captures démo si le salon est vide."""
    existing = (
        db.query(HouseholdSalonMessage)
        .filter(HouseholdSalonMessage.household_id == auth.household_id)
        .count()
    )
    if existing > 0:
        return False
    partner = "Partenaire"
    for m in db.query(HouseholdMember).filter(HouseholdMember.household_id == auth.household_id).all():
        if m.display_name and m.display_name != _author_label(db, auth.user_id, auth.household_id):
            partner = m.display_name
            break
    self_label = _author_label(db, auth.user_id, auth.household_id)
    now = utc_now_naive()
    samples = [
        (partner, "Toussaint, on fait quoi cette année ?", now - timedelta(hours=10)),
        (partner, "Léo dentiste samedi, tu peux le noter ?", now - timedelta(hours=8)),
        (self_label, "Oui je m’en occupe demain matin.", now - timedelta(hours=8) + timedelta(minutes=1)),
        (partner, "Pain demain matin stp 🥖", now - timedelta(minutes=30)),
    ]
    for label, body, at in samples:
        db.add(
            HouseholdSalonMessage(
                household_id=auth.household_id,
                author_user_id=None if label == partner else auth.user_id,
                author_label=label[:120],
                body_text=body,
                created_at=at,
                updated_at=at,
            )
        )
    db.commit()
    analyze_salon_conversation(db, auth.household_id)
    return True
