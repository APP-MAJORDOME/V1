"""Alfred : recettes économiques, promos enseignes et estimation de courses (web + contexte foyer)."""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dt import utc_now_naive
from app.models.models import (
    GroceryItem,
    HouseholdBudgetEnvelope,
    HouseholdFridgeItem,
    HouseholdMealPlan,
    HouseholdMoiWellness,
)
from app.services.llm import compose_shopping_plan
from app.services.user_secrets_vault import credential_hints_for_stores, list_credential_hints
from app.services.web_search import fetch_search_results

logger = logging.getLogger(__name__)

_STORE_ALIASES: tuple[tuple[str, str], ...] = (
    ("carrefour", "Carrefour"),
    ("marche u", "Marché U"),
    ("marché u", "Marché U"),
    ("hyper u", "Hyper U"),
    ("super u", "Super U"),
    ("leclerc", "Leclerc"),
    ("e.leclerc", "E.Leclerc"),
    ("intermarche", "Intermarché"),
    ("intermarché", "Intermarché"),
    ("auchan", "Auchan"),
    ("lidl", "Lidl"),
    ("aldi", "Aldi"),
    ("casino", "Casino"),
    ("monoprix", "Monoprix"),
    ("franprix", "Franprix"),
)

_SHOPPING_TRIGGERS = (
    "promo",
    "promotion",
    "recette",
    "menu",
    "repas",
    "manger",
    "courses",
    "supermarche",
    "supermarché",
    "enseigne",
    "magasin",
    "economique",
    "économique",
    "pas cher",
    "budget",
    "total",
    "prix",
    "ingredient",
    "ingrédient",
    "envie",
    "humeur",
    "confort",
    "reconfort",
    "drive",
    "commander en ligne",
    "passer commande",
    "carrefour.fr",
)

_ACTION_BLOCK = (
    "ajoute ",
    "rajoute ",
    "crée ",
    "cree ",
    "assigne ",
    "termine ",
    "nouvelle tâche",
    "nouvelle tache",
    "souviens-toi",
    "note que ",
)

_MOOD_LABELS = ("très bas", "bas", "neutre", "bien", "très bien")


def _normalize_text(text: str) -> str:
    lowered = (text or "").lower()
    lowered = unicodedata.normalize("NFD", lowered)
    return "".join(c for c in lowered if unicodedata.category(c) != "Mn")


def _detect_stores(command: str) -> list[str]:
    lowered = _normalize_text(command)
    found: list[str] = []
    for alias, label in _STORE_ALIASES:
        if alias in lowered and label not in found:
            found.append(label)
    return found[:3]


def command_wants_shopping_plan(command: str) -> bool:
    if not settings.shopping_advisor_enabled:
        return False
    raw = (command or "").strip()
    if not raw or len(raw) < 8:
        return False
    lowered = _normalize_text(raw)
    if any(lowered.startswith(b) for b in _ACTION_BLOCK):
        return False
    if "liste de courses" in lowered and any(k in lowered for k in ("ajoute", "rajoute")):
        return False
    stores = _detect_stores(raw)
    if stores and any(t in lowered for t in _SHOPPING_TRIGGERS):
        return True
    if any(
        p in lowered
        for p in (
            "quoi manger",
            "idee repas",
            "idée repas",
            "plan courses",
            "faire les courses",
            "recette economique",
            "recette économique",
            "menu de la semaine",
            "repas pas cher",
        )
    ):
        return True
    if ("promo" in lowered or "promotion" in lowered) and any(
        k in lowered for k in ("carrefour", "marche", "leclerc", "auchan", "lidl", "courses")
    ):
        return True
    return False


def _mood_label(value: int | None) -> str:
    if value is None:
        return "non renseignée"
    idx = max(0, min(4, int(value)))
    return _MOOD_LABELS[idx]


