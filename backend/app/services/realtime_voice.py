from __future__ import annotations

import json
from urllib.parse import urljoin

import httpx

from app.core.config import settings
from app.services.agent_tools import ALFRED_REALTIME_TOOLS


class RealtimeVoiceError(Exception):
    pass


def _sdp_to_crlf(raw: str, error_prefix: str) -> str:
    """SDP RFC 4566 : CRLF final ; ne pas strip() les lignes (continuations « ligne précédente »)."""
    text = raw.strip().replace("\ufeff", "")
    idx = text.find("v=0")
    if idx < 0:
        raise RealtimeVoiceError(f"{error_prefix} SDP invalide (pas de ligne v=0).")
    text = text[idx:]
    lines: list[str] = []
    for line in text.splitlines():
        line = line.rstrip("\r")
        if line:
            lines.append(line)
    if not lines or not lines[0].startswith("v=0"):
        raise RealtimeVoiceError(f"{error_prefix} SDP vide ou mal formé.")
    return "\r\n".join(lines) + "\r\n"


def build_alfred_realtime_instructions(
    assistant_name: str,
    household_memory: list[str],
    extra_notes: list[str],
) -> str:
    base = (
        f"Tu es {assistant_name}, l’assistant familial de l’application MajorDome (MAJORDOME). "
        "Tu réponds en français, naturellement, avec une voix claire et bienveillante. "
        "Tu aides au quotidien : tâches, agenda, liste de courses, organisation du foyer. "
        "Quand l’utilisateur demande une action concrète (créer une tâche, un événement, ajouter aux courses, "
        "assigner ou terminer une tâche, mémoriser une info), appelle immédiatement l’outil adapté — "
        "ne te contente pas d’expliquer comment faire. "
        "Pour une info à jour sur Internet (météo, actualité, horaires, prix, définition), utilise search_web. "
        "Pour le coffre, les factures, le budget, les tâches ou l’agenda déjà dans MajorDome, utilise consult_household. "
        "Après l’exécution, confirme brièvement à l’oral ce qui a été fait."
    )
    lines: list[str] = []
    if household_memory:
        lines.append("Contexte foyer (mémoire persistée du foyer — respecter si pertinent) :")
        lines.extend(f"- {m[:400]}" for m in household_memory[:28])
    if extra_notes:
        lines.append(f"Notes locales que {assistant_name} doit garder en tête :")
        lines.extend(f"- {n[:400]}" for n in extra_notes[:16])
    if not lines:
        return base[:32000]
    return (base + "\n\n" + "\n".join(lines))[:32000]


def exchange_realtime_webrtc_sdp(sdp_offer: str, instructions: str) -> str:
    if not settings.llm_api_key or not settings.llm_api_key.strip():
        raise RealtimeVoiceError("Clé API OpenAI absente (MAJORDOME_LLM_API_KEY).")

    sdp_offer_norm = _sdp_to_crlf(sdp_offer, "Offer navigateur :")

    base = settings.llm_base_url.rstrip("/") + "/"
    url = urljoin(base, "realtime/calls")

    # Format minimal aligné sur le guide WebRTC OpenAI (évite les rejets si la forme « input.transcription » diffère).
    session_payload: dict = {
        "type": "realtime",
        "model": settings.llm_realtime_model,
        "instructions": instructions,
        "audio": {"output": {"voice": settings.llm_realtime_voice}},
        "tools": ALFRED_REALTIME_TOOLS,
        "tool_choice": "auto",
    }

    session_json = json.dumps(session_payload, ensure_ascii=False)

    headers = {"Authorization": f"Bearer {settings.llm_api_key.strip()}"}

    # Ordre des parties multipart : sdp puis session (comme fd.set dans la doc OpenAI).
    multipart_files: list[tuple[str, tuple[str | None, str | bytes, str | None]]] = [
        ("sdp", (None, sdp_offer_norm, "application/sdp")),
        ("session", (None, session_json, "application/json")),
    ]

    try:
        with httpx.Client(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
            response = client.post(url, headers=headers, files=multipart_files)
    except httpx.RequestError as exc:
        raise RealtimeVoiceError(f"Réseau vers OpenAI Realtime: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text.strip()[:1200] or response.reason_phrase
        raise RealtimeVoiceError(f"OpenAI Realtime ({response.status_code}): {detail}")

    answer = response.text.strip()
    if not answer:
        raise RealtimeVoiceError("Réponse SDP vide d’OpenAI Realtime.")
    try:
        return _sdp_to_crlf(answer, "Réponse OpenAI :")
    except RealtimeVoiceError:
        raise
    except Exception as exc:
        raise RealtimeVoiceError(f"Normalisation SDP impossible: {exc}") from exc
