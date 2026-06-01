/** Utilitaires vue calendrier (semaine, couleurs sources, fusion tâches/événements). */

export type CalendarEntryKind = 'event' | 'task';

export type CalendarEntry = {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  sourceProvider?: string | null;
  numericId: number;
};

export type ProviderVisual = {
  label: string;
  bg: string;
  color: string;
  border: string;
};

const PROVIDER_VISUALS: Record<string, ProviderVisual> = {
  google_calendar: { label: 'Google', bg: '#FDEAE5', color: '#D96B52', border: '#D96B5244' },
  microsoft_calendar: { label: 'Outlook', bg: '#F0EBFA', color: '#8B6BB8', border: '#B49BD144' },
  apple_calendar: { label: 'Apple', bg: '#EAF4F1', color: '#6BA898', border: '#6BA89844' },
  local: { label: 'MajorDome', bg: '#EEF3FE', color: '#4A72B8', border: '#4A72B844' },
  task: { label: 'Tâche', bg: '#FFF4E8', color: '#B8860B', border: '#F5B94266' },
};

export function providerVisual(source: string | null | undefined, kind: CalendarEntryKind): ProviderVisual {
  if (kind === 'task') return PROVIDER_VISUALS.task;
  if (!source) return PROVIDER_VISUALS.local;
  return PROVIDER_VISUALS[source] ?? PROVIDER_VISUALS.local;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date locale YYYY-MM-DD (fuseau navigateur). */
export function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Lundi de la semaine contenant `d`. */
export function mondayOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function weekDatesFromMonday(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const FR_DAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export function frDayShort(d: Date): string {
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return FR_DAYS_SHORT[idx];
}

export function eventLocalDate(iso: string): string {
  try {
    return localIsoDate(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatTimeFr(iso: string, clientReady: boolean): string {
  if (!clientReady) return '…';
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatWeekRangeLabel(monday: Date, clientReady: boolean): string {
  if (!clientReady) return 'Semaine…';
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const a = monday.toLocaleDateString('fr-FR', opts);
  const b = sunday.toLocaleDateString('fr-FR', { ...opts, year: monday.getFullYear() !== sunday.getFullYear() ? 'numeric' : undefined });
  return `Semaine du ${a} au ${b}`;
}

export function mergeCalendarEntries(
  events: Array<{ id: number; title: string; starts_at: string; ends_at?: string | null; source_provider?: string | null }>,
  tasks: Array<{ id: number; title: string; due_at?: string | null }>,
): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const e of events) {
    if (!e.starts_at) continue;
    out.push({
      id: `ev-${e.id}`,
      kind: 'event',
      title: e.title,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      sourceProvider: e.source_provider,
      numericId: e.id,
    });
  }
  for (const t of tasks) {
    if (!t.due_at) continue;
    out.push({
      id: `task-${t.id}`,
      kind: 'task',
      title: t.title,
      startsAt: t.due_at,
      endsAt: null,
      sourceProvider: null,
      numericId: t.id,
    });
  }
  out.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return out;
}

export function groupEntriesByLocalDate(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const key = eventLocalDate(e.startsAt);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return map;
}
