import { getJson, putJson } from './api';

export type SelfMoment = { id: string; label: string; done: boolean };

export type MoiWellnessApi = {
  household_id: number;
  journal: string;
  cycle_day: number;
  moments: SelfMoment[];
  sleep_hours: number;
  moi_mood: number;
  home_mood: number | null;
  updated_at: string;
};

export const DEFAULT_SELF_MOMENTS: SelfMoment[] = [
  { id: 'm1', label: '20 min de marche sans téléphone', done: false },
  { id: 'm2', label: '10 min respiration / méditation', done: false },
  { id: 'm3', label: 'Lire 15 pages ce soir', done: false },
];

export async function fetchMoiWellness(token: string): Promise<MoiWellnessApi> {
  return getJson<MoiWellnessApi>('/api/v1/moi/wellness', token);
}

export type MoiWellnessPayload = {
  journal: string;
  cycle_day: number;
  moments: SelfMoment[];
  sleep_hours: number;
  moi_mood: number;
  home_mood: number | null;
};

export async function putMoiWellness(payload: MoiWellnessPayload, token: string): Promise<MoiWellnessApi> {
  return putJson<MoiWellnessApi>('/api/v1/moi/wellness', payload, token);
}
