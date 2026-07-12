/** Onboarding v2 — 4 écrans + capture guidée (F1-8). */

export const ONBOARDING_V2_TOTAL_STEPS = 4;

export type HouseholdTypeId = 'famille' | 'parent_solo' | 'couple' | 'coloc' | 'aidant';

export const HOUSEHOLD_TYPE_OPTIONS: { id: HouseholdTypeId; label: string; hint: string }[] = [
  { id: 'famille', label: 'Famille avec enfants', hint: 'Agenda, école, équité' },
  { id: 'parent_solo', label: 'Parent solo', hint: 'Charge mentale, rappels' },
  { id: 'couple', label: 'Couple', hint: 'Répartition, agenda partagé' },
  { id: 'coloc', label: 'Colocation', hint: 'Courses, tâches communes' },
  { id: 'aidant', label: 'Aidant familial', hint: 'Suivi, documents, RDV' },
];

export const MEMBER_COLORS = ['#C96B4A', '#4A7C8F', '#7C8F4A', '#8F4A7C', '#B8860B', '#5D6D7E'];

export const GUIDED_CAPTURE_PROMPT = 'dentiste Léa mardi 15h';
export const GUIDED_CAPTURE_STORAGE_KEY = 'majordome_guided_capture_pending';
