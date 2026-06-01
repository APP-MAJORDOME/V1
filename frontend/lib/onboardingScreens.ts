/** Catalogue des écrans du parcours post-connexion (aperçu + wizard). */

export type OnboardingScreenKind = 'intro' | 'profile' | 'personalize';

export type OnboardingScreenDef = {
  id: string;
  step: number;
  kind: OnboardingScreenKind;
  title: string;
  subtitle: string;
};

export const ONBOARDING_TOTAL_STEPS = 10;

export const ONBOARDING_SCREENS: OnboardingScreenDef[] = [
  {
    id: 'welcome',
    step: 1,
    kind: 'intro',
    title: 'Bienvenue dans MajorDome',
    subtitle: 'Ton majordome familial : moins de charge mentale, moins d’oublis.',
  },
  {
    id: 'today',
    step: 2,
    kind: 'intro',
    title: 'Écran « Aujourd’hui »',
    subtitle: 'Briefing du jour, urgences, météo mentale et accès rapide à tes modules.',
  },
  {
    id: 'alfred',
    step: 3,
    kind: 'intro',
    title: 'Alfred, ton co-pilote',
    subtitle: 'Chat, triage « je suis débordée », rappels et actions en un clic.',
  },
  {
    id: 'agenda',
    step: 4,
    kind: 'intro',
    title: 'Agenda & tâches',
    subtitle: 'Calendrier unifié, priorités, assignation au partenaire ou aux enfants.',
  },
  {
    id: 'courses',
    step: 5,
    kind: 'intro',
    title: 'Courses, frigo & budget',
    subtitle: 'Liste de courses, dates limites, enveloppes budgétaires et wallet.',
  },
  {
    id: 'coffre',
    step: 6,
    kind: 'intro',
    title: 'Coffre & courrier',
    subtitle: 'Passeports, mutuelle, courrier scolaire — centralisés pour le foyer.',
  },
  {
    id: 'equite',
    step: 7,
    kind: 'intro',
    title: 'Équité du foyer',
    subtitle: 'Visualise qui porte quoi et délègue sans tout garder en tête.',
  },
  {
    id: 'prenom',
    step: 8,
    kind: 'profile',
    title: 'Comment tu t’appelles ?',
    subtitle: 'Pour personnaliser les textes et les suggestions Alfred.',
  },
  {
    id: 'foyer',
    step: 9,
    kind: 'profile',
    title: 'Ton foyer',
    subtitle: 'Partenaire, enfant(s) — pour l’équité et les rappels ciblés.',
  },
  {
    id: 'personalize',
    step: 10,
    kind: 'personalize',
    title: 'Objectif & priorités',
    subtitle: 'Choisis ton cap et les modules à mettre en avant sur l’accueil.',
  },
];
