/** Utilitaires dates de péremption / coupons (frigo, wallet). */

export type FridgeExpiryTone = 'ok' | 'soon' | 'urgent' | 'expired';

function parseDateOnly(iso: string): Date {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

/** Jours restants (négatif = périmé). */
export function daysUntilExpiry(expiresAt: string, now = Date.now()): number {
  const end = parseDateOnly(expiresAt).getTime();
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000));
}

export function isExpired(expiresAt: string, now = Date.now()): boolean {
  return daysUntilExpiry(expiresAt, now) < 0;
}

export function fridgeExpiryTone(expiresAt: string, now = Date.now()): FridgeExpiryTone {
  const days = daysUntilExpiry(expiresAt, now);
  if (days < 0) return 'expired';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'ok';
}

export function sortFridgeByExpiry<T extends { expires_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => parseDateOnly(a.expires_at).getTime() - parseDateOnly(b.expires_at).getTime(),
  );
}

export function partitionCoupons<T extends { expires_at: string }>(
  items: T[],
  now = Date.now(),
): { active: T[]; expired: T[] } {
  const active: T[] = [];
  const expired: T[] = [];
  for (const c of items) {
    if (isExpired(c.expires_at, now)) expired.push(c);
    else active.push(c);
  }
  return { active, expired };
}

export function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
