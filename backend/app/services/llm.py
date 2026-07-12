from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services.agent_tools import INTENT_SYSTEM_SUFFIX

logger = logging.getLogger(__name__)


def _extract_json_payload(content: str) -> dict[str, Any] | None:
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    raw = content[start : end + 1]
    try:
        import json

        payload = json.loads(raw)
        if isinstance(payload, dict):
            return payload
    except Exception:
        return None
    return None


def interpret_with_openai(command: str, memory_facts: list[str] | None = None) -> dict[str, Any] | None:
    if settings.llm_provider.lower() not in {"openai", "chatgpt"}:
        return None
    if not settings.llm_api_key:
        return None

    system_prompt = (
        "You are MajorDome assistant. Classify a French user command and return only a JSON object "
        "with keys: intent, mode, proposal, explanation. "
        + INTENT_SYSTEM_SUFFIX
        + " "
        "mode in [auto, confirm, suggest]. "
        "proposal must be an object with useful actionable fields. "
        "explanation must be short in French."
    )
    if memory_facts:
        cleaned = [str(m).strip() for m in memory_facts if str(m).strip()][:28]
        if cleaned:
            block = "\n".join(f"- {c[:220]}" for c in cleaned)[:2800]
            system_prompt += (
                "\n\nPersistent household context (trust when relevant; respect privacy):\n" + block
            )
    user_prompt = f"Commande utilisateur: {command}"
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(f"{settings.llm_base_url}/chat/completions", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("OpenAI interpret HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        return None
    except Exception as exc:
        logger.warning("OpenAI interpret failed: %s", exc)
        return None

    choices = payload.get("choices") or []
    if not choices:
        logger.warning("OpenAI interpret: empty choices")
        return None
    message = choices[0].get("message") or {}
    content = message.get("content") or ""
    parsed = _extract_json_payload(content)
    if not parsed:
        logger.warning("OpenAI interpret: JSON parse failed")
        return None
    if not isinstance(parsed.get("proposal"), dict):
        parsed["proposal"] = {}
    if not parsed.get("intent"):
        parsed["intent"] = "task_create"
    if not parsed.get("mode"):
        parsed["mode"] = "suggest"
    if not parsed.get("explanation"):
        parsed["explanation"] = "Commande interpretee par l assistant IA."
    return parsed


def interpret_with_anthropic(command: str, memory_facts: list[str] | None = None) -> dict[str, Any] | None:
    if settings.llm_provider.lower() not in {"anthropic", "claude"}:
        return None
    if not settings.llm_api_key:
        return None

    system_prompt = (
        "You are MajorDome assistant. Classify a French user command and return only a JSON object "
        "with keys: intent, mode, proposal, explanation. "
        + INTENT_SYSTEM_SUFFIX
        + " "
        "mode in [auto, confirm, suggest]. "
        "proposal must be an object with useful actionable fields. "
        "explanation must be short in French."
    )
    if memory_facts:
        cleaned = [str(m).strip() for m in memory_facts if str(m).strip()][:28]
        if cleaned:
            block = "\n".join(f"- {c[:220]}" for c in cleaned)[:2800]
            system_prompt += (
                "\n\nPersistent household context (trust when relevant; respect privacy):\n" + block
            )
    body = {
        "model": settings.llm_model,
        "max_tokens": 500,
        "temperature": 0.2,
        "system": system_prompt,
        "messages": [{"role": "user", "content": f"Commande utilisateur: {command}"}],
    }
    headers = {
        "x-api-key": settings.llm_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(f"{settings.llm_base_url}/messages", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    content_items = payload.get("content") or []
    text = ""
    if content_items and isinstance(content_items, list):
        text = str(content_items[0].get("text") or "")
    parsed = _extract_json_payload(text)
    if not parsed:
        return None
    if not isinstance(parsed.get("proposal"), dict):
        parsed["proposal"] = {}
    if not parsed.get("intent"):
        parsed["intent"] = "task_create"
    if not parsed.get("mode"):
        parsed["mode"] = "suggest"
    if not parsed.get("explanation"):
        parsed["explanation"] = "Commande interpretee par l assistant IA."
    return parsed


def synthesize_web_answer(
    query: str,
    sources: list[dict[str, str]],
    memory_facts: list[str] | None = None,
) -> str | None:
    """Synthétise une réponse française à partir de résultats web."""
    if settings.llm_provider.lower() not in {"openai", "chatgpt", "anthropic", "claude"}:
        return None
    if not settings.llm_api_key:
        return None

    source_lines: list[str] = []
    for i, src in enumerate(sources[:6], start=1):
        title = str(src.get("title") or "Sans titre").strip()
        snippet = str(src.get("snippet") or "").strip()
        url = str(src.get("url") or "").strip()
        block = f"[{i}] {title}"
        if snippet:
            block += f"\n{snippet[:400]}"
        if url:
            block += f"\n{url}"
        source_lines.append(block)
    sources_block = "\n\n".join(source_lines) if source_lines else "(aucun extrait web)"

    system_prompt = (
        "Tu es Alfred, l’assistant familial de MajorDome. L’utilisateur pose une question ; "
        "tu réponds en français, de façon claire et utile, en t’appuyant UNIQUEMENT sur les extraits web fournis. "
        "Si les sources sont insuffisantes ou contradictoires, dis-le honnêtement. "
        "Ne mentionne pas de fournisseurs techniques (OpenAI, API, modèle, RAG). "
        "Réponse concise (3 à 8 phrases), sans lister toutes les URLs dans le corps du texte."
    )
    if memory_facts:
        cleaned = [str(m).strip() for m in memory_facts if str(m).strip()][:12]
        if cleaned:
            block = "\n".join(f"- {c[:180]}" for c in cleaned)[:1200]
            system_prompt += f"\n\nContexte foyer (si pertinent) :\n{block}"

    user_prompt = f"Question : {query}\n\nExtraits web :\n{sources_block}"

    if settings.llm_provider.lower() in {"openai", "chatgpt"}:
        body = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.35,
        }
        headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        url = f"{settings.llm_base_url}/chat/completions"
    else:
        body = {
            "model": settings.llm_model,
            "max_tokens": 700,
            "temperature": 0.35,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        headers = {
            "x-api-key": settings.llm_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        url = f"{settings.llm_base_url}/messages"

    try:
        with httpx.Client(timeout=35) as client:
            response = client.post(url, json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Web answer synthesis failed: %s", exc)
        return None

    if settings.llm_provider.lower() in {"openai", "chatgpt"}:
        choices = payload.get("choices") or []
        if not choices:
            return None
        text = (choices[0].get("message") or {}).get("content") or ""
    else:
        content_items = payload.get("content") or []
        text = ""
        if content_items and isinstance(content_items, list):
            text = str(content_items[0].get("text") or "")
    text = str(text).strip()
    return text[:4000] if text else None


def _debordee_system(primary: str, partner: str, child: str) -> str:
    return (
        f"You are Alfred, household assistant for {primary}. Partner: {partner}, child: {child}. "
        "The user is overwhelmed and needs ruthless triage. Reply with ONLY a JSON object (no markdown) "
        'with keys: "critique" (array of strings, must-do today only, max 5), '
        '"deleguer" (array of strings like "task title:{partner}" or "task title:Léa" when child-appropriate, max 8), '
        '"supprimer" (array of strings: defer/skip for now, max 15), '
        '"message" (one short supportive sentence in French, max 25 words). '
        "Use French task titles as given by the user."
    )


def debordee_with_openai(user_prompt: str, primary: str, partner: str, child: str) -> dict[str, Any] | None:
    if settings.llm_provider.lower() not in {"openai", "chatgpt"}:
        return None
    if not settings.llm_api_key:
        return None
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": _debordee_system(primary, partner, child)},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.25,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(f"{settings.llm_base_url}/chat/completions", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None
    choices = payload.get("choices") or []
    if not choices:
        return None
    content = (choices[0].get("message") or {}).get("content") or ""
    return _extract_json_payload(content)


def answer_household_question(
    command: str,
    household_context: str,
    memory_facts: list[str] | None = None,
) -> str | None:
    """Réponse Alfred à partir des données du foyer (coffre, budget, tâches…)."""
    if settings.llm_provider.lower() not in {"openai", "chatgpt", "anthropic", "claude"}:
        return None
    if not settings.llm_api_key:
        return None

    system_prompt = (
        "Tu es Alfred, le majordome familial de MajorDome. L’utilisateur te pose une question "
        "ou demande un avis sur sa vie du foyer. Tu réponds en français, de façon naturelle, "
        "précise et utile, en t’appuyant UNIQUEMENT sur le contexte applicatif fourni ci-dessous "
        "(tâches, agenda, coffre documents, extraits de fichiers, budget, courses, frigo, mémoire). "
        "Si une info manque (ex. pas de document, budget vide), dis-le clairement et propose "
        "une action concrète (déposer le fichier dans le Coffre, renseigner le budget…). "
        "Pour les achats coûteux ou le budget : sois honnête et bienveillant — compare dépenses "
        "et plafonds des enveloppes ; tu peux déconseiller ou suggérer d’attendre / épargner / crédit "
        "sans être moralisateur. Ne cite pas de technologies internes (API, modèle, RAG). "
        "Réponse en 3 à 12 phrases selon la complexité."
    )
    if memory_facts:
        cleaned = [str(m).strip() for m in memory_facts if str(m).strip()][:12]
        if cleaned:
            block = "\n".join(f"- {c[:180]}" for c in cleaned)[:1200]
            system_prompt += f"\n\nMémoire foyer (rappels) :\n{block}"

    user_prompt = (
        f"Question utilisateur : {command.strip()}\n\n"
        f"Données MajorDome du foyer :\n{household_context[:12000]}"
    )

    if settings.llm_provider.lower() in {"openai", "chatgpt"}:
        body = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.35,
            "max_tokens": 900,
        }
        headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        try:
            with httpx.Client(timeout=45) as client:
                response = client.post(
                    f"{settings.llm_base_url}/chat/completions", json=body, headers=headers
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            logger.warning("Household answer OpenAI failed: %s", exc)
            return None
        choices = payload.get("choices") or []
        if not choices:
            return None
        text = (choices[0].get("message") or {}).get("content") or ""
        return str(text).strip()[:4000] or None

    body = {
        "model": settings.llm_model,
        "max_tokens": 900,
        "temperature": 0.35,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    headers = {
        "x-api-key": settings.llm_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(f"{settings.llm_base_url}/messages", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Household answer Anthropic failed: %s", exc)
        return None
    content_items = payload.get("content") or []
    text = ""
    if content_items and isinstance(content_items, list):
        text = str(content_items[0].get("text") or "")
    return str(text).strip()[:4000] or None


def debordee_with_anthropic(user_prompt: str, primary: str, partner: str, child: str) -> dict[str, Any] | None:
    if settings.llm_provider.lower() not in {"anthropic", "claude"}:
        return None
    if not settings.llm_api_key:
        return None
    body = {
        "model": settings.llm_model,
        "max_tokens": 1200,
        "temperature": 0.25,
        "system": _debordee_system(primary, partner, child),
        "messages": [{"role": "user", "content": user_prompt}],
    }
    headers = {
        "x-api-key": settings.llm_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(f"{settings.llm_base_url}/messages", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None
    content_items = payload.get("content") or []
    text = ""
    if content_items and isinstance(content_items, list):
        text = str(content_items[0].get("text") or "")
    return _extract_json_payload(text)


def compose_shopping_plan(
    command: str,
    household_context: str,
    stores: list[str],
    web_sources: list[dict[str, str]],
    memory_facts: list[str] | None = None,
) -> dict[str, Any] | None:
    """Compose une recette + liste de courses avec estimations de prix (JSON)."""
    if settings.llm_provider.lower() not in {"openai", "chatgpt", "anthropic", "claude"}:
        return None
    if not settings.llm_api_key:
        return None

    store_block = ", ".join(stores) if stores else "Carrefour ou Marché U (au choix)"
    source_lines: list[str] = []
    for i, src in enumerate(web_sources[:6], start=1):
        title = str(src.get("title") or "Sans titre").strip()
        snippet = str(src.get("snippet") or "").strip()
        source_lines.append(f"[{i}] {title}\n{snippet[:350]}")
    web_block = "\n\n".join(source_lines) if source_lines else "(aucun extrait web fiable)"

    system_prompt = (
        "Tu es Alfred, majordome familial de MajorDome. L’utilisateur demande une recette, "
        "un plan de courses ou des idées selon les promos des enseignes (Carrefour, Marché U, etc.). "
        "Réponds UNIQUEMENT avec un objet JSON (sans markdown) avec les clés : "
        '"recipe_title" (string), "servings" (int), "mood_note" (string courte — lien humeur/envie), '
        '"ingredients" (array de {label, qty, price_eur number, on_promo bool, store_hint}), '
        '"total_eur" (number, somme indicative), "promo_tips" (array de strings), '
        '"message" (string, 4-10 phrases en français résumant la proposition). '
        "Adapte au contexte foyer (budget, liste courses, frigo, humeur). "
        "Prix en euros France métropolitaine, estimations réalistes 2025-2026. "
        "Si les promos web sont incertaines, indique-le dans promo_tips et reste prudent. "
        "Pas de mention de technologies internes."
    )
    if memory_facts:
        cleaned = [str(m).strip() for m in memory_facts if str(m).strip()][:10]
        if cleaned:
            system_prompt += "\n\nMémoire foyer :\n" + "\n".join(f"- {c[:180]}" for c in cleaned)

    user_prompt = (
        f"Demande : {command.strip()}\n"
        f"Enseignes ciblées : {store_block}\n\n"
        f"Contexte MajorDome :\n{household_context[:10000]}\n\n"
        f"Extraits web promos / recettes :\n{web_block}"
    )

    if settings.llm_provider.lower() in {"openai", "chatgpt"}:
        body = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.45,
            "max_tokens": 1400,
        }
        headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        try:
            with httpx.Client(timeout=50) as client:
                response = client.post(
                    f"{settings.llm_base_url}/chat/completions", json=body, headers=headers
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            logger.warning("Shopping plan OpenAI failed: %s", exc)
            return None
        choices = payload.get("choices") or []
        if not choices:
            return None
        content = (choices[0].get("message") or {}).get("content") or ""
        return _extract_json_payload(str(content))

    body = {
        "model": settings.llm_model,
        "max_tokens": 1400,
        "temperature": 0.45,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    headers = {
        "x-api-key": settings.llm_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        with httpx.Client(timeout=50) as client:
            response = client.post(f"{settings.llm_base_url}/messages", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Shopping plan Anthropic failed: %s", exc)
        return None
    content_items = payload.get("content") or []
    text = ""
    if content_items and isinstance(content_items, list):
        text = str(content_items[0].get("text") or "")
    return _extract_json_payload(text)


def analyze_salon_with_openai(messages: list[Any]) -> list[dict[str, Any]] | None:
    """Extrait des captures JSON depuis les derniers messages du salon."""
    if settings.llm_provider.lower() not in {"openai", "chatgpt"}:
        return None
    if not settings.llm_api_key or not messages:
        return None

    lines = []
    for m in messages[-20:]:
        label = getattr(m, "author_label", None) or "Membre"
        body = getattr(m, "body_text", None) or ""
        lines.append(f"{label}: {body}")
    transcript = "\n".join(lines)[:4000]
    system_prompt = (
        "Tu analyses UNE conversation familiale en français. "
        "Retourne UNIQUEMENT un JSON {\"captures\": [...]} (max 2). Chaque capture: "
        "kind (event_proposal|task_proposal|reminder|suggestion), chip (today|famille|foyer), "
        "source_label, excerpt (citation EXACTE d'un message), inferences (liste), "
        "cta_primary, cta_secondary, payload {intent, proposal{title|label, when?, assignee?}, structured{type,title,when?,assignee?}}. "
        "Règles: 1 capture = 1 message source. Ne mélange jamais un message Toussaint avec un RDV dentiste. "
        "Pain/courses → grocery_add. Poubelles/ménage → task_create. Vacances/Toussaint → suggestion. "
        "Ignore les messages Alfred, Proposition, [[cap:…]] et briefings."
    )
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Conversation:\n{transcript}"},
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    try:
        with httpx.Client(timeout=25) as client:
            response = client.post(f"{settings.llm_base_url}/chat/completions", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
        choices = payload.get("choices") or []
        content = (choices[0].get("message") or {}).get("content") if choices else ""
        parsed = _extract_json_payload(str(content))
        if not parsed:
            return None
        caps = parsed.get("captures")
        if isinstance(caps, list):
            return [c for c in caps if isinstance(c, dict)]
    except Exception as exc:
        logger.warning("Salon analyze LLM failed: %s", exc)
    return None

