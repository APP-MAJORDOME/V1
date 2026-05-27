import type { HubKey } from '../components/PlusHub';

/** Bandeau couleur par module (design system Sprint 2). */
export const HUB_MODULE_COLORS: Partial<Record<HubKey, string>> = {
  courses: '#5A9E72',
  documents: '#B8962A',
  famille: '#5A82B0',
  recettes: '#8B6BAE',
  routines: '#C96B4A',
  courrier: '#6B8FAE',
  maison: '#6B8FAE',
  messages: '#5A82B0',
  wallet: '#5A9E72',
  anniversaires: '#B8962A',
  poubelles: '#7A6A5A',
  notifs: '#5A82B0',
  albums: '#8B6BAE',
  integrations: '#5A82B0',
};

export function hubColor(id: HubKey): string {
  return HUB_MODULE_COLORS[id] ?? '#C96B4A';
}
