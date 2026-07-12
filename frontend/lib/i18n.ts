import fr from '../locales/fr.json';

type FrDict = typeof fr;

/** Résolution simple par chemin « a.b.c » — préparation i18n (R5). */
export function t(path: string, fallback?: string): string {
  const parts = path.split('.');
  let cur: unknown = fr;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback ?? path;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : (fallback ?? path);
}

export type { FrDict };
export { fr };
