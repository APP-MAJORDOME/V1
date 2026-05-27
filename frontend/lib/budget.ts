import { deleteJson, getJson, patchJson, postJson } from './api';

export type BudgetEnvelopeApi = {
  id: number;
  household_id: number;
  slug: string;
  label: string;
  spent: number;
  budget_cap: number;
  color: string;
  created_at: string;
  updated_at: string;
};

export type BudgetItem = { id: string; label: string; spent: number; budget: number; color: string };

export const DEFAULT_BUDGET_ENVELOPES: BudgetItem[] = [
  { id: 'courses', label: 'Courses', spent: 0, budget: 400, color: '#6BA898' },
  { id: 'loisirs', label: 'Loisirs', spent: 0, budget: 140, color: '#B49BD1' },
  { id: 'enfants', label: 'Enfants', spent: 0, budget: 220, color: '#D96B52' },
];

export function mapBudgetToUi(row: BudgetEnvelopeApi): BudgetItem {
  return {
    id: row.slug,
    label: row.label,
    spent: row.spent,
    budget: row.budget_cap,
    color: row.color,
  };
}

export async function fetchBudgetEnvelopes(token: string): Promise<BudgetEnvelopeApi[]> {
  return getJson<BudgetEnvelopeApi[]>('/api/v1/budget/envelopes', token);
}

export async function createBudgetEnvelope(
  payload: { slug: string; label: string; spent?: number; budget_cap?: number; color?: string },
  token: string,
): Promise<BudgetEnvelopeApi> {
  return postJson<BudgetEnvelopeApi>('/api/v1/budget/envelopes', payload, token);
}

export async function patchBudgetEnvelope(
  slug: string,
  patch: { label?: string; spent?: number; budget_cap?: number; color?: string },
  token: string,
): Promise<BudgetEnvelopeApi> {
  return patchJson<BudgetEnvelopeApi>(`/api/v1/budget/envelopes/${encodeURIComponent(slug)}`, patch, token);
}

export async function deleteBudgetEnvelope(slug: string, token: string): Promise<void> {
  await deleteJson(`/api/v1/budget/envelopes/${encodeURIComponent(slug)}`, token);
}

export async function syncBudgetEnvelopes(items: BudgetItem[], token: string): Promise<void> {
  const existing = await fetchBudgetEnvelopes(token).catch(() => []);
  const bySlug = new Map(existing.map((row) => [row.slug, row]));
  for (const item of items) {
    const payload = {
      label: item.label,
      spent: item.spent,
      budget_cap: item.budget,
      color: item.color,
    };
    if (bySlug.has(item.id)) {
      await patchBudgetEnvelope(item.id, payload, token);
    } else {
      await createBudgetEnvelope({ slug: item.id, ...payload }, token);
    }
  }
}
