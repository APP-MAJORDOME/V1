/** Masque un e-mail pour l'affichage (ex. a***@live.fr). */
export function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf('@');
  if (at <= 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at);
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}***${domain}`;
}
