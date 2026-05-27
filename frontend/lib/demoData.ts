import { isoDatePlusDays } from './expiry';

export type DemoFridgeItem = { id: number; label: string; expires_at: string; qty: number };
export type DemoCoupon = { id: number; label: string; expires_at: string; discount: string };

/** Données démo réalistes (DLC futures, coupons actifs). */
export function defaultDemoFridge(): DemoFridgeItem[] {
  return [
    { id: 1, label: 'Lait entier', expires_at: isoDatePlusDays(5), qty: 1 },
    { id: 2, label: 'Poulet cru', expires_at: isoDatePlusDays(2), qty: 1 },
    { id: 3, label: 'Yaourts Léa', expires_at: isoDatePlusDays(9), qty: 6 },
  ];
}

export function defaultDemoCoupons(): DemoCoupon[] {
  return [
    { id: 1, label: '10% produits bébé', expires_at: isoDatePlusDays(14), discount: '-10%' },
    { id: 2, label: '5€ dès 40€ courses', expires_at: isoDatePlusDays(21), discount: '-5€' },
  ];
}
