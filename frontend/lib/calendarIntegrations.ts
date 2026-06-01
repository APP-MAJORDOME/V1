/** Connexions calendrier (Google, Microsoft, Apple). */

import { postJson } from './api';

export type CalendarProvider = 'none' | 'google_calendar' | 'microsoft_calendar' | 'apple_calendar';

export type IntegrationStatus = {
  provider: string;
  configured: boolean;
  connected: boolean;
  status: string;
};

export type ConnectedAccountLike = { id?: number; provider: string; status: string };

export type OAuthStartResponse = { authorization_url: string; state?: string };

export function isCalendarConnected(accounts: ConnectedAccountLike[], provider: string): boolean {
  return accounts.some((a) => a.provider === provider && a.status === 'connected');
}

/** Priorité : Outlook → Google → Apple → local seulement. */
export function preferredEventProvider(accounts: ConnectedAccountLike[]): CalendarProvider {
  if (isCalendarConnected(accounts, 'microsoft_calendar')) return 'microsoft_calendar';
  if (isCalendarConnected(accounts, 'google_calendar')) return 'google_calendar';
  if (isCalendarConnected(accounts, 'apple_calendar')) return 'apple_calendar';
  return 'none';
}

export type OAuthCallbackNotice = { kind: 'success' | 'error'; message: string } | null;

/** Lit les query params après redirect OAuth et renvoie les clés à retirer de l’URL. */
export function readOAuthCallbackNotice(search: string): {
  notice: OAuthCallbackNotice;
  keysToStrip: string[];
} {
  const params = new URLSearchParams(search);
  const keysToStrip: string[] = [];
  const google = params.get('google_oauth');
  const microsoft = params.get('microsoft_oauth');
  const reason = params.get('reason');

  if (google) keysToStrip.push('google_oauth');
  if (microsoft) keysToStrip.push('microsoft_oauth');
  if (reason) keysToStrip.push('reason');

  if (google === 'connected') {
    return { notice: { kind: 'success', message: 'Google Calendar connecté.' }, keysToStrip };
  }
  if (google === 'error') {
    return {
      notice: {
        kind: 'error',
        message: `Connexion Google impossible${reason ? ` (${reason})` : ''}.`,
      },
      keysToStrip,
    };
  }
  if (microsoft === 'connected') {
    return { notice: { kind: 'success', message: 'Outlook / Microsoft Calendar connecté.' }, keysToStrip };
  }
  if (microsoft === 'error') {
    return {
      notice: {
        kind: 'error',
        message: `Connexion Microsoft impossible${reason ? ` (${reason})` : ''}.`,
      },
      keysToStrip,
    };
  }
  return { notice: null, keysToStrip };
}

export function integrationConfigured(
  statuses: IntegrationStatus[],
  provider: string,
): boolean {
  return statuses.find((s) => s.provider === provider)?.configured ?? false;
}

export async function syncCalendarAccount(token: string, accountId: number): Promise<string> {
  const res = await postJson<{ status: string }>(`/api/v1/accounts/${accountId}/sync`, {}, token);
  return res.status;
}

const SYNC_PROVIDERS: CalendarProvider[] = ['microsoft_calendar', 'google_calendar', 'apple_calendar'];

export async function syncAllConnectedCalendars(
  token: string,
  accounts: ConnectedAccountLike[],
): Promise<string[]> {
  const out: string[] = [];
  for (const provider of SYNC_PROVIDERS) {
    const acc = accounts.find((a) => a.provider === provider && a.status === 'connected' && a.id);
    if (!acc?.id) continue;
    out.push(await syncCalendarAccount(token, acc.id));
  }
  return out;
}

export function stripUrlSearchKeys(keys: string[]): void {
  if (typeof window === 'undefined' || keys.length === 0) return;
  const params = new URLSearchParams(window.location.search);
  for (const k of keys) params.delete(k);
  const qs = params.toString();
  window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}
