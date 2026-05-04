import type { HubKey } from '../components/PlusHub';
import { ALL_HUB_KEYS } from '../components/PlusHub';

const STORAGE_PREFIX = 'majordome_home_layout_v1';

/** Email du compte pour charger la disposition (localStorage), sans dépendre du champ formulaire. */
export const LAYOUT_USER_EMAIL_KEY = 'majordome_layout_user_email';

export type HomeSectionId =
  | 'hero_banner'
  | 'hub_shortcuts_row'
  | 'stats_pair'
  | 'coffre_strip'
  | 'equity'
  | 'debordee'
  | 'budget'
  | 'mood'
  | 'alfred_teaser'
  | 'agenda_snippet'
  | 'tasks_feed'
  | 'self_care'
  | 'priorities'
  | 'recent_done'
  | 'opportunities'
  | 'child_tracking'
  | 'relief_checklist'
  | 'integrations_home';

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  hero_banner: 'En-tête (bonjour · charge mentale)',
  hub_shortcuts_row: 'Raccourcis « Univers » (modules Plus)',
  stats_pair: 'Cartes événements + tâches ouvertes',
  coffre_strip: 'Accès Coffre famille',
  equity: 'Répartition du foyer & équité',
  debordee: 'Mode « Je suis débordée »',
  budget: 'Budget du mois',
  mood: 'Comment tu te sens ce matin',
  alfred_teaser: 'Encart Alfred',
  agenda_snippet: 'Aperçu « Cette semaine »',
  tasks_feed: 'Liste « Tes tâches »',
  self_care: '« Et toi, dans tout ça ? »',
  priorities: 'Priorités du jour',
  recent_done: 'Tâches terminées récentes',
  opportunities: 'Opportunités utiles',
  child_tracking: `Suivi enfant`,
  relief_checklist: 'Ce qui manque pour soulager 100%',
  integrations_home: 'Intégrations tierces',
};

/** Raccourcis Univers sur l’accueil : défaut équilibré. */
export const DEFAULT_HOME_HUB_SHORTCUTS: HubKey[] = ['courses', 'documents', 'famille', 'recettes', 'messages', 'courrier'];

export const DEFAULT_HOME_SECTIONS: Record<HomeSectionId, boolean> = {
  hero_banner: true,
  hub_shortcuts_row: true,
  stats_pair: true,
  coffre_strip: true,
  equity: true,
  debordee: true,
  budget: true,
  mood: true,
  alfred_teaser: true,
  agenda_snippet: true,
  tasks_feed: true,
  self_care: true,
  priorities: true,
  recent_done: true,
  opportunities: true,
  child_tracking: true,
  relief_checklist: true,
  integrations_home: true,
};

export type HomeLayoutConfig = {
  hubShortcuts: HubKey[];
  sections: Record<HomeSectionId, boolean>;
};

export const DEFAULT_HOME_LAYOUT: HomeLayoutConfig = {
  hubShortcuts: [...DEFAULT_HOME_HUB_SHORTCUTS],
  sections: { ...DEFAULT_HOME_SECTIONS },
};

function storageKeyForEmail(email: string): string {
  const slug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '')
    .slice(0, 72);
  return `${STORAGE_PREFIX}:${slug || 'anonymous'}`;
}

export function normalizeHubShortcuts(shortcuts: HubKey[]): HubKey[] {
  const allowed = new Set<HubKey>(ALL_HUB_KEYS);
  const seen = new Set<HubKey>();
  const out: HubKey[] = [];
  for (const k of shortcuts) {
    if (!allowed.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function mergeHomeLayout(raw: unknown): HomeLayoutConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HOME_LAYOUT, sections: { ...DEFAULT_HOME_SECTIONS } };
  const p = raw as Partial<HomeLayoutConfig>;
  const sections = { ...DEFAULT_HOME_SECTIONS, ...(p.sections && typeof p.sections === 'object' ? p.sections : {}) };
  const hubRaw = Array.isArray(p.hubShortcuts) ? (p.hubShortcuts as HubKey[]) : DEFAULT_HOME_HUB_SHORTCUTS;
  const hubShortcuts = normalizeHubShortcuts(hubRaw.length ? hubRaw : DEFAULT_HOME_HUB_SHORTCUTS);
  return { sections, hubShortcuts };
}

export function loadHomeLayoutForUser(email: string): HomeLayoutConfig {
  if (typeof window === 'undefined') return mergeHomeLayout(null);
  try {
    const raw = window.localStorage.getItem(storageKeyForEmail(email));
    if (!raw) return mergeHomeLayout(null);
    return mergeHomeLayout(JSON.parse(raw));
  } catch {
    return mergeHomeLayout(null);
  }
}

export function saveHomeLayoutForUser(email: string, config: HomeLayoutConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized: HomeLayoutConfig = {
      hubShortcuts: normalizeHubShortcuts(config.hubShortcuts),
      sections: { ...DEFAULT_HOME_SECTIONS, ...config.sections },
    };
    window.localStorage.setItem(storageKeyForEmail(email), JSON.stringify(normalized));
  } catch {
    /* quota / private mode */
  }
}
