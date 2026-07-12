"""Préparation commande Drive enseigne (trousseau mots de passe — ouverture manuelle pour l’instant)."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import GroceryItem, UserVaultSecret
from app.services.drive_cart_urls import build_cart_search_urls
from app.services.shopping_advisor import _detect_stores, _normalize_text
from app.services.drive_automation import attempt_drive_cart_fill, attempt_drive_login
from app.services.user_secrets_vault import (
    credential_hints_for_stores,
    list_credential_hints,
    store_label_to_service_key,
    vault_secret_plain_password,
)

_DEFAULT_DRIVE_URLS: dict[str, str] = {
    "carrefour": "https://www.carrefour.fr/drive",
    "marche_u": "https://www.coursesu.com/drive",
    "leclerc": "https://www.e.leclerc/drive",
    "auchan": "https://www.auchan.fr/courses/drive",
    "intermarche": "https://www.intermarche.com/courses/drive",
    "lidl": "https://www.lidl.fr",
    "aldi": "https://www.aldi.fr",
}

_SERVICE_LABELS: dict[str, str] = {
    "carrefour": "Carrefour",
    "marche_u": "Marché U",
    "leclerc": "Leclerc",
    "auchan": "Auchan",
    "intermarche": "Intermarché",
    "lidl": "Lidl",
    "aldi": "Aldi",
}

_DRIVE_TRIGGERS = (
    "drive",
    "commander en ligne",
    "passer commande",
    "ouvre carrefour",
    "connecte carrefour",
    "connexion drive",
    "connexion auto",
    "me connecter",
    "mon compte",
)

_CART_TRIGGERS = (
    "liste de courses",
    "ma liste",
    "mon panier",
    "mes courses",
    "articles",
)

_RECIPE_TRIGGERS = (
    "recette",
    "menu",
    "promo",
    "promotion",
    "pas cher",
    "budget",
    "ingredient",
    "ingrédient",
    "repas",
    "manger",
    "economique",
    "économique",
)


def default_drive_url(service_key: str) -> str | None:
    return _DEFAULT_DRIVE_URLS.get((service_key or "").strip().lower())


def list_grocery_cart_items(db: Session, household_id: int, *, limit: int = 40) -> list[dict]:
    rows = (
        db.query(GroceryItem)
        .filter(GroceryItem.household_id == household_id, GroceryItem.done.is_(False))
        .order_by(GroceryItem.updated_at.desc(), GroceryItem.id.desc())
        .limit(max(1, min(limit, 60)))
        .all()
    )
    out: list[dict] = []
    for row in rows:
        label = (row.label or "").strip()
        if not label:
            continue
        out.append({"id": row.id, "label": label[:120]})
    return out


def _attach_cart_to_prep(
    prep: dict[str, Any],
    cart_items: list[dict],
    *,
    service_key: str = "carrefour",
) -> dict[str, Any]:
    prep = dict(prep)
    prep["cart_items"] = cart_items
    prep["cart_count"] = len(cart_items)
    prep["cart_text"] = "\n".join(str(i.get("label") or "") for i in cart_items if str(i.get("label") or "").strip())
    search_links = build_cart_search_urls(service_key, cart_items)
    prep["cart_search_links"] = search_links
    if search_links:
        prep["cart_search_batch_url"] = search_links[0].get("search_url")
    if cart_items and prep.get("status") == "ready":
        count = len(cart_items)
        prep["message"] = (
            f"{prep.get('message', '')} "
            f"J’ai préparé {count} article(s) avec liens de recherche Drive (un clic par produit)."
        ).strip()
        steps = list(prep.get("steps") or [])
        steps.append("Ouvre le Drive, puis utilise les liens « Rechercher » sous chaque article.")
        prep["steps"] = steps[:8]
    elif cart_items:
        prep["message"] = (
            f"{prep.get('message', '')} "
            f"{len(cart_items)} article(s) en attente sur ta liste — connecte le trousseau puis ouvre le Drive."
        ).strip()
    return prep


def enrich_vault_links(links: list[dict]) -> list[dict]:
    """Ajoute open_url et libellé d’action pour l’UI Alfred / courses."""
    out: list[dict] = []
    for link in links:
        row = dict(link)
        sk = str(row.get("service_key") or "")
        row["open_url"] = (row.get("login_url") or "").strip() or default_drive_url(sk)
        if row.get("drive_status") == "credentials_ready":
            row["drive_action"] = "open_manual"
        elif row.get("drive_status") == "username_only":
            row["drive_action"] = "complete_password"
        out.append(row)
    return out


def _resolve_service_key(command: str, explicit: str | None = None) -> str:
    if explicit:
        key = explicit.strip().lower()
        if key in _DEFAULT_DRIVE_URLS or key == "other":
            return key
    stores = _detect_stores(command)
    if stores:
        sk = store_label_to_service_key(stores[0])
        if sk:
            return sk
    lowered = _normalize_text(command)
    if "carrefour" in lowered:
        return "carrefour"
    if "leclerc" in lowered:
        return "leclerc"
    if "auchan" in lowered:
        return "auchan"
    if "intermarche" in lowered or "intermarché" in lowered:
        return "intermarche"
    if "marche u" in lowered or "marché u" in lowered or "courses u" in lowered:
        return "marche_u"
    return "carrefour"


def prepare_drive_session(
    db: Session,
    user_id: int,
    *,
    service_key: str,
    command: str = "",
    household_id: int | None = None,
) -> dict[str, Any]:
    sk = (service_key or "carrefour").strip().lower()
    store_label = _SERVICE_LABELS.get(sk, sk.replace("_", " ").title())
    open_url = default_drive_url(sk)

    row = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.user_id == user_id, UserVaultSecret.service_key == sk)
        .order_by(UserVaultSecret.updated_at.desc())
        .first()
    )

    cart_items: list[dict] = []
    if household_id:
        cart_items = list_grocery_cart_items(db, household_id)

    if row is None:
        return _attach_cart_to_prep(
            {
            "status": "needs_credentials",
            "service_key": sk,
            "store": store_label,
            "open_url": open_url,
            "automation": "manual",
            "secret_id": None,
            "username": None,
            "label": None,
            "steps": [
                f"Ajoute ton compte {store_label} dans Réglages → Sécurité → Trousseau.",
                "Indique identifiant et mot de passe Drive.",
                "Redemande à Alfred : « ouvre le drive carrefour ».",
            ],
            "message": (
                f"Aucun compte {store_label} dans ton trousseau. "
                "Ajoute-le dans Réglages → Sécurité, puis je pourrai t’ouvrir le Drive."
            ),
        },
            cart_items,
            service_key=sk,
        )

    open_url = (row.login_url or "").strip() or open_url
    has_password = bool((row.password_blob or "").strip())

    if not has_password:
        return _attach_cart_to_prep(
            {
            "status": "username_only",
            "service_key": sk,
            "store": store_label,
            "open_url": open_url,
            "automation": "manual",
            "secret_id": row.id,
            "username": row.username,
            "label": row.label,
            "steps": [
                "Complète le mot de passe dans le trousseau (Réglages → Sécurité).",
                f"Ouvre {store_label} Drive et connecte-toi avec {row.username or 'ton identifiant'}.",
            ],
            "message": (
                f"Compte {row.label} trouvé ({row.username or 'sans identifiant'}) "
                "mais sans mot de passe enregistré — complète le trousseau pour la suite."
            ),
        },
            cart_items,
            service_key=sk,
        )

    password_plain = vault_secret_plain_password(row)
    auto = attempt_drive_login(
        sk,
        row.username or "",
        password_plain,
        login_url=open_url,
    )
    automation = str(auto.get("automation") or "manual_open")
    logged_in = bool(auto.get("logged_in"))
    auto_detail = str(auto.get("status") or "")
    if logged_in:
        open_url = (auto.get("open_url") or open_url) or open_url
        message = str(auto.get("message") or f"Connexion {store_label} Drive réussie.")
        steps = [
            f"Ouvre {store_label} Drive (session serveur OK).",
            "Ajoute les articles via les liens Rechercher ou ta liste.",
        ]
    else:
        message = (
            f"Compte {row.label} prêt ({row.username or 'identifiant enregistré'}). "
            f"{auto.get('message', f'Ouvre {store_label} Drive pour te connecter.')}"
        ).strip()
        steps = [
            f"Ouvre {store_label} Drive (bouton ci-dessous).",
            f"Connecte-toi avec {row.username or 'ton identifiant enregistré'}.",
            "Ajoute les articles de ta liste de courses.",
        ]
    return _attach_cart_to_prep(
        {
            "status": "ready",
            "service_key": sk,
            "store": store_label,
            "open_url": open_url,
            "automation": automation,
            "logged_in": logged_in,
            "automation_detail": auto_detail,
            "secret_id": row.id,
            "username": row.username,
            "label": row.label,
            "steps": steps,
            "message": message,
        },
        cart_items,
        service_key=sk,
    )


def fill_drive_cart(
    db: Session,
    user_id: int,
    *,
    service_key: str,
    household_id: int | None = None,
) -> dict[str, Any]:
    sk = (service_key or "carrefour").strip().lower()
    row = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.user_id == user_id, UserVaultSecret.service_key == sk)
        .order_by(UserVaultSecret.updated_at.desc())
        .first()
    )
    cart_items: list[dict] = []
    if household_id:
        cart_items = list_grocery_cart_items(db, household_id)
    if row is None or not (row.password_blob or "").strip():
        return {
            "status": "needs_credentials",
            "service_key": sk,
            "items_attempted": len(cart_items),
            "items_added": 0,
            "message": f"Compte {sk} incomplet dans le trousseau.",
            "open_url": default_drive_url(sk),
        }
    login_url = (row.login_url or "").strip() or default_drive_url(sk)
    return {
        "service_key": sk,
        **attempt_drive_cart_fill(
            sk,
            row.username or "",
            vault_secret_plain_password(row),
            cart_items,
            login_url=login_url,
        ),
    }


def automate_drive_login(db: Session, user_id: int, *, service_key: str) -> dict[str, Any]:
    sk = (service_key or "carrefour").strip().lower()
    row = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.user_id == user_id, UserVaultSecret.service_key == sk)
        .order_by(UserVaultSecret.updated_at.desc())
        .first()
    )
    if row is None or not (row.password_blob or "").strip():
        return {
            "status": "needs_credentials",
            "service_key": sk,
            "automation": "manual_open",
            "logged_in": False,
            "message": f"Aucun compte {sk} complet dans le trousseau.",
            "open_url": default_drive_url(sk),
        }
    login_url = (row.login_url or "").strip() or default_drive_url(sk)
    return {
        "service_key": sk,
        **attempt_drive_login(
            sk,
            row.username or "",
            vault_secret_plain_password(row),
            login_url=login_url,
        ),
    }


def command_wants_drive_prepare(command: str) -> bool:
    if not settings.shopping_advisor_enabled:
        return False
    raw = (command or "").strip()
    if not raw or len(raw) < 6:
        return False
    lowered = _normalize_text(raw)
    if not any(t in lowered for t in _DRIVE_TRIGGERS):
        return False
    if any(t in lowered for t in _RECIPE_TRIGGERS) and "drive" not in lowered:
        return False
    if any(t in lowered for t in _RECIPE_TRIGGERS) and "drive" in lowered:
        open_verbs = ("ouvre", "ouvrir", "connecte", "connexion", "passer commande", "commander en ligne")
        if not any(v in lowered for v in open_verbs):
            return False
    if re.search(r"\b(drive|commander en ligne|passer commande)\b", lowered):
        return True
    if any(t in lowered for t in _CART_TRIGGERS) and (
        "drive" in lowered or bool(_detect_stores(raw))
    ):
        return True
    stores = _detect_stores(raw)
    return bool(stores) and ("drive" in lowered or "commander" in lowered)


def build_drive_prepare_response(
    command: str,
    db: Session,
    user_id: int,
    *,
    service_key: str | None = None,
    household_id: int | None = None,
) -> dict[str, Any]:
    sk = _resolve_service_key(command, service_key)
    prep = prepare_drive_session(
        db,
        user_id,
        service_key=sk,
        command=command,
        household_id=household_id,
    )
    mode = "confirm" if prep.get("status") == "ready" else "suggest"
    return {
        "intent": "drive_prepare",
        "mode": mode,
        "proposal": {"drive_prepare": prep},
        "explanation": str(prep.get("message") or "")[:4000],
    }


def list_drive_status(db: Session, user_id: int) -> dict[str, Any]:
    hints = list_credential_hints(db, user_id)
    stores = [_SERVICE_LABELS.get(str(h.get("service_key") or ""), "") for h in hints]
    stores = [s for s in stores if s]
    links = enrich_vault_links(credential_hints_for_stores(hints, stores))
    return {"stores": links, "automation": "manual_open"}
