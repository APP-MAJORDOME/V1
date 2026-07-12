/** Nom affiché de l’assistant sur la plateforme (onglet, Salon, réglages). */
export const DEFAULT_ASSISTANT_NAME = 'Alfred';

export function resolveAssistantName(stored: string | null | undefined): string {
  const trimmed = stored?.trim();
  if (!trimmed || trimmed === 'ASSE') return DEFAULT_ASSISTANT_NAME;
  return trimmed;
}
