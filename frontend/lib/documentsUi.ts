export function formatDocStorageShort(usedBytes: number, quotaBytes: number | null): string {
  const fmt = (b: number) =>
    b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`;
  if (quotaBytes == null) return `Pièces jointes : ${fmt(usedBytes)} (sans quota global)`;
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  return `Stockage PJ : ${fmt(usedBytes)} / ${fmt(quotaBytes)} (${pct} %)`;
}
