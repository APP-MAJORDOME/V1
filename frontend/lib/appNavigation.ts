export type MainTab = 'home' | 'alfred' | 'modules' | 'moi' | 'agenda';

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
  if (mainTab === 'modules') return 'plus';
  if (mainTab === 'alfred') return 'assistant';
  return mainTab;
}

/** Palette UI partagée (évite import circulaire depuis page.tsx). */
export const MAJORDOME_PALETTE = {
  bg: '#FEF9F5',
  white: '#FFFFFF',
  surface: '#FFF5F0',
  surface2: '#F5EDE8',
  surface3: '#EDE3DE',
  terra: '#D96B52',
  terraL: '#F0896E',
  terraXL: '#FDEAE5',
  sage: '#6BA898',
  sageL: '#EAF4F1',
  blush: '#F2A98F',
  lilac: '#B49BD1',
  lilacL: '#F0EBFA',
  sun: '#F5B942',
  text: '#2C1F1A',
  text2: '#9A8882',
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
