/** Heuristiques courses Alfred (miroir léger du backend grocery_intent). */

const FOODISH = [
  'alloco',
  'aloco',
  'carotte',
  'patate',
  'pomme de terre',
  'lait',
  'pain',
  'oeuf',
  'beurre',
  'fromage',
  'yaourt',
  'poulet',
  'viande',
  'poisson',
  'riz',
  'pate',
  'tomate',
  'oignon',
  'banane',
  'pomme',
  'orange',
  'salade',
  'huile',
  'cafe',
  'chocolat',
  'pizza',
  'jambon',
  'course',
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ');
}

export function looksLikeGroceryCorrection(command: string): boolean {
  const n = norm(command);
  if (n.includes('pas en tache') || n.includes('pas une tache')) return true;
  if (n.includes('plutot en course') || n.includes('plutot aux course')) return true;
  if (/\b(ajoute|mets|met)\s+(le|la|les|l|y|ca|cela)\b/.test(n) && n.includes('course')) return true;
  if (/\b(en|aux|dans les)\s+courses?\b/.test(n) && /\b(le|la|les|l|y|ca|cela|tache)\b/.test(n)) return true;
  return false;
}

export function looksLikeGroceryAdd(command: string): boolean {
  const raw = (command || '').trim();
  if (!raw || raw.includes('?')) return false;
  const n = norm(raw);
  if (['puis je', 'peux je', 'budget', 'ferrari', 'voiture'].some((k) => n.includes(k))) return false;
  if (looksLikeGroceryCorrection(raw)) return true;

  const hasAdd = ['ajoute', 'rajoute', 'acheter', 'achete', 'prendre', 'mets', 'besoin de', 'il me faut'].some(
    (m) => n.includes(m),
  );
  const hasCtx = ['course', 'liste de course', 'liste course', 'drive', 'carrefour', 'panier', 'frigo'].some((c) =>
    n.includes(c),
  );
  const hasFood = FOODISH.some((f) => n.includes(f));

  if (hasCtx && hasAdd) return true;
  if (hasAdd && hasFood) return true;
  if (/\b(acheter|achete|prendre)\b/.test(n) && /\b(des|du|de la|de l|un|une)\b/.test(n)) return true;
  return false;
}

export function extractGroceryLabel(command: string, fallback = ''): string {
  let cleaned = (command || '').trim();
  if (!cleaned) return fallback.slice(0, 120);
  if (looksLikeGroceryCorrection(cleaned) && !FOODISH.filter((f) => f !== 'course').some((f) => norm(cleaned).includes(f))) {
    return fallback.slice(0, 120);
  }
  cleaned = cleaned.replace(/^(ajoute[- ]?moi|ajoute|rajoute|acheter|achète|achete|prendre|mets?)\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+(à|a)\s+la\s+liste(\s+de\s+courses?)?.*$/i, '').trim();
  cleaned = cleaned.replace(/\s+dans\s+(les\s+)?courses?\s*$/i, '').trim();
  cleaned = cleaned.replace(/\s+aux?\s+courses?\s*$/i, '').trim();
  cleaned = cleaned.replace(/^(des|du|de la|de l[' ]|un|une)\s+/i, '').trim();
  const n = norm(cleaned);
  if (['le', 'la', 'les', 'en', 'y', 'ca'].includes(n) || looksLikeGroceryCorrection(cleaned)) {
    return fallback.slice(0, 120);
  }
  return (cleaned || fallback).replace(/^[.\s!?]+|[.\s!?]+$/g, '').slice(0, 120);
}
