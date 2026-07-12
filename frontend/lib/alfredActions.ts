/** Journal des actions Alfred (F1-3). */

export type AlfredActionEntry = {
  id: string;
  text: string;
  at: string;
};

const STORAGE_KEY = 'majordome_alfred_actions';

export function listAlfredActions(): AlfredActionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlfredActionEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function pushAlfredAction(text: string): void {
  if (typeof window === 'undefined') return;
  const entry: AlfredActionEntry = {
    id: `${Date.now()}`,
    text,
    at: new Date().toISOString(),
  };
  const next = [entry, ...listAlfredActions()].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
