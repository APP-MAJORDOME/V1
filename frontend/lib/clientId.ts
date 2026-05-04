/**
 * Identifiants locaux (client-only) sans collision probable.
 * Évite Date.now() + Math.random() pour les toasts et entrées locales.
 */

export function newToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

/** Entier positif (Uint32) pour les lignes locales (ex: liste courses). */
export function newLocalNumericId(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]!;
  }
  return Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0);
}
