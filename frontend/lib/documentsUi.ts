/** Valeurs historiques API / imports ; l'affichage utilise `docCategoryLabel`. */
export const DOC_COFFRE_CATEGORIES = ['🏥 Santé', '📚 École', '🏛️ Admin', '💰 Finance', '🏠 Maison', '🛂 Identité', 'Divers'] as const;

/** Filtres UI (sans emoji) → libellés encore présents en base pour POST/PATCH. */
const DOC_FILTER_TO_API_CAT: Record<string, string> = {
  Santé: '🏥 Santé',
  École: '📚 École',
  Admin: '🏛️ Admin',
  Finance: '💰 Finance',
  Maison: '🏠 Maison',
  Identité: '🛂 Identité',
  Divers: 'Divers',
};

export function docCategoryForApi(filterId: string): string {
  if (filterId === 'Tous') return 'Divers';
  return DOC_FILTER_TO_API_CAT[filterId] ?? filterId;
}

export type DocStorageSummary = {
  used_bytes: number;
  quota_bytes: number | null;
  encryption_at_rest?: boolean;
};

export function formatDocStorageShort(usedBytes: number, quotaBytes: number | null): string {
  const fmt = (b: number) =>
    b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`;
  if (quotaBytes == null) return `Pièces jointes : ${fmt(usedBytes)} (sans quota global)`;
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  return `Stockage PJ : ${fmt(usedBytes)} / ${fmt(quotaBytes)} (${pct} %)`;
}
