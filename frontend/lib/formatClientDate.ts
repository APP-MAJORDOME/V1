/** Formate une date ISO uniquement quand le client est prêt (fuseau local). */
export function formatDateFr(iso: string | undefined | null, clientReady: boolean): string {
  if (!iso) return '';
  if (!clientReady) return '…';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

export function formatDateTimeFr(iso: string | undefined | null, clientReady: boolean): string {
  if (!iso) return '';
  if (!clientReady) return '…';
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}
