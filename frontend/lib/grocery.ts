import { deleteJson, getJson, patchJson, postJson } from './api';
import type { CourseItem } from '../components/CoursesPanel';

export type GroceryItemApi = {
  id: number;
  household_id: number;
  label: string;
  done: boolean;
  delegated: boolean;
  created_at: string;
  updated_at: string;
};

export function mapGroceryToCourse(row: GroceryItemApi): CourseItem {
  return {
    id: row.id,
    label: row.label,
    done: row.done,
    delegated: row.delegated,
  };
}

export async function fetchGroceryItems(token: string): Promise<GroceryItemApi[]> {
  return getJson<GroceryItemApi[]>('/api/v1/grocery/items', token);
}

export async function createGroceryItem(label: string, token: string): Promise<GroceryItemApi> {
  return postJson<GroceryItemApi>('/api/v1/grocery/items', { label: label.trim() }, token);
}

export async function patchGroceryItem(
  itemId: number,
  patch: { label?: string; done?: boolean; delegated?: boolean },
  token: string,
): Promise<GroceryItemApi> {
  return patchJson<GroceryItemApi>(`/api/v1/grocery/items/${itemId}`, patch, token);
}

export async function deleteGroceryItem(itemId: number, token: string): Promise<void> {
  await deleteJson(`/api/v1/grocery/items/${itemId}`, token);
}

export async function clearDoneGroceryItems(token: string): Promise<void> {
  await deleteJson('/api/v1/grocery/items/done', token);
}
