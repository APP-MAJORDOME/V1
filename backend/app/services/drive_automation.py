"""Tentative de connexion Drive navigateur (Playwright) — optionnel, Carrefour en premier."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_CARREFOUR_DRIVE_URL = "https://www.carrefour.fr/drive"

_CARREFOUR_LOGIN_URLS: tuple[str, ...] = (
    "https://www.carrefour.fr/mon-compte/connexion",
    "https://www.carrefour.fr/login",
    "https://www.carrefour.fr/drive",
)


def drive_automation_available() -> bool:
    if not settings.drive_automation_enabled:
        return False
    try:
        import playwright  # noqa: F401

        return True
    except ImportError:
        return False


def attempt_drive_login(
    service_key: str,
    username: str,
    password: str,
    *,
    login_url: str | None = None,
) -> dict[str, Any]:
    sk = (service_key or "").strip().lower()
    if not settings.drive_automation_enabled:
        return {
            "status": "disabled",
            "automation": "manual_open",
            "message": "Connexion Drive auto désactivée (MAJORDOME_DRIVE_AUTOMATION_ENABLED=false).",
            "logged_in": False,
        }
    if sk != "carrefour":
        return {
            "status": "unsupported_store",
            "automation": "manual_open",
            "message": f"Connexion auto non supportée pour {sk} — ouverture manuelle uniquement.",
            "logged_in": False,
        }
    if not username.strip() or not password:
        return {
            "status": "missing_credentials",
            "automation": "manual_open",
            "message": "Identifiant ou mot de passe manquant dans le trousseau.",
            "logged_in": False,
        }
    if not drive_automation_available():
        return {
            "status": "missing_playwright",
            "automation": "manual_open",
            "message": "Playwright non installé sur le serveur (pip install playwright && playwright install chromium).",
            "logged_in": False,
        }

    urls = [login_url.strip()] if login_url and login_url.strip() else list(_CARREFOUR_LOGIN_URLS)
    timeout_ms = max(5000, min(settings.drive_automation_timeout_sec * 1000, 120000))

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {
            "status": "missing_playwright",
            "automation": "manual_open",
            "message": "Playwright indisponible.",
            "logged_in": False,
        }

    last_error = ""
    for url in urls:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.set_default_timeout(timeout_ms)
                page.goto(url, wait_until="domcontentloaded")
                _fill_carrefour_login(page, username.strip(), password)
                page.wait_for_timeout(2500)
                final_url = page.url or ""
                content = (page.content() or "").lower()
                browser.close()

                logged_in = _looks_logged_in(final_url, content)
                if logged_in:
                    return {
                        "status": "logged_in",
                        "automation": "playwright_session",
                        "message": "Connexion Carrefour Drive réussie côté serveur — ouvre le Drive pour commander.",
                        "logged_in": True,
                        "final_url": final_url[:500],
                        "open_url": _CARREFOUR_DRIVE_URL,
                    }
                last_error = "identifiants refusés ou page de connexion encore affichée"
        except Exception as exc:
            last_error = str(exc)[:200]
            logger.warning("drive_automation failed url=%s: %s", url, exc)

    return {
        "status": "failed",
        "automation": "manual_open",
        "message": (
            f"Connexion auto Carrefour échouée ({last_error}). "
            "Utilise les liens Rechercher ou connecte-toi manuellement."
        ),
        "logged_in": False,
        "open_url": _CARREFOUR_DRIVE_URL,
    }


def _fill_carrefour_login(page, username: str, password: str) -> None:
    selectors_email = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id*="email"]',
        'input[autocomplete="username"]',
    ]
    selectors_password = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id*="password"]',
    ]
    for sel in selectors_email:
        if page.locator(sel).count() > 0:
            page.locator(sel).first.fill(username)
            break
    for sel in selectors_password:
        if page.locator(sel).count() > 0:
            page.locator(sel).first.fill(password)
            break
    for sel in (
        'button[type="submit"]',
        'button:has-text("Connexion")',
        'button:has-text("Se connecter")',
        'input[type="submit"]',
    ):
        if page.locator(sel).count() > 0:
            page.locator(sel).first.click()
            break


_CARREFOUR_ADD_SELECTORS: tuple[str, ...] = (
    'button:has-text("Ajouter")',
    'button:has-text("ajouter")',
    'button[data-testid*="add"]',
    '[data-testid="add-to-cart"]',
    'button[aria-label*="Ajouter"]',
)


def attempt_drive_cart_fill(
    service_key: str,
    username: str,
    password: str,
    cart_items: list[dict],
    *,
    login_url: str | None = None,
    max_items: int = 10,
) -> dict[str, Any]:
    """Connexion + tentative d’ajout au panier (Carrefour, best-effort)."""
    sk = (service_key or "").strip().lower()
    labels = [
        str(i.get("label") or "").strip()
        for i in (cart_items or [])
        if isinstance(i, dict) and str(i.get("label") or "").strip()
    ][: max(1, min(max_items, 15))]
    if not labels:
        return {
            "status": "empty_cart",
            "service_key": sk,
            "items_attempted": 0,
            "items_added": 0,
            "message": "Liste de courses vide — rien à ajouter au panier.",
        }
    login = attempt_drive_login(sk, username, password, login_url=login_url)
    if not login.get("logged_in"):
        return {
            "status": "login_required",
            "service_key": sk,
            "items_attempted": len(labels),
            "items_added": 0,
            "message": login.get("message") or "Connexion Drive requise avant remplissage panier.",
            "open_url": login.get("open_url") or _CARREFOUR_DRIVE_URL,
        }
    if sk != "carrefour" or not drive_automation_available():
        return {
            "status": "unsupported",
            "service_key": sk,
            "items_attempted": len(labels),
            "items_added": 0,
            "message": "Remplissage panier auto disponible pour Carrefour uniquement (Playwright).",
        }

    from app.services.drive_cart_urls import build_cart_search_urls

    search_links = build_cart_search_urls(sk, [{"label": lb} for lb in labels])
    timeout_ms = max(5000, min(settings.drive_automation_timeout_sec * 1000, 120000))
    added = 0
    errors: list[str] = []

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {
            "status": "missing_playwright",
            "service_key": sk,
            "items_attempted": len(labels),
            "items_added": 0,
            "message": "Playwright indisponible sur le serveur.",
        }

    urls = [login_url.strip()] if login_url and login_url.strip() else list(_CARREFOUR_LOGIN_URLS)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_default_timeout(timeout_ms)
            page.goto(urls[0], wait_until="domcontentloaded")
            _fill_carrefour_login(page, username.strip(), password)
            page.wait_for_timeout(2000)
            page.goto(_CARREFOUR_DRIVE_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(1500)

            for link in search_links:
                url = str(link.get("search_url") or "").strip()
                label = str(link.get("label") or "")
                if not url:
                    continue
                try:
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(1200)
                    clicked = False
                    for sel in _CARREFOUR_ADD_SELECTORS:
                        if page.locator(sel).count() > 0:
                            page.locator(sel).first.click()
                            clicked = True
                            added += 1
                            page.wait_for_timeout(800)
                            break
                    if not clicked:
                        errors.append(label[:40] or "?")
                except Exception as exc:
                    errors.append(f"{label[:30]}:{str(exc)[:40]}")

            browser.close()
    except Exception as exc:
        return {
            "status": "failed",
            "service_key": sk,
            "items_attempted": len(labels),
            "items_added": added,
            "message": f"Remplissage panier interrompu : {str(exc)[:160]}",
            "open_url": _CARREFOUR_DRIVE_URL,
            "failed_labels": errors[:8],
        }

    if added >= len(labels):
        msg = f"{added} article(s) ajouté(s) au panier Carrefour (automatisation serveur)."
        st = "completed"
    elif added > 0:
        msg = (
            f"{added}/{len(labels)} article(s) ajoutés. "
            f"Complète le reste via les liens Rechercher"
            + (f" ({', '.join(errors[:3])})" if errors else "")
            + "."
        )
        st = "partial"
    else:
        msg = (
            "Connexion OK mais aucun bouton « Ajouter » détecté sur Carrefour. "
            "Utilise les liens Rechercher article par article."
        )
        st = "manual_fallback"

    return {
        "status": st,
        "service_key": sk,
        "items_attempted": len(labels),
        "items_added": added,
        "message": msg,
        "open_url": _CARREFOUR_DRIVE_URL,
        "failed_labels": errors[:12],
    }


def _looks_logged_in(final_url: str, content: str) -> bool:
    url_l = (final_url or "").lower()
    if "connexion" in url_l or "login" in url_l:
        if "mon-compte" not in url_l and "drive" not in url_l:
            return False
    if any(x in content for x in ("mot de passe incorrect", "identifiant incorrect", "erreur de connexion")):
        return False
    return any(x in url_l for x in ("mon-compte", "drive", "checkout", "accueil")) or "déconnexion" in content
