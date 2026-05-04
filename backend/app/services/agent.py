from typing import Any
from app.services.llm import (
    debordee_with_anthropic,
    debordee_with_openai,
    interpret_with_anthropic,
    interpret_with_openai,
)


def _normalize_debordee(raw: dict[str, Any], partner_name: str) -> dict[str, Any]:
    def _as_str_list(key: str) -> list[str]:
        v = raw.get(key)
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if str(x).strip()]

    msg = raw.get("message")
    if not isinstance(msg, str) or not msg.strip():
        msg = "Garde l'essentiel, délègue le reste. Respire, tu gères 💪"
    return {
        "critique": _as_str_list("critique")[:8],
        "deleguer": _as_str_list("deleguer")[:12],
        "supprimer": _as_str_list("supprimer")[:25],
        "message": msg.strip()[:400],
    }


def analyze_debordee(
    task_titles: list[str],
    primary_name: str,
    partner_name: str,
    child_name: str,
    memory_lines: list[str] | None = None,
) -> dict[str, Any]:
    titles = [t.strip() for t in task_titles if t and str(t).strip()][:60]
    bullet = "\n".join(f"- {t}" for t in titles) or "- (aucune tâche en liste)"
    memory_prefix = ""
    if memory_lines:
        ml = [str(m).strip() for m in memory_lines if str(m).strip()][:30]
        if ml:
            mb = "\n".join(f"- {x[:220]}" for x in ml)[:2800]
            memory_prefix = f"Contexte foyer mémorisé (persistant):\n{mb}\n\n"
    user_prompt = (
        memory_prefix
        + f"{primary_name} est complètement débordée. Objectif: ne garder que l'essentiel pour AUJOURD'HUI.\n"
        f"Partenaire à qui déléguer: {partner_name}. Enfant: {child_name}.\n\n"
        f"Liste complète des tâches ouvertes:\n{bullet}\n\n"
        "Classe chaque tâche dans critique, deleguer (format 'titre:Prénom'), ou supprimer (reporter / pas urgent)."
    )
    parsed = debordee_with_openai(user_prompt, primary_name, partner_name, child_name)
    if not parsed:
        parsed = debordee_with_anthropic(user_prompt, primary_name, partner_name, child_name)
    if parsed and isinstance(parsed, dict):
        return _normalize_debordee(parsed, partner_name)
    if not titles:
        return {
            "critique": [],
            "deleguer": [],
            "supprimer": [],
            "message": "Ta liste est vide — prends un moment pour toi.",
        }
    critique = titles[:2]
    deleguer = [f"{t}:{partner_name}" for t in titles[2:5]]
    supprimer = titles[5:]
    return {
        "critique": critique,
        "deleguer": deleguer,
        "supprimer": supprimer,
        "message": f"{primary_name}, j'ai isolé l'urgent et proposé du relais vers {partner_name}. On avance étape par étape.",
    }


def interpret_command(command: str, memory_lines: list[str] | None = None) -> dict[str, Any]:
    llm_result = interpret_with_openai(command, memory_facts=memory_lines)
    if not llm_result:
        llm_result = interpret_with_anthropic(command, memory_facts=memory_lines)
    if llm_result:
        return llm_result

    lowered = command.lower()
    if "mail" in lowered or "email" in lowered:
        return {
            "intent": "email_draft",
            "mode": "confirm",
            "proposal": {
                "subject": "Sujet à confirmer",
                "body": f"Bonjour,\n\nJe vous contacte au sujet de: {command}\n\nCordialement"
            },
            "explanation": "Commande orientée communication détectée."
        }
    if "appelle" in lowered or "appel" in lowered:
        return {
            "intent": "call_prepare",
            "mode": "confirm",
            "proposal": {
                "contact_lookup": True,
                "web_lookup_if_missing": True,
                "script": f"Bonjour, je vous appelle concernant: {command}"
            },
            "explanation": "Commande orientée appel détectée."
        }
    if "aide" in lowered or "prime" in lowered or "veille" in lowered:
        return {
            "intent": "opportunity_search",
            "mode": "suggest",
            "proposal": {
                "saved_search": command,
                "schedule": "daily"
            },
            "explanation": "Commande orientée veille/opportunité détectée."
        }
    return {
        "intent": "task_create",
        "mode": "auto",
        "proposal": {
            "title": command,
            "task_type": "manual_task"
        },
        "explanation": "Commande interprétée comme tâche."
    }
