"""Heuristiques courses Alfred (texte FR) — avant / après le LLM."""

from __future__ import annotations

import re
import unicodedata


def _norm(s: str) -> str:
    t = (s or "").lower().replace("'", " ").replace("’", " ")
    t = unicodedata.normalize("NFD", t)
    return t.encode("ascii", "ignore").decode("ascii")


# Produits / rayons fréquents — évite de créer une tâche pour « ajoute des carottes »
_FOODISH = (
    "alloco",
    "aloco",
    "carotte",
    "patate",
    "pomme de terre",
    "lait",
    "pain",
    "oeuf",
    "œuf",
    "beurre",
    "fromage",
    "yaourt",
    "yogourt",
    "poulet",
    "viande",
    "poisson",
    "riz",
    "pate",
    "pâtes",
    "tomate",
    "oignon",
    "ail",
    "banane",
    "pomme",
    "orange",
    "citron",
    "salade",
    "concombre",
    "courgette",
    "aubergine",
    "poivron",
    "haricot",
    "lentille",
    "farine",
    "sucre",
    "sel",
    "huile",
    "vinaigre",
    "cafe",
    "thé",
    "the ",
    "eau",
    "jus",
    "soda",
    "biere",
    "bière",
    "vin ",
    "chocolat",
    "cereale",
    "céréale",
    "gateau",
    "gâteau",
    "biscuit",
    "glace",
    "pizza",
    "frite",
    "saumon",
    "thon",
    "jambon",
    "saucisse",
    "crevette",
    "avocat",
    "mangue",
    "ananas",
    "fraise",
    "raisin",
    "melon",
    "pasteque",
    "pastèque",
    "kiwi",
    "noix",
    "amande",
    "epice",
    "épice",
    "herbe",
    "basilic",
    "persil",
    "moutarde",
    "ketchup",
    "mayo",
    "sauce",
    "soupe",
    "conserve",
    "surgelé",
    "surgele",
    "couche",
    "couches",
    "papier toilette",
    "lessive",
    "liquide vaisselle",
    "course",  # « liste de courses »
)

_ADD_MARKERS = (
    "ajoute",
    "rajoute",
    "acheter",
    "achete",
    "prendre",
    "mets",
    "met ",
    "besoin de",
    "il me faut",
    "il nous faut",
)

_GROCERY_CONTEXT = (
    "course",
    "liste de course",
    "liste course",
    "au drive",
    "carrefour",
    "leclerc",
    "auchan",
    "intermarche",
    "magasin",
    "panier",
    "frigo",
    "courses",
)

_CORRECTION = (
    "pas en tache",
    "pas en tâche",
    "pas une tache",
    "pas une tâche",
    "en course",
    "aux course",
    "a la liste",
    "à la liste",
    "dans les course",
    "plutot en course",
    "plutôt en course",
)


def looks_like_grocery_correction(command: str) -> bool:
    """« ajoute-le en courses », « pas en tâche » — pas une simple « ajoute X à la liste »."""
    n = _norm(command)
    if not n.strip():
        return False
    if "pas en tache" in n or "pas une tache" in n:
        return True
    if "plutot en course" in n or "plutot aux course" in n:
        return True
    # Pronom / reprise sans produit clair
    if re.search(r"\b(ajoute|mets|met)\s+(le|la|les|l|y|ca|cela)\b", n) and "course" in n:
        return True
    if re.search(r"\b(en|aux|dans les)\s+courses?\b", n) and re.search(
        r"\b(le|la|les|l|y|ca|cela|tache)\b", n
    ):
        return True
    return False


