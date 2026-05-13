import type { HubKey } from '../components/PlusHub';
import {
  DEFAULT_HOME_HUB_SHORTCUTS,
  DEFAULT_HOME_SECTIONS,
  type HomeLayoutConfig,
  type HomeSectionId,
  mergeHomeLayout,
  normalizeHubShortcuts,
  userEmailStorageSlug,
} from './homeLayout';

const POST_LOGIN_DONE_PREFIX = 'majordome_post_login_personal_v1';
const WELCOME_WIZARD_V2_PREFIX = 'majordome_welcome_wizard_v2';

export type PostLoginDensity = 'minimal' | 'balanced' | 'full';

export type PostLoginInterestId =
  | 'courses_maison'
  | 'admin_docs'
  | 'enfant_ecole'
  | 'equite_couple'
  | 'bien_etre'
  | 'budget_finances';

export const POST_LOGIN_INTEREST_OPTIONS: {
  id: PostLoginInterestId;
  label: string;
  hint: string;
}[] = [
  { id: 'courses_maison', label: 'Courses & maison', hint: 'Liste, frigo, entretien' },
  { id: 'admin_docs', label: 'Admin & courrier', hint: 'Coffre, courrier, papiers' },
  { id: 'enfant_ecole', label: 'Enfant & école', hint: 'Agenda, suivi, priorités' },
  { id: 'equite_couple', label: 'Équité & couple', hint: 'Charge mentale, délégation' },
  { id: 'bien_etre', label: 'Bien-être perso', hint: 'Humeur, temps pour toi' },
  { id: 'budget_finances', label: 'Budget', hint: 'Enveloppes, wallet' },
];

export const POST_LOGIN_DENSITY_OPTIONS: { id: PostLoginDensity; label: string; hint: string }[] = [
  { id: 'minimal', label: 'Essentiel', hint: 'Peu de blocs, accès rapide aux modules choisis' },
  { id: 'balanced', label: 'Équilibré', hint: 'Comme la configuration recommandée par défaut' },
  { id: 'full', label: 'Complet', hint: 'Tous les blocs visibles sur l’accueil' },
];

const INTEREST_HUBS: Record<PostLoginInterestId, HubKey[]> = {
  courses_maison: ['courses', 'maison'],
  admin_docs: ['documents', 'courrier'],
  enfant_ecole: ['famille', 'courrier', 'recettes'],
  equite_couple: ['famille', 'messages'],
  bien_etre: ['routines', 'recettes'],
  budget_finances: ['wallet', 'courses'],
};

const INTEREST_SECTIONS: Record<PostLoginInterestId, Partial<Record<HomeSectionId, boolean>>> = {
  courses_maison: { budget: true },
  admin_docs: { coffre_strip: true },
  enfant_ecole: { child_tracking: true, priorities: true },
  equite_couple: { equity: true, debordee: true, relief_checklist: true },
  bien_etre: { self_care: true, mood: true },
  budget_finances: { budget: true },
};

function densitySectionPatch(density: PostLoginDensity): Partial<Record<HomeSectionId, boolean>> {
  if (density === 'balanced' || density === 'full') return {};
  return {
    relief_checklist: false,
    opportunities: false,
    recent_done: false,
    priorities: false,
    self_care: false,
    mood: false,
    child_tracking: false,
    budget: false,
    coffre_strip: false,
    equity: false,
    debordee: false,
  };
}

function welcomeWizardV2Key(email: string): string {
  return `${WELCOME_WIZARD_V2_PREFIX}:${userEmailStorageSlug(email)}`;
}

/** Parcours d’accueil complet (profil + tutoriels + personnalisation). */
export function isWelcomeWizardV2Complete(email: string | null | undefined): boolean {
  if (typeof window === 'undefined' || !email?.trim()) return true;
  try {
    return window.localStorage.getItem(welcomeWizardV2Key(email)) === '1';
  } catch {
    return true;
  }
}

export function markWelcomeWizardV2Complete(email: string): void {
  if (typeof window === 'undefined' || !email.trim()) return;
  try {
    window.localStorage.setItem(welcomeWizardV2Key(email), '1');
  } catch {
    /* ignore */
  }
}

export function clearWelcomeWizardV2Flag(email: string): void {
  if (typeof window === 'undefined' || !email.trim()) return;
  try {
    window.localStorage.removeItem(welcomeWizardV2Key(email));
  } catch {
    /* ignore */
  }
}

function postLoginDoneKey(email: string): string {
  return `${POST_LOGIN_DONE_PREFIX}:${userEmailStorageSlug(email)}`;
}

export function isPostLoginPersonalizationComplete(email: string | null | undefined): boolean {
  if (typeof window === 'undefined' || !email?.trim()) return true;
  try {
    return window.localStorage.getItem(postLoginDoneKey(email)) === '1';
  } catch {
    return true;
  }
}

export function markPostLoginPersonalizationComplete(email: string): void {
  if (typeof window === 'undefined' || !email.trim()) return;
  try {
    window.localStorage.setItem(postLoginDoneKey(email), '1');
  } catch {
    /* ignore */
  }
}

/** Pour paramètres > réinitialiser la personnalisation depuis Réglages (optionnel). */
export function clearPostLoginPersonalizationFlag(email: string): void {
  if (typeof window === 'undefined' || !email.trim()) return;
  try {
    window.localStorage.removeItem(postLoginDoneKey(email));
  } catch {
    /* ignore */
  }
}

/**
 * Construit une disposition d’accueil à partir des choix du flux post-connexion.
 */
export function buildHomeLayoutFromPostLoginChoices(
  interests: PostLoginInterestId[],
  density: PostLoginDensity,
): HomeLayoutConfig {
  const base = mergeHomeLayout(null);
  const sections: Record<HomeSectionId, boolean> = {
    ...DEFAULT_HOME_SECTIONS,
    ...densitySectionPatch(density),
  };

  const interestSet = new Set(interests);
  for (const id of interestSet) {
    const patch = INTEREST_SECTIONS[id];
    if (!patch) continue;
    for (const [k, v] of Object.entries(patch) as [HomeSectionId, boolean][]) {
      sections[k] = v;
    }
  }

  if (density === 'full') {
    for (const k of Object.keys(DEFAULT_HOME_SECTIONS) as HomeSectionId[]) {
      sections[k] = true;
    }
  }

  const hubOrder: HubKey[] = [];
  for (const opt of POST_LOGIN_INTEREST_OPTIONS) {
    if (!interestSet.has(opt.id)) continue;
    for (const h of INTEREST_HUBS[opt.id]) {
      if (!hubOrder.includes(h)) hubOrder.push(h);
    }
  }
  for (const h of DEFAULT_HOME_HUB_SHORTCUTS) {
    if (!hubOrder.includes(h)) hubOrder.push(h);
  }

  const hubShortcuts = normalizeHubShortcuts(hubOrder).slice(0, 8);

  return mergeHomeLayout({ sections, hubShortcuts });
}
