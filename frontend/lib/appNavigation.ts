export type MainTab = 'home' | 'salon' | 'alfred' | 'modules' | 'moi' | 'agenda';

export type OverlayId =
  | 'plus'
  | 'courses'
  | 'maison'
  | 'documents'
  | 'assistant'
  | 'famille'
  | 'anniversaires'
  | 'poubelles'
  | 'notifs'
  | 'messages'
  | 'recettes'
  | 'routines'
  | 'courrier'
  | 'albums'
  | 'integrations';

export type AppLayerId = MainTab | OverlayId;

export function resolveAppLayer(overlay: OverlayId | null, mainTab: MainTab): AppLayerId {
  if (overlay) return overlay;
  if (mainTab === 'modules') return 'moi';
  if (mainTab === 'alfred') return 'assistant';
  return mainTab;
}

/** Palette UI partagée (évite import circulaire depuis page.tsx). */
export const MAJORDOME_PALETTE = {
  bg: '#FAF6F2',
  white: '#FFFFFF',
  surface: '#FFF8F4',
  surface2: '#F5EDE8',
  surface3: '#EDE3DE',
  terra: '#C96B4A',
  terraL: '#D4846A',
  terraXL: '#F2DDD5',
  sage: '#6BA898',
  sageL: '#EAF4F1',
  blush: '#F2A98F',
  lilac: '#B49BD1',
  lilacL: '#F0EBFA',
  sun: '#F5B942',
  text: '#2A211C',
  text2: '#6E5F56',
  text3: '#C8BAB5',
  border: '#EDE3DE',
  green: '#5BAA8A',
  greenL: '#E8F6EF',
  red: '#E05C5C',
  redL: '#FDEAEA',
  alex: '#4A72B8',
  alexL: '#E8EEFB',
  alexXL: '#EEF3FE',
  mint: '#3DAF88',
} as const;

export type MajordomePalette = typeof MAJORDOME_PALETTE;
