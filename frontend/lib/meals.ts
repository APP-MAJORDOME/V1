import { deleteJson, getJson, putJson } from './api';

export type MealPlanApi = {
  id: number;
  household_id: number;
  day_key: string;
  lunch: string;
  dinner: string;
  missing: string[];
  created_at: string;
  updated_at: string;
};

export type MealPlan = { lunch: string; dinner: string; missing: string[] };

export function mapMealPlansToRecord(rows: MealPlanApi[]): Record<string, MealPlan> {
  const out: Record<string, MealPlan> = {};
  for (const row of rows) {
    out[row.day_key] = {
      lunch: row.lunch,
      dinner: row.dinner,
      missing: row.missing,
    };
  }
  return out;
}

export async function fetchMealPlans(token: string): Promise<MealPlanApi[]> {
  return getJson<MealPlanApi[]>('/api/v1/meal-plans', token);
}

export async function upsertMealPlan(
  dayKey: string,
  plan: MealPlan,
  token: string,
): Promise<MealPlanApi> {
  return putJson<MealPlanApi>(
    `/api/v1/meal-plans/${encodeURIComponent(dayKey)}`,
    { lunch: plan.lunch, dinner: plan.dinner, missing: plan.missing },
    token,
  );
}

export async function deleteMealPlan(dayKey: string, token: string): Promise<void> {
  await deleteJson(`/api/v1/meal-plans/${encodeURIComponent(dayKey)}`, token);
}
