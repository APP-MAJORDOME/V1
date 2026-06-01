"""Alfred : réponses contextualisées à partir des données MajorDome du foyer."""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.dt import utc_now_naive
from app.models.models import (
    CanonicalEvent,
    GroceryItem,
    HouseholdBudgetEnvelope,
    HouseholdDocument,
    HouseholdFridgeItem,
    JournalEntry,
    Task,
)
from app.services import document_attachments as doc_attach
from app.services.alfred_attachments import (
    _IMAGE_MIME,
    _answer_with_openai_vision,
    extract_document_text,
    resolve_attachment_mime,
)
from app.core.config import settings
from app.services.llm import answer_household_question

logger = logging.getLogger(__name__)


def _household_llm_available() -> bool:
    provider = settings.llm_provider.lower()
    if provider not in {"openai", "chatgpt", "anthropic", "claude"}:
        return False
    return bool(settings.llm_api_key and settings.llm_api_key.strip())


def _parse_budget_totals(context: str) -> tuple[int | None, int | None]:
    m = re.search(r"Total budget foyer : dépensé (\d+) / plafond (\d+)", context)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


def _fallback_household_answer(
    command: str,
    context: str,
    doc_excerpts: list[dict[str, Any]],
    *,
    llm_unavailable: bool,
) -> str:
    """Réponse de repli sans LLM (ou si l’appel IA a échoué)."""
    lowered = _normalize_text(command)
    parts: list[str] = []

    if llm_unavailable:
        parts.append(
            "Je réponds à partir des données de ton espace MajorDome "
            "(l’assistant IA avancé n’est pas disponible sur le serveur pour l’instant)."
        )

    spent, cap = _parse_budget_totals(context)
    budget_empty = "Budget : pas d'enveloppes renseignées." in context
    vault_empty = "Coffre documents : vide." in context

    purchase_q = any(
        k in lowered
        for k in (
            "ferrari",
            "voiture",
            "acheter",
            "achat",
            "puis je",
            "peux je",
            "moyens",
            "budget",
            "me permet",
        )
    )
    if purchase_q:
        if budget_empty:
            parts.append(
                "Ton budget n’a pas encore d’enveloppes renseignées — "
                "je ne peux pas estimer ce qu’il te reste."
            )
            parts.append("Ouvre l’onglet Budget pour saisir plafonds et dépenses, puis redemande-moi.")
        elif spent is not None and cap is not None:
            remaining = max(0, cap - spent)
            parts.append(
                f"Budget foyer (indicatif) : {spent} € dépensés sur {cap} € de plafond "
                f"({remaining} € restants sur l’ensemble des enveloppes)."
            )
            if "ferrari" in lowered or ("voiture" in lowered and "ferrari" not in lowered):
                parts.append(
                    "Un achat de cette ampleur dépasse en général le cadre du budget courant du foyer — "
                    "à traiter à part (épargne, crédit, projet long terme)."
                )

    if doc_excerpts:
        for ex in doc_excerpts:
            name = ex.get("name") or "document"
            did = ex.get("document_id")
            if not ex.get("has_file"):
                notes = (ex.get("excerpt") or "").strip()
                if notes:
                    parts.append(f"« {name} » (n°{did}) : pas de fichier joint — notes : {notes[:280]}")
                else:
                    parts.append(
                        f"« {name} » (n°{did}) est dans le coffre sans fichier — "
                        "ajoute un PDF ou une photo dans le Coffre."
                    )
            else:
                excerpt = (ex.get("excerpt") or "").strip()
                if excerpt and not excerpt.startswith("("):
                    preview = excerpt[:420] + ("…" if len(excerpt) > 420 else "")
                    parts.append(f"Extrait de « {name} » : {preview}")
        parts.append("Ouvre le document ci-dessous pour le voir en entier.")

    if vault_empty and any(k in lowered for k in ("coffre", "facture", "document", "fichier", "pdf")):
        parts.append(
            "Ton coffre documents est vide — dépose ta facture ou ton PDF dans le Coffre "
            "pour que je puisse t’en donner le détail."
        )

    if not parts:
        if llm_unavailable:
            parts.append(
                "Reformule en précisant le sujet (budget, facture, tâches…) "
                "ou complète tes données dans le Coffre et le Budget."
            )
        else:
            parts.append(
                "Je n’ai pas pu formuler une réponse détaillée. Reformule ta question "
                "ou ouvre le Coffre / Budget pour compléter tes informations."
            )

    return " ".join(parts)[:4000]


