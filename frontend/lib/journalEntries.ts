import { deleteJson, getJson, patchJson, postJson } from './api';

export type JournalEntry = {
  id: number;
  entry_date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export function todayDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayKeyOffset(fromDay: string, deltaDays: number): string {
  const [y, m, d] = fromDay.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function journalRangeLastDays(days: number): { from: string; to: string } {
  const to = todayDayKey();
  const from = dayKeyOffset(to, -(days - 1));
  return { from, to };
}

export async function fetchJournalEntries(
  token: string,
  range?: { from?: string; to?: string },
): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return getJson<JournalEntry[]>(`/api/v1/journal/entries${qs ? `?${qs}` : ''}`, token);
}

export async function createJournalEntry(
  token: string,
  payload: { entry_date: string; content: string },
): Promise<JournalEntry> {
  return postJson<JournalEntry>('/api/v1/journal/entries', payload, token);
}

export async function updateJournalEntry(
  token: string,
  id: number,
  payload: { content?: string; entry_date?: string },
): Promise<JournalEntry> {
  return patchJson<JournalEntry>(`/api/v1/journal/entries/${id}`, payload, token);
}

export async function deleteJournalEntry(token: string, id: number): Promise<void> {
  await deleteJson(`/api/v1/journal/entries/${id}`, token);
}

export function formatJournalDayLabel(dayKey: string, clientReady: boolean): string {
  if (!clientReady) return dayKey;
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function excerptJournal(text: string, max = 120): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
