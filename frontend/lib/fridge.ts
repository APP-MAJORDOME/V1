import { deleteJson, getJson, patchJson, postJson } from './api';

export type FridgeItemApi = {
  id: number;
  household_id: number;
  label: string;
  expires_at: string;
  qty: number;
  created_at: string;
  updated_at: string;
};

export type FridgeItem = { id: number; label: string; expires_at: string; qty: number };

export function mapFridgeToUi(row: FridgeItemApi): FridgeItem {
  return {
    id: row.id,
    label: row.label,
    expires_at: row.expires_at,
    qty: row.qty,
  };
}

export async function fetchFridgeItems(token: string): Promise<FridgeItemApi[]> {
  return getJson<FridgeItemApi[]>('/api/v1/fridge/items', token);
}

export async function createFridgeItem(
  payload: { label: string; expires_at: string; qty?: number },
  token: string,
): Promise<FridgeItemApi> {
  return postJson<FridgeItemApi>('/api/v1/fridge/items', payload, token);
}

export async function patchFridgeItem(
  itemId: number,
  patch: { label?: string; expires_at?: string; qty?: number },
  token: string,
): Promise<FridgeItemApi> {
  return patchJson<FridgeItemApi>(`/api/v1/fridge/items/${itemId}`, patch, token);
}

export async function deleteFridgeItem(itemId: number, token: string): Promise<void> {
  await deleteJson(`/api/v1/fridge/items/${itemId}`, token);
}
