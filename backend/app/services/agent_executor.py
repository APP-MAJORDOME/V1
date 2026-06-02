"""Exécution serveur des intentions Alfred (endpoint /agent/act)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.core.security import AuthContext
from app.models.models import (
    CanonicalEvent,
    ConnectedAccount,
    GroceryItem,
    HouseholdMemoryFact,
    HouseholdMember,
    Task,
)
from app.services.agent import interpret_command
from app.services.alfred_household import build_household_answer, command_wants_household_answer
from app.services.home import infer_and_execute_device_control
from app.services.shopping_advisor import build_shopping_plan_response, command_wants_shopping_plan

_CONSULTATION_INTENTS = frozenset({"household_answer", "web_search", "document_analyze"})
_CONFIRM_INTENTS = frozenset({"email_draft", "call_prepare", "event_create"})


def interpret_for_act(
    command: str,
    db: Session,
    household_id: int,
    user_id: int,
    memory_lines: list[str] | None,
) -> dict[str, Any]:
    if command_wants_shopping_plan(command):
        return build_shopping_plan_response(
            command,
            db,
            household_id,
            memory_lines=memory_lines,
        )
    if command_wants_household_answer(command):
        return build_household_answer(command, db, household_id, user_id, memory_lines=memory_lines)
    return interpret_command(command, memory_lines=memory_lines)


def _proposal_str(proposal: dict[str, Any], *keys: str) -> str:
    for key in keys:
        val = proposal.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _execute_intent(
    db: Session,
    auth: AuthContext,
    command: str,
    interpreted: dict[str, Any],
) -> dict[str, Any]:
    intent = str(interpreted.get("intent") or "")
    proposal = interpreted.get("proposal") if isinstance(interpreted.get("proposal"), dict) else {}
    lowered = command.lower()

    if intent == "memory_store":
        note = _proposal_str(proposal, "note", "title") or command[:220]
        if len(note) < 3:
            return {"executed": False, "message": "Note trop courte."}
        row = HouseholdMemoryFact(household_id=auth.household_id, fact_text=note[:500])
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"executed": True, "message": "C’est noté, je m’en souviendrai.", "payload": {"fact_id": row.id}}

    if intent == "home_control":
        result = infer_and_execute_device_control(command, db=db, user_id=auth.user_id)
        status = str(result.get("status") or "")
        ok = status in {"executed", "executed_mock", "planned_integration", "connector_pending"}
        return {
            "executed": ok,
            "message": str(result.get("message") or "Action domotique traitée."),
            "payload": result,
        }

    if intent == "shopping_plan":
        plan = proposal.get("shopping_plan") if isinstance(proposal.get("shopping_plan"), dict) else {}
        ingredients = plan.get("ingredients") if isinstance(plan.get("ingredients"), list) else []
        if not ingredients:
            return {"executed": False, "message": "Aucun ingrédient à ajouter."}
        existing = (
            db.query(GroceryItem)
            .filter(GroceryItem.household_id == auth.household_id, GroceryItem.done.is_(False))
            .all()
        )
        existing_labels = {g.label.strip().lower() for g in existing}
        added: list[str] = []
        for raw in ingredients:
            if not isinstance(raw, dict):
                continue
            label = str(raw.get("label") or "").strip()
            qty = str(raw.get("qty") or "").strip()
            if not label:
                continue
            full = f"{label} ({qty})" if qty else label
            if full.lower() in existing_labels:
                continue
            item = GroceryItem(household_id=auth.household_id, label=full[:120], done=False)
            db.add(item)
            added.append(full)
            existing_labels.add(full.lower())
        if not added:
            return {"executed": True, "message": "Les ingrédients sont déjà sur ta liste de courses.", "payload": {}}
        db.commit()
        preview = ", ".join(added[:4])
        suffix = f" (+{len(added) - 4})" if len(added) > 4 else ""
        return {
            "executed": True,
            "message": f"{len(added)} ingrédient(s) ajouté(s) : {preview}{suffix}.",
            "payload": {"added_count": len(added), "labels": added},
        }

    is_grocery = intent == "grocery_add" or (
        "courses" in lowered and any(k in lowered for k in ("ajoute", "rajoute", "liste"))
    )
    if is_grocery:
        label = _proposal_str(proposal, "label", "title") or command[:80]
        if len(label) < 2:
            return {"executed": False, "message": "Libellé de course manquant."}
        existing = (
            db.query(GroceryItem)
            .filter(
                GroceryItem.household_id == auth.household_id,
                GroceryItem.done.is_(False),
            )
            .all()
        )
        if any(g.label.strip().lower() == label.lower() for g in existing):
            return {"executed": True, "message": f"« {label} » est déjà sur ta liste.", "payload": {}}
        item = GroceryItem(household_id=auth.household_id, label=label[:120], done=False)
        db.add(item)
        db.commit()
        db.refresh(item)
        return {
            "executed": True,
            "message": f"« {label} » ajouté à ta liste de courses.",
            "payload": {"grocery_item_id": item.id},
        }

    if intent == "task_create" or (
        any(k in lowered for k in ("ajoute", "rajoute", "crée", "cree")) and not is_grocery
    ):
        title = _proposal_str(proposal, "title") or command[:120]
        task = Task(
            household_id=auth.household_id,
            title=title,
            status="open",
            task_type=str(proposal.get("task_type") or "manual_task"),
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return {
            "executed": True,
            "message": f"Tâche créée : {task.title}",
            "payload": {"task_id": task.id, "title": task.title},
        }

    if intent in ("task_complete",) or "termine" in lowered:
        task_id = int(proposal.get("task_id") or 0)
        task_hint = _proposal_str(proposal, "task_title", "title")
        task = db.get(Task, task_id) if task_id > 0 else None
        if task is None or task.household_id != auth.household_id:
            q = db.query(Task).filter(Task.household_id == auth.household_id, Task.status == "open")
            if task_hint:
                hint = task_hint.lower()
                for t in q.all():
                    if hint in t.title.lower():
                        task = t
                        break
        if task and task.household_id == auth.household_id:
            task.status = "done"
            db.commit()
            return {
                "executed": True,
                "message": f"« {task.title} » est marquée terminée.",
                "payload": {"task_id": task.id},
            }
        return {"executed": False, "message": "Je n’ai pas trouvé la tâche à terminer."}

    if intent in ("task_assign",) or "assigne" in lowered:
        task_id = int(proposal.get("task_id") or 0)
        member_id = int(proposal.get("assigned_member_id") or proposal.get("member_id") or 0)
        assignee = _proposal_str(proposal, "assignee", "member_name", "assigned_to")
        task = db.get(Task, task_id) if task_id > 0 else None
        if task is None or task.household_id != auth.household_id:
            task_hint = _proposal_str(proposal, "task_title", "title")
            if task_hint:
                for t in db.query(Task).filter(Task.household_id == auth.household_id, Task.status == "open").all():
                    if task_hint.lower() in t.title.lower():
                        task = t
                        break
        if member_id <= 0 and assignee:
            name = assignee.lower()
            for m in db.query(HouseholdMember).filter(HouseholdMember.household_id == auth.household_id).all():
                if name in m.display_name.lower():
                    member_id = m.id
                    break
        if task and task.household_id == auth.household_id and member_id > 0:
            member = db.get(HouseholdMember, member_id)
            if member and member.household_id == auth.household_id:
                task.assigned_member_id = member_id
                db.commit()
                return {
                    "executed": True,
                    "message": f"« {task.title} » assignée à {member.display_name}.",
                    "payload": {"task_id": task.id, "assigned_member_id": member_id},
                }
        return {"executed": False, "message": "Assignation impossible (tâche ou membre introuvable)."}

    if intent == "event_create":
        now = utc_now_naive()
        title = _proposal_str(proposal, "title") or command[:120]
        starts_raw = _proposal_str(proposal, "starts_at")
        ends_raw = _proposal_str(proposal, "ends_at")
        starts_at = datetime.fromisoformat(starts_raw) if starts_raw else now
        ends_at = datetime.fromisoformat(ends_raw) if ends_raw else starts_at + timedelta(hours=1)
        event = CanonicalEvent(
            household_id=auth.household_id,
            title=title,
            category="general",
            starts_at=starts_at,
            ends_at=ends_at,
            timezone="Europe/Paris",
        )
        db.add(event)
        db.flush()

        ms_account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == auth.user_id,
                ConnectedAccount.provider == "microsoft_calendar",
                ConnectedAccount.status == "connected",
            )
            .first()
        )
        google_account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == auth.user_id,
                ConnectedAccount.provider == "google_calendar",
                ConnectedAccount.status == "connected",
            )
            .first()
        )
        if ms_account:
            from app.connectors.microsoft_calendar import create_microsoft_event

            result = create_microsoft_event(
                db=db,
                account=ms_account,
                title=title,
                starts_at=starts_at,
                ends_at=ends_at,
            )
            if result.ok:
                event.source_provider = "microsoft_calendar"
                event.source_event_id = str(result.payload.get("event_id") or "")
        elif google_account:
            from app.connectors.google_calendar import create_google_event

            result = create_google_event(
                db=db,
                account=google_account,
                title=title,
                starts_at=starts_at,
                ends_at=ends_at,
            )
            if result.ok:
                event.source_provider = "google_calendar"
                event.source_event_id = str(result.payload.get("event_id") or "")

        db.commit()
        db.refresh(event)
        return {
            "executed": True,
            "message": f"Événement ajouté : {title}",
            "payload": {"event_id": event.id, "title": title},
        }

    return {"executed": False, "message": interpreted.get("explanation") or "Action non exécutée côté serveur."}


def execute_agent_act(
    command: str,
    db: Session,
    auth: AuthContext,
    memory_lines: list[str] | None,
) -> dict[str, Any]:
    interpreted = interpret_for_act(command, db, auth.household_id, auth.user_id, memory_lines)
    intent = str(interpreted.get("intent") or "")
    mode = str(interpreted.get("mode") or "auto")

    if intent in _CONSULTATION_INTENTS:
        return {
            "status": "preview_only",
            "preview": interpreted,
            "message": interpreted.get("explanation"),
            "result": None,
        }
    if mode in ("confirm", "suggest") or intent in _CONFIRM_INTENTS:
        return {
            "status": "preview_only",
            "preview": interpreted,
            "message": interpreted.get("explanation"),
            "result": None,
        }
    if intent == "unknown":
        return {
            "status": "preview_only",
            "preview": interpreted,
            "message": interpreted.get("explanation"),
            "result": None,
        }

    outcome = _execute_intent(db, auth, command, interpreted)
    if outcome.get("executed"):
        return {
            "status": "completed",
            "preview": interpreted,
            "message": outcome.get("message"),
            "result": outcome.get("payload"),
        }
    return {
        "status": "preview_only",
        "preview": interpreted,
        "message": outcome.get("message"),
        "result": outcome.get("payload"),
    }
