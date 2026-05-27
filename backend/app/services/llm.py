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
