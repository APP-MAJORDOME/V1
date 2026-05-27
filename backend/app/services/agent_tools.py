"""Définitions d'outils Alfred (Realtime + classification texte)."""

from __future__ import annotations

from typing import Any

# Outils exposés au modèle Realtime (function calling).
ALFRED_REALTIME_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "create_task",
        "description": (
            "Crée une tâche dans MajorDome. Utilise quand l'utilisateur demande d'ajouter, "
            "noter ou rappeler une chose à faire."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Titre court de la tâche"},
            },
            "required": ["title"],
        },
    },
    {
        "type": "function",
        "name": "complete_task",
        "description": "Marque une tâche existante comme terminée.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_title": {"type": "string", "description": "Titre ou extrait de la tâche"},
            },
            "required": ["task_title"],
        },
    },
    {
        "type": "function",
        "name": "assign_task",
        "description": "Assigne une tâche à un membre du foyer (prénom).",
        "parameters": {
            "type": "object",
            "properties": {
                "task_title": {"type": "string"},
                "assignee": {"type": "string", "description": "Prénom du membre"},
            },
            "required": ["task_title", "assignee"],
        },
    },
    {
        "type": "function",
        "name": "create_event",
        "description": (
            "Ajoute un événement à l'agenda (rendez-vous, activité, créneau). "
            "starts_at / ends_at au format ISO 8601 si connus, sinon laisser vides."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "starts_at": {"type": "string", "description": "ISO 8601 optionnel"},
                "ends_at": {"type": "string", "description": "ISO 8601 optionnel"},
            },
            "required": ["title"],
        },
    },
    {
        "type": "function",
        "name": "add_grocery_item",
        "description": "Ajoute un article à la liste de courses.",
        "parameters": {
            "type": "object",
            "properties": {
                "label": {"type": "string", "description": "Nom de l'article"},
            },
            "required": ["label"],
        },
    },
    {
        "type": "function",
        "name": "remember_note",
        "description": "Mémorise une information pour les prochaines conversations (préférences, allergies, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "note": {"type": "string"},
            },
            "required": ["note"],
        },
    },
]

INTENT_SYSTEM_SUFFIX = (
    "intent must be one of: "
    "task_create, task_complete, task_assign, event_create, grocery_add, "
    "email_draft, call_prepare, opportunity_search, planning, memory_store. "
    "For task_create proposal needs title. "
    "For event_create proposal needs title and optionally starts_at, ends_at (ISO 8601). "
    "For task_assign proposal needs task_title and assignee. "
    "For task_complete proposal needs task_title. "
    "For grocery_add proposal needs label. "
    "For memory_store proposal needs note. "
    "Use mode auto when the user clearly wants the action done now."
)


def realtime_tool_to_intent(name: str, args: dict[str, Any]) -> dict[str, Any] | None:
    """Convertit un appel d'outil Realtime en payload AgentInterpretResponse."""
    title = str(args.get("title") or "").strip()
    if name == "create_task" and title:
        return {
            "intent": "task_create",
            "mode": "auto",
            "proposal": {"title": title},
            "explanation": "",
        }
    if name == "complete_task":
        task_title = str(args.get("task_title") or "").strip()
        if task_title:
            return {
                "intent": "task_complete",
                "mode": "auto",
                "proposal": {"task_title": task_title},
                "explanation": "",
            }
    if name == "assign_task":
        task_title = str(args.get("task_title") or "").strip()
        assignee = str(args.get("assignee") or "").strip()
        if task_title and assignee:
            return {
                "intent": "task_assign",
                "mode": "auto",
                "proposal": {"task_title": task_title, "assignee": assignee},
                "explanation": "",
            }
    if name == "create_event" and title:
        proposal: dict[str, Any] = {"title": title}
        for k in ("starts_at", "ends_at"):
            v = str(args.get(k) or "").strip()
            if v:
                proposal[k] = v
        return {
            "intent": "event_create",
            "mode": "auto",
            "proposal": proposal,
            "explanation": "",
        }
    if name == "add_grocery_item":
        label = str(args.get("label") or "").strip()
        if label:
            return {
                "intent": "grocery_add",
                "mode": "auto",
                "proposal": {"label": label, "title": label},
                "explanation": "",
            }
    if name == "remember_note":
        note = str(args.get("note") or "").strip()
        if note:
            return {
                "intent": "memory_store",
                "mode": "auto",
                "proposal": {"note": note},
                "explanation": "",
            }
    return None