def _gather_shopping_context(
    db: Session,
    household_id: int,
    command: str,
    memory_lines: list[str] | None,
    user_id: int | None = None,
) -> tuple[str, list[str], list[dict[str, str]], list[dict]]:
    now = utc_now_naive()
    lines: list[str] = []
    stores = _detect_stores(command)

    wellness = (
        db.query(HouseholdMoiWellness)
        .filter(HouseholdMoiWellness.household_id == household_id)
        .first()
    )
    if wellness:
        lines.append(
            f"Humeur utilisatrice : {_mood_label(wellness.moi_mood)} "
            f"({wellness.moi_mood}/4). Sommeil : {wellness.sleep_hours:.1f} h."
        )
        if wellness.home_mood is not None:
            lines.append(f"Humeur du foyer : {_mood_label(wellness.home_mood)} ({wellness.home_mood}/4).")
    else:
        lines.append("Humeur / bien-être : non renseigné dans l’onglet Moi.")

    budgets = (
        db.query(HouseholdBudgetEnvelope)
        .filter(HouseholdBudgetEnvelope.household_id == household_id)
        .order_by(HouseholdBudgetEnvelope.label.asc())
        .all()
    )
    if budgets:
        total_cap = sum(int(b.budget_cap or 0) for b in budgets)
        total_spent = sum(int(b.spent or 0) for b in budgets)
        lines.append(f"Budget foyer : {total_spent} € dépensés / {total_cap} € plafond.")
        food = next((b for b in budgets if "course" in (b.label or "").lower() or "alim" in (b.label or "").lower()), None)
        if food:
            lines.append(f"Enveloppe alimentaire « {food.label} » : {food.spent} / {food.budget_cap} €.")
    else:
        lines.append("Budget : pas d’enveloppes renseignées.")

    grocery = (
        db.query(GroceryItem)
        .filter(GroceryItem.household_id == household_id, GroceryItem.done.is_(False))
        .order_by(GroceryItem.id.desc())
        .limit(20)
        .all()
    )
    if grocery:
        labels = ", ".join(g.label for g in grocery[:12])
        lines.append(f"Liste de courses actuelle ({len(grocery)} article(s)) : {labels}.")
    else:
        lines.append("Liste de courses : vide.")

    fridge_soon = (
        db.query(HouseholdFridgeItem)
        .filter(
            HouseholdFridgeItem.household_id == household_id,
            HouseholdFridgeItem.expires_at <= now + timedelta(hours=72),
        )
        .order_by(HouseholdFridgeItem.expires_at.asc())
        .limit(8)
        .all()
    )
    if fridge_soon:
        items = ", ".join(f.label for f in fridge_soon)
        lines.append(f"Frigo à consommer sous 72 h : {items}.")

    meals = (
        db.query(HouseholdMealPlan)
        .filter(HouseholdMealPlan.household_id == household_id)
        .order_by(HouseholdMealPlan.day_key.desc())
        .limit(5)
        .all()
    )
    if meals:
        lines.append("Repas planifiés récemment :")
        for m in meals:
            lunch = (m.lunch or "").strip()
            dinner = (m.dinner or "").strip()
            parts = [p for p in (f"midi: {lunch}" if lunch else "", f"soir: {dinner}" if dinner else "") if p]
            detail = " ; ".join(parts) if parts else "(vide)"
            lines.append(f"- {m.day_key} : {detail}")

    if memory_lines:
        lines.append("Mémoire Alfred :")
        lines.extend(f"- {m[:180]}" for m in memory_lines[:10])

    if stores:
        lines.append(f"Enseignes mentionnées : {', '.join(stores)}.")
    else:
        lines.append("Enseignes mentionnées : aucune — propose Carrefour ou Marché U si pertinent.")

    vault_links: list[dict] = []
    if user_id:
        hints = list_credential_hints(db, user_id)
        target_stores = stores or ["Carrefour", "Marché U"]
        from app.services.drive_integration import enrich_vault_links

        vault_links = enrich_vault_links(credential_hints_for_stores(hints, target_stores))
        if hints:
            lines.append(
                "Trousseau mots de passe MajorDome (identifiants enregistrés, mot de passe jamais envoyé au LLM) :"
            )
            for h in hints[:8]:
                login = h.get("username") or "—"
                pwd = "oui" if h.get("has_password") else "non"
                lines.append(f"- {h.get('label')} ({h.get('service_key')}) : login {login}, MDP enregistré : {pwd}")
        if vault_links:
            lines.append("Enseignes ciblées avec compte enregistré (commande Drive auto : prochaine étape) :")
            for link in vault_links:
                lines.append(
                    f"- {link.get('store')} : compte « {link.get('label')} » "
                    f"({link.get('username') or 'identifiant'}) — statut {link.get('drive_status')}."
                )
        elif hints:
            lines.append(
                "Aucun compte du trousseau ne correspond aux enseignes demandées — "
                "suggère d’ajouter les identifiants dans Réglages → Sécurité."
            )

    web_sources: list[dict[str, str]] = []
    search_queries: list[str] = []
    week_hint = now.strftime("%B %Y")
    target_stores = stores or ["Carrefour", "Marché U"]
    for store in target_stores[:2]:
        search_queries.append(f"promotions {store} France {week_hint}")
    if "recette" in _normalize_text(command) or "repas" in _normalize_text(command):
        search_queries.append(f"recettes économiques supermarché France {week_hint}")

    if settings.web_search_enabled:
        for q in search_queries[:3]:
            rows = fetch_search_results(q, max_results=3)
            for row in rows:
                if row not in web_sources:
                    web_sources.append(row)
            if len(web_sources) >= 6:
                break
        web_sources = web_sources[:6]

    if web_sources:
        lines.append("Indices web (promos / recettes, à croiser avec prudence) :")
        for src in web_sources:
            snippet = (src.get("snippet") or "")[:220]
            lines.append(f"- {src.get('title') or 'Lien'} : {snippet}")

    return "\n".join(lines)[:12000], stores, web_sources, vault_links