def _vault_documents_from_excerpts(doc_excerpts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for ex in doc_excerpts:
        doc_id = ex.get("document_id")
        if not doc_id:
            continue
        refs.append(
            {
                "id": doc_id,
                "name": ex.get("name") or "Document",
                "category": ex.get("category"),
                "has_file": bool(ex.get("has_file")),
            }
        )
    return refs

_ACTION_MARKERS = (
    "ajoute",
    "rajoute",
    "crée",
    "cree",
    "assigne",
    "termine",
    "marque comme",
    "nouvelle tâche",
    "nouvelle tache",
)

_ACTION_TARGETS = (
    "tâche",
    "tache",
    "courses",
    "agenda",
    "événement",
    "evenement",
    "rdv",
    "liste de courses",
)

_CONSULT_TRIGGERS = (
    "coffre",
    "document",
    "facture",
    "factures",
    "téléphone",
    "telephone",
    "mobile",
    "orange",
    "sfr",
    "free",
    "bouygues",
    "dernier",
    "dernière",
    "derniere",
    "consulte",
    "regarde",
    "lis ",
    "lire",
    "analyse",
    "budget",
    "enveloppe",
    "enveloppes",
    "dépense",
    "depense",
    "épargne",
    "epargne",
    "frigo",
    "courses",
    "agenda",
    "événement",
    "evenement",
    "combien",
    "puis-je",
    "puis je",
    "peux-je",
    "peux je",
    "moyens",
    "acheter",
    "achat",
    "ferrari",
    "voiture",
    "crédit",
    "credit",
    "carte",
    "coupon",
    "tâches ouvertes",
    "taches ouvertes",
    "qu'ai-je",
    "qu ai-je",
    "dis-moi",
    "dis moi",
    "explique",
    "pourquoi",
    "qu'est-ce",
    "quest ce",
    "résume",
    "resume",
    "montant",
    "facturation",
)


def _normalize_text(s: str) -> str:
    t = s.lower().replace("'", " ").replace("’", " ")
    t = unicodedata.normalize("NFD", t)
    return t.encode("ascii", "ignore").decode("ascii")


def _is_clear_action_command(command: str) -> bool:
    lowered = _normalize_text(command)
    if not any(m in lowered for m in _ACTION_MARKERS):
        return False
    if any(t in lowered for t in _ACTION_TARGETS):
        return True
    if any(k in lowered for k in ("mail", "email", "e-mail", "courrier", "message")):
        return True
    if any(k in lowered for k in ("appelle", "appel", "rappelle", "rappel")):
        return True
    return False


def command_wants_household_answer(command: str) -> bool:
    if not (command or "").strip():
        return False
    if _is_clear_action_command(command):
        return False
    lowered = _normalize_text(command)
    if "?" in command:
        return True
    if any(t in lowered for t in _CONSULT_TRIGGERS):
        return True
    if re.search(r"\b(est ce que|devrais|voudrais|je peux|puis je)\b", lowered):
        return True
    return False


def _score_document(doc: HouseholdDocument, query: str) -> int:
    q = _normalize_text(query)
    blob = _normalize_text(f"{doc.name} {doc.category or ''} {doc.notes or ''} {doc.who or ''}")
    score = 0
    for token in re.findall(r"[a-z0-9]{3,}", q):
        if token in blob:
            score += 4
    if doc.attachment_storage_key:
        score += 2
    if doc.urgent:
        score += 1
    return score


def _pick_documents(
    db: Session,
    household_id: int,
    query: str,
    *,
    limit: int = 2,
) -> list[HouseholdDocument]:
    rows = (
        db.query(HouseholdDocument)
        .filter(HouseholdDocument.household_id == household_id)
        .order_by(HouseholdDocument.updated_at.desc(), HouseholdDocument.id.desc())
        .limit(80)
        .all()
    )
    if not rows:
        return []
    scored = sorted(
        (( _score_document(d, query), d.updated_at or datetime.min, d.id, d) for d in rows),
        key=lambda x: (x[0], x[1], x[2]),
        reverse=True,
    )
    if scored[0][0] <= 0:
        picked = [d for _, _, _, d in scored[:limit] if d.attachment_storage_key]
        if not picked:
            picked = [scored[0][3]]
        return picked[:limit]
    return [d for s, _, _, d in scored if s > 0][:limit]


def _load_document_excerpt(
    doc: HouseholdDocument,
    question: str,
    memory_lines: list[str] | None,
    *,
    max_chars: int = 4500,
) -> dict[str, Any]:
    meta = {
        "document_id": doc.id,
        "name": doc.name,
        "category": doc.category,
        "date_label": doc.date_label,
        "has_file": bool(doc.attachment_storage_key),
    }
    if not doc.attachment_storage_key:
        notes = (doc.notes or "").strip()
        if notes:
            meta["excerpt"] = notes[:max_chars]
        else:
            meta["excerpt"] = (
                f"(aucun fichier joint — ouvre « {doc.name} » dans le Coffre pour ajouter un PDF ou une photo.)"
            )
        return meta
    try:
        path = doc_attach.path_for_storage_key(doc.attachment_storage_key)
        data = path.read_bytes()
    except Exception as exc:
        logger.warning("document read failed id=%s: %s", doc.id, exc)
        meta["excerpt"] = f"(fichier illisible : {exc})"
        return meta
    fname = doc.attachment_original_name or doc.name or "document"
    mime = resolve_attachment_mime(fname, doc.attachment_mime)
    text, err = extract_document_text(data, mime, fname)
    if text.strip():
        meta["excerpt"] = text[:max_chars]
        meta["mime"] = mime
        return meta
    if mime in _IMAGE_MIME:
        answer = _answer_with_openai_vision(data, mime, question, memory_lines)
        if answer:
            meta["excerpt"] = answer[:max_chars]
            meta["mime"] = mime
            return meta
    meta["excerpt"] = err or "(contenu non extrait — ouvre le fichier dans le Coffre pour le voir en entier.)"
    meta["mime"] = mime
    return meta


def build_household_context(
    db: Session,
    household_id: int,
    user_id: int,
    command: str,
    memory_lines: list[str] | None,
) -> tuple[str, list[dict[str, Any]]]:
    now = utc_now_naive()
    lines: list[str] = []

    open_tasks = (
        db.query(Task)
        .filter(Task.household_id == household_id, Task.status == "open")
        .order_by(Task.due_at.asc().nullslast(), Task.id.asc())
        .limit(25)
        .all()
    )
    if open_tasks:
        lines.append("Tâches ouvertes :")
        for t in open_tasks:
            due = t.due_at.strftime("%d/%m/%Y") if t.due_at else "sans échéance"
            lines.append(f"- [{t.id}] {t.title} (échéance {due})")
    else:
        lines.append("Tâches ouvertes : aucune.")

    soon = now + timedelta(days=14)
    events = (
        db.query(CanonicalEvent)
        .filter(
            CanonicalEvent.household_id == household_id,
            CanonicalEvent.starts_at >= now,
            CanonicalEvent.starts_at <= soon,
        )
        .order_by(CanonicalEvent.starts_at.asc())
        .limit(12)
        .all()
    )
    if events:
        lines.append("Agenda (14 prochains jours) :")
        for e in events:
            lines.append(f"- {e.starts_at.strftime('%d/%m %H:%M')} — {e.title}")
    else:
        lines.append("Agenda (14 jours) : rien de planifié.")

    docs = (
        db.query(HouseholdDocument)
        .filter(HouseholdDocument.household_id == household_id)
        .order_by(HouseholdDocument.updated_at.desc())
        .limit(20)
        .all()
    )
    if docs:
        lines.append("Coffre documents (récents) :")
        for d in docs:
            att = "avec fichier" if d.attachment_storage_key else "sans fichier"
            lines.append(
                f"- [{d.id}] {d.name} ({d.category or 'Divers'}, {att}, maj. "
                f"{(d.updated_at or now).strftime('%d/%m/%Y')})"
            )
    else:
        lines.append("Coffre documents : vide.")

    budgets = (
        db.query(HouseholdBudgetEnvelope)
        .filter(HouseholdBudgetEnvelope.household_id == household_id)
        .order_by(HouseholdBudgetEnvelope.label.asc())
        .all()
    )
    if budgets:
        lines.append("Budget (enveloppes, montants indicatifs) :")
        total_cap = 0
        total_spent = 0
        for b in budgets:
            lines.append(f"- {b.label} : dépensé {b.spent} / plafond {b.budget_cap}")
            total_cap += int(b.budget_cap or 0)
            total_spent += int(b.spent or 0)
        lines.append(f"Total budget foyer : dépensé {total_spent} / plafond {total_cap}")
    else:
        lines.append("Budget : pas d'enveloppes renseignées.")

    grocery_open = (
        db.query(GroceryItem)
        .filter(GroceryItem.household_id == household_id, GroceryItem.done.is_(False))
        .count()
    )
    lines.append(f"Liste de courses : {grocery_open} article(s) à acheter.")

    fridge_soon = (
        db.query(HouseholdFridgeItem)
        .filter(
            HouseholdFridgeItem.household_id == household_id,
            HouseholdFridgeItem.expires_at <= now + timedelta(hours=48),
        )
        .count()
    )
    lines.append(f"Frigo : {fridge_soon} produit(s) à consommer sous 48 h.")

    journal_count = (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == user_id, JournalEntry.household_id == household_id)
        .count()
    )
    lines.append(f"Journal intime (utilisateur) : {journal_count} note(s) enregistrée(s) — contenu non détaillé ici.")

    doc_excerpts: list[dict[str, Any]] = []
    if any(
        k in _normalize_text(command)
        for k in ("coffre", "document", "facture", "fichier", "pdf", "dernier", "telephone", "mobile")
    ):
        for doc in _pick_documents(db, household_id, command, limit=2):
            doc_excerpts.append(_load_document_excerpt(doc, command, memory_lines))

    if doc_excerpts:
        lines.append("Extraits de documents pertinents pour la question :")
        for ex in doc_excerpts:
            lines.append(
                f"--- Document [{ex.get('document_id')}] {ex.get('name')} ({ex.get('category')}) ---\n"
                f"{(ex.get('excerpt') or '')[:4000]}"
            )

    if memory_lines:
        lines.append("Mémoire Alfred (foyer) :")
        lines.extend(f"- {m[:200]}" for m in memory_lines[:16])

    return "\n".join(lines)[:14000], doc_excerpts


def build_household_answer(
    command: str,
    db: Session,
    household_id: int,
    user_id: int,
    memory_lines: list[str] | None = None,
) -> dict[str, Any]:
    context, doc_excerpts = build_household_context(db, household_id, user_id, command, memory_lines)
    llm_ok = _household_llm_available()
    explanation = answer_household_question(command, context, memory_lines) if llm_ok else None
    if not explanation:
        explanation = _fallback_household_answer(
            command,
            context,
            doc_excerpts,
            llm_unavailable=not llm_ok,
        )
    vault_documents = _vault_documents_from_excerpts(doc_excerpts)
    proposal: dict[str, Any] = {
        "sources": doc_excerpts,
        "vault_documents": vault_documents,
    }
    if doc_excerpts:
        proposal["document_ids"] = [ex.get("document_id") for ex in doc_excerpts if ex.get("document_id")]
    return {
        "intent": "household_answer",
        "mode": "auto",
        "proposal": proposal,
        "explanation": explanation[:4000],
    }
