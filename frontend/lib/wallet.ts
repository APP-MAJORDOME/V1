import { deleteJson, getJson, patchJson, postJson } from './api';

export type WalletCardApi = {
  id: number;
  household_id: number;
  brand: string;
  points: number;
  color: string;
  created_at: string;
  updated_at: string;
};

export type CouponApi = {
  id: number;
  household_id: number;
  label: string;
  expires_at: string;
  discount: string;
  created_at: string;
  updated_at: string;
};

export type WalletCard = { id: number; brand: string; points: number; color: string };
export type Coupon = { id: number; label: string; expires_at: string; discount: string };

export function mapWalletCardToUi(row: WalletCardApi): WalletCard {
  return {
    id: row.id,
    brand: row.brand,
    points: row.points,
    color: row.color,
  };
}

export function mapCouponToUi(row: CouponApi): Coupon {
  return {
    id: row.id,
    label: row.label,
    expires_at: row.expires_at,
    discount: row.discount,
  };
}

export async function fetchWalletCards(token: string): Promise<WalletCardApi[]> {
  return getJson<WalletCardApi[]>('/api/v1/wallet/cards', token);
}

export async function createWalletCard(
  payload: { brand: string; points?: number; color?: string },
  token: string,
): Promise<WalletCardApi> {
  return postJson<WalletCardApi>('/api/v1/wallet/cards', payload, token);
}

export async function patchWalletCard(
  cardId: number,
  patch: { brand?: string; points?: number; color?: string },
  token: string,
): Promise<WalletCardApi> {
  return patchJson<WalletCardApi>(`/api/v1/wallet/cards/${cardId}`, patch, token);
}

export async function deleteWalletCard(cardId: number, token: string): Promise<void> {
  await deleteJson(`/api/v1/wallet/cards/${cardId}`, token);
}

export async function fetchCoupons(token: string): Promise<CouponApi[]> {
  return getJson<CouponApi[]>('/api/v1/wallet/coupons', token);
}

export async function createCoupon(
  payload: { label: string; expires_at: string; discount: string },
  token: string,
): Promise<CouponApi> {
  return postJson<CouponApi>('/api/v1/wallet/coupons', payload, token);
}

export async function patchCoupon(
  couponId: number,
  patch: { label?: string; expires_at?: string; discount?: string },
  token: string,
): Promise<CouponApi> {
  return patchJson<CouponApi>(`/api/v1/wallet/coupons/${couponId}`, patch, token);
}

export async function deleteCoupon(couponId: number, token: string): Promise<void> {
  await deleteJson(`/api/v1/wallet/coupons/${couponId}`, token);
}