def _normalize_ingredients(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("name") or "").strip()
        if not label:
            continue
        qty = str(item.get("qty") or item.get("quantity") or "").strip()
        try:
            price = float(item.get("price_eur") or item.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        out.append(
            {
                "label": label[:80],
                "qty": qty[:40],
                "price_eur": round(max(0.0, price), 2),
                "on_promo": bool(item.get("on_promo")),
                "store_hint": str(item.get("store_hint") or "").strip()[:40],
            }
        )
        if len(out) >= 20:
            break
    return out


def _fallback_plan(
    command: str,
    stores: list[str],
    context: str,
    web_sources: list[dict[str, str]],
    vault_links: list[dict] | None = None,
) -> dict[str, Any]:
    store_label = stores[0] if stores else "supermarché"
    ingredients = [
        {"label": "Pâtes", "qty": "500 g", "price_eur": 1.2, "on_promo": True, "store_hint": store_label},
        {"label": "Sauce tomate", "qty": "1 pot", "price_eur": 1.5, "on_promo": False, "store_hint": store_label},
        {"label": "Légumes surgelés", "qty": "600 g", "price_eur": 2.4, "on_promo": True, "store_hint": store_label},
        {"label": "Fromage râpé", "qty": "150 g", "price_eur": 1.8, "on_promo": False, "store_hint": store_label},
    ]
    total = round(sum(i["price_eur"] for i in ingredients), 2)
    explanation = (
        f"Voici une idée de repas économique (~{total} € pour 4 personnes) en tenant compte de ton foyer. "
        f"Je n’ai pas accès aux catalogues officiels {store_label} en temps réel — "
        "vérifie les promos en magasin ou sur le site de l’enseigne. "
        "Confirme pour ajouter les ingrédients à ta liste de courses."
    )
    plan = {
        "recipe_title": "Pâtes légumes express",
        "servings": 4,
        "stores": stores or [store_label],
        "mood_note": "Repas réconfortant, rapide et modéré en budget.",
        "ingredients": ingredients,
        "total_eur": total,
        "promo_tips": [
            f"Regarde les promos frais / surgelés chez {store_label} cette semaine.",
            "Privilégie les marques distributeur sur les bases (pâtes, sauce).",
        ],
        "disclaimer": (
            "Prix indicatifs France métropolitaine ; promos réelles à confirmer en magasin "
            "(pas d’API officielle Carrefour / Marché U)."
        ),
        "vault_links": vault_links or [],
    }
    if vault_links:
        plan["disclaimer"] += (
            " Compte enseigne détecté dans ton trousseau — commande Drive automatique en cours d’intégration."
        )
    return {
        "intent": "shopping_plan",
        "mode": "confirm",
        "proposal": {
            "shopping_plan": plan,
            "stores": plan["stores"],
            "sources": web_sources,
            "vault_links": vault_links or [],
        },
        "explanation": explanation,
    }


def _format_explanation(plan: dict[str, Any]) -> str:
    title = str(plan.get("recipe_title") or "Recette").strip()
    servings = int(plan.get("servings") or 4)
    total = plan.get("total_eur")
    try:
        total_f = float(total)
        total_str = f"{total_f:.2f}".replace(".", ",")
    except (TypeError, ValueError):
        total_str = "?"
    mood = str(plan.get("mood_note") or "").strip()
    tips = plan.get("promo_tips") if isinstance(plan.get("promo_tips"), list) else []
    lines = [f"{title} (≈ {servings} pers.) — total estimé {total_str} €."]
    if mood:
        lines.append(mood)
    if tips:
        lines.append("")
        lines.append("Promos / astuces :")
        for t in tips[:4]:
            if str(t).strip():
                lines.append(f"• {str(t).strip()}")
    disclaimer = str(plan.get("disclaimer") or "").strip()
    if disclaimer:
        lines.append("")
        lines.append(disclaimer)
    lines.append("")
    lines.append("Confirme pour ajouter les ingrédients à ta liste de courses.")
    return "\n".join(lines)[:4000]


def build_shopping_plan_response(
    command: str,
    db: Session,
    household_id: int,
    memory_lines: list[str] | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    context, stores, web_sources, vault_links = _gather_shopping_context(
        db, household_id, command, memory_lines, user_id=user_id
    )
    parsed = compose_shopping_plan(command, context, stores, web_sources, memory_lines)
    if not parsed or not isinstance(parsed, dict):
        return _fallback_plan(command, stores, context, web_sources, vault_links)

    ingredients = _normalize_ingredients(parsed.get("ingredients"))
    if not ingredients:
        return _fallback_plan(command, stores, context, web_sources, vault_links)

    try:
        total = float(parsed.get("total_eur") or 0)
    except (TypeError, ValueError):
        total = sum(i["price_eur"] for i in ingredients)
    total = round(max(0.0, total), 2)

    plan: dict[str, Any] = {
        "recipe_title": str(parsed.get("recipe_title") or "Recette du moment")[:120],
        "servings": max(1, min(12, int(parsed.get("servings") or 4))),
        "stores": stores or [str(s) for s in (parsed.get("stores") or []) if str(s).strip()][:3],
        "mood_note": str(parsed.get("mood_note") or "")[:400],
        "ingredients": ingredients,
        "total_eur": total,
        "promo_tips": [str(t)[:220] for t in (parsed.get("promo_tips") or []) if str(t).strip()][:6],
        "disclaimer": (
            "Estimations et promos basées sur le web et ton contexte MajorDome — "
            "à vérifier en magasin (pas d’API officielle enseigne)."
        ),
        "vault_links": vault_links,
    }
    if vault_links:
        plan["disclaimer"] += (
            " Compte enseigne dans ton trousseau — utilise « Ouvrir Drive » ou dis à Alfred « ouvre le drive carrefour »."
        )
    if not plan["stores"]:
        plan["stores"] = ["Carrefour", "Marché U"]

    explanation = str(parsed.get("message") or "").strip()
    if not explanation:
        explanation = _format_explanation(plan)

    return {
        "intent": "shopping_plan",
        "mode": "confirm",
        "proposal": {
            "shopping_plan": plan,
            "stores": plan["stores"],
            "sources": web_sources,
            "vault_links": vault_links,
        },
        "explanation": explanation[:4000],
    }