def looks_like_grocery_add(command: str) -> bool:
    """True si la commande vise clairement la liste de courses."""
    raw = (command or "").strip()
    if not raw or "?" in raw:
        return False
    n = _norm(raw)

    # Questions budget / affordabilité
    if any(k in n for k in ("puis je", "peux je", "est ce que je", "combien", "budget", "ferrari", "voiture")):
        return False
    # Tâche explicite
    if any(k in n for k in ("tache", "tâche", "todo", "rappel", "rappelle-moi de", "a faire", "à faire")) and "course" not in n:
        # sauf correction « pas en tâche »
        if not looks_like_grocery_correction(raw):
            # « ajoute une tâche » reste tâche
            if re.search(r"\b(une )?tache\b", n) or "nouvelle tache" in n:
                return False

    if looks_like_grocery_correction(raw):
        return True

    has_add = any(m in n for m in _ADD_MARKERS)
    has_ctx = any(c in n for c in _GROCERY_CONTEXT)
    has_food = any(f in n for f in _FOODISH)

    if has_ctx and has_add:
        return True
    if has_ctx and re.search(r"\b(des|du|de la|de l|un|une)\b", n):
        return True
    # « ajoute-moi des patates douces » / « acheter des carottes 2kg »
    if has_add and has_food:
        return True
    if has_add and re.search(r"\b(des|du|de la|de l|un|une)\b.+\b(\d+\s*(kg|g|l|cl|ml|pieces?|pcs?)?)\b", n):
        return True
    if re.search(r"\b(acheter|achete|prendre)\b", n) and re.search(r"\b(des|du|de la|de l|un|une)\b", n):
        return True
    return False


def extract_grocery_label(command: str, *, fallback: str | None = None) -> str:
    """Extrait « carottes 2kg » depuis « ajoute des carottes a la liste des courses 2KG »."""
    raw = (command or "").strip()
    if not raw:
        return (fallback or "").strip()[:120]

    # Corrections vagues : pas de label utile dans la phrase
    if looks_like_grocery_correction(raw) and not any(f in _norm(raw) for f in _FOODISH if f != "course"):
        return (fallback or "").strip()[:120]

    qty = ""
    qty_m = re.search(r"(?i)\b(\d+(?:[.,]\d+)?\s*(?:kg|g|l|cl|ml|pcs?|pieces?|pi[eè]ces?))\b", raw)
    if qty_m:
        qty = qty_m.group(1).strip()

    cleaned = raw
    cleaned = re.sub(
        r"(?i)^(ajoute[- ]?moi|ajoute|rajoute|acheter|achète|achete|prendre|mets?)\s+",
        "",
        cleaned,
    ).strip()
    cleaned = re.sub(
        r"(?i)\s+(à|a)\s+la\s+liste(\s+de\s+courses?)?.*$",
        "",
        cleaned,
    ).strip()
    cleaned = re.sub(r"(?i)\s+dans\s+(les\s+)?courses?\s*$", "", cleaned).strip()
    cleaned = re.sub(r"(?i)\s+aux?\s+courses?\s*$", "", cleaned).strip()
    cleaned = re.sub(r"(?i)^(des|du|de la|de l[' ]|un|une)\s+", "", cleaned).strip()
    # retire qty déjà capturée pour éviter doublon, puis on la rattache
    if qty:
        cleaned = re.sub(re.escape(qty), "", cleaned, flags=re.IGNORECASE).strip()
    # « en courses pas en tache » → vide
    if _norm(cleaned) in {"le", "la", "les", "en", "y", "ca", "cela"} or looks_like_grocery_correction(cleaned):
        return (fallback or "").strip()[:120]
    label = (cleaned or fallback or raw).strip(" .!?,;:")
    if qty and qty.lower() not in label.lower():
        label = f"{label} {qty}".strip()
    return label[:120]

def grocery_interpret(command: str, *, label_hint: str | None = None) -> dict:
    label = extract_grocery_label(command, fallback=label_hint)
    if len(label) < 2:
        label = extract_grocery_label(command) or "article"
    return {
        "intent": "grocery_add",
        "mode": "auto",
        "proposal": {"label": label[:120], "title": label[:120]},
        "explanation": f"J’ajoute « {label[:80]} » à ta liste de courses.",
    }
