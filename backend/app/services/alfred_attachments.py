"""Analyse de pièces jointes pour Alfred (images, PDF, DOCX, texte)."""

from __future__ import annotations

import base64
import logging
import re
from io import BytesIO
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ALFRED_ATTACHMENT_MIME = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }
)

_EXTENSION_MIME: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}

_IMAGE_MIME = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})

_DEFAULT_COMMAND = (
    "Analyse ce fichier et résume ce qui est important pour une famille. "
    "Propose des actions concrètes dans MajorDome si c’est pertinent (tâches, rappels, agenda)."
)


def resolve_attachment_mime(filename: str, content_type: str | None) -> str:
    ctype = (content_type or "").split(";")[0].strip().lower()
    if ctype in ALFRED_ATTACHMENT_MIME:
        return ctype
    ext = ""
    if filename and "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    return _EXTENSION_MIME.get(ext, ctype or "application/octet-stream")


def _truncate(text: str, limit: int = 12_000) -> str:
    t = re.sub(r"\n{3,}", "\n\n", text.strip())
    if len(t) <= limit:
        return t
    return t[: limit - 3].rstrip() + "…"


def extract_pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore[import-untyped]
    except ImportError:
        return ""
    try:
        reader = PdfReader(BytesIO(data))
        parts: list[str] = []
        for page in reader.pages[:40]:
            parts.append((page.extract_text() or "").strip())
        return "\n\n".join(p for p in parts if p)
    except Exception as exc:
        logger.warning("PDF extract failed: %s", exc)
        return ""


def extract_docx_text(data: bytes) -> str:
    try:
        from docx import Document  # type: ignore[import-untyped]
    except ImportError:
        return ""
    try:
        doc = Document(BytesIO(data))
        return "\n".join(p.text.strip() for p in doc.paragraphs if p.text and p.text.strip())
    except Exception as exc:
        logger.warning("DOCX extract failed: %s", exc)
        return ""


def extract_plain_text(data: bytes) -> str:
    for enc in ("utf-8", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return ""


def extract_document_text(data: bytes, mime: str, filename: str) -> tuple[str, str | None]:
    """Retourne (texte, erreur optionnelle)."""
    if mime in _IMAGE_MIME:
        return "", None
    if mime == "application/pdf":
        text = extract_pdf_text(data)
        if text.strip():
            return text, None
        return "", "Le PDF ne contient pas de texte lisible. Envoie une photo du document si besoin."
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        text = extract_docx_text(data)
        if text.strip():
            return text, None
        return "", "Impossible de lire ce fichier Word."
    if mime == "application/msword":
        return "", "Les fichiers .doc anciens ne sont pas supportés. Enregistre en PDF ou DOCX."
    if mime == "text/plain":
        text = extract_plain_text(data)
        if text.strip():
            return text, None
        return "", "Fichier texte vide."
    return "", "Type de fichier non pris en charge."


def _memory_block(memory_lines: list[str] | None) -> str:
    if not memory_lines:
        return ""
    cleaned = [str(m).strip() for m in memory_lines if str(m).strip()][:20]
    if not cleaned:
        return ""
    return "\n".join(f"- {c[:200]}" for c in cleaned)[:2000]


def _answer_with_openai_vision(
    data: bytes,
    mime: str,
    question: str,
    memory_lines: list[str] | None,
) -> str | None:
    if settings.llm_provider.lower() not in {"openai", "chatgpt"} or not settings.llm_api_key:
        return None
    b64 = base64.standard_b64encode(data).decode("ascii")
    mem = _memory_block(memory_lines)
    system = (
        "Tu es Alfred, l’assistant familial MajorDome. L’utilisateur envoie une image ou un scan. "
        "Décris et analyse le contenu en français de façon utile au quotidien (factures, courriers, "
        "listes, emploi du temps, menus…). Ne cite pas de technologies internes."
    )
    if mem:
        system += f"\n\nContexte foyer :\n{mem}"
    user_parts: list[dict[str, Any]] = [
        {"type": "text", "text": question},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
    ]
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_parts},
        ],
        "temperature": 0.35,
        "max_tokens": 900,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    try:
        with httpx.Client(timeout=55) as client:
            response = client.post(f"{settings.llm_base_url}/chat/completions", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Vision analyze failed: %s", exc)
        return None
    choices = payload.get("choices") or []
    if not choices:
        return None
    text = (choices[0].get("message") or {}).get("content") or ""
    return str(text).strip()[:4000] or None


def _answer_with_openai_text(
    document_text: str,
    filename: str,
    question: str,
    memory_lines: list[str] | None,
) -> str | None:
    if settings.llm_provider.lower() not in {"openai", "chatgpt"} or not settings.llm_api_key:
        return None
    mem = _memory_block(memory_lines)
    system = (
        "Tu es Alfred, l’assistant familial MajorDome. Tu réponds en français à partir du document fourni. "
        "Sois clair et actionnable. Ne mentionne pas de fournisseurs techniques."
    )
    if mem:
        system += f"\n\nContexte foyer :\n{mem}"
    user = (
        f"Fichier : {filename}\n\n"
        f"Question : {question}\n\n"
        f"Contenu extrait :\n{_truncate(document_text, 10_000)}"
    )
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.35,
        "max_tokens": 900,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(f"{settings.llm_base_url}/chat/completions", json=body, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Document text analyze failed: %s", exc)
        return None
    choices = payload.get("choices") or []
    if not choices:
        return None
    text = (choices[0].get("message") or {}).get("content") or ""
    return str(text).strip()[:4000] or None


def _fallback_text_answer(document_text: str, filename: str, question: str) -> str:
    excerpt = _truncate(document_text, 2500)
    return (
        f"Voici un extrait de « {filename} » (analyse automatique limitée sans assistant IA configuré) :\n\n"
        f"{excerpt}\n\n"
        f"Ta question : {question}"
    )


def analyze_alfred_attachment(
    data: bytes,
    mime: str,
    filename: str,
    command: str,
    memory_lines: list[str] | None = None,
) -> dict[str, Any]:
    question = (command or "").strip() or _DEFAULT_COMMAND
    safe_name = (filename or "fichier").replace("\x00", "")[:255]

    if mime in _IMAGE_MIME:
        explanation = _answer_with_openai_vision(data, mime, question, memory_lines)
        if not explanation:
            explanation = (
                "Pour analyser une photo, configure une clé d’assistant IA sur le serveur "
                "(MAJORDOME_LLM_API_KEY). Tu peux aussi décrire ta question en texte."
            )
        return {
            "intent": "document_analyze",
            "mode": "auto",
            "proposal": {
                "file_name": safe_name,
                "mime": mime,
                "kind": "image",
            },
            "explanation": explanation,
        }

    doc_text, err = extract_document_text(data, mime, safe_name)
    if err:
        return {
            "intent": "document_analyze",
            "mode": "suggest",
            "proposal": {"file_name": safe_name, "mime": mime, "error": err},
            "explanation": err,
        }

    explanation = _answer_with_openai_text(doc_text, safe_name, question, memory_lines)
    if not explanation:
        explanation = _fallback_text_answer(doc_text, safe_name, question)

    preview = _truncate(doc_text, 600)
    return {
        "intent": "document_analyze",
        "mode": "auto",
        "proposal": {
            "file_name": safe_name,
            "mime": mime,
            "kind": "document",
            "text_preview": preview,
        },
        "explanation": explanation,
    }
