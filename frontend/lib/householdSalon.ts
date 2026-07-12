import { getJson, patchJson, postJson } from './api';
import type { CaptureChip, HouseholdCapture, SalonMessage } from './householdCaptures';

export type SalonMessageApi = {
  id: number;
  author_user_id: number | null;
  author_label: string;
  body_text: string;
  created_at: string;
};

export type CaptureApi = {
  id: number;
  kind: string;
  status: string;
  source: string;
  chip: string;
  source_label: string;
  excerpt: string;
  inferences: string[];
  cta_primary: string | null;
  cta_secondary: string | null;
  created_label: string | null;
  payload?: Record<string, unknown>;
};

function structuredFromPayload(row: CaptureApi): {
  type: string;
  title: string;
  when?: string;
  assignee?: string;
} {
  const payload = row.payload ?? {};
  const structured = payload.structured as Record<string, string> | undefined;
  if (structured?.title) {
    return {
      type: structured.type || 'suggestion',
      title: structured.title,
      when: structured.when,
      assignee: structured.assignee,
    };
  }
  const proposal = payload.proposal as Record<string, string> | undefined;
  const intent = String(payload.intent || row.kind);
  const type =
    intent.includes('event') ? 'event' : intent.includes('grocery') ? 'grocery' : row.kind === 'suggestion' ? 'suggestion' : 'task';
  return {
    type,
    title: proposal?.title || proposal?.label || row.source_label,
    when: proposal?.when || '',
    assignee: proposal?.assignee || '',
  };
}

export function mapCaptureApi(row: CaptureApi): HouseholdCapture & {
  structured?: { type: string; title: string; when?: string; assignee?: string };
} {
  const structured = structuredFromPayload(row);
  return {
    id: String(row.id),
    kind: row.kind as HouseholdCapture['kind'],
    status: row.status as HouseholdCapture['status'],
    source: row.source as HouseholdCapture['source'],
    chip: row.chip as HouseholdCapture['chip'],
    createdLabel: row.created_label || '',
    sourceLabel: row.source_label,
    excerpt: row.excerpt,
    inferences: row.inferences || [],
    ctaPrimary: row.cta_primary || undefined,
    ctaSecondary: row.cta_secondary || undefined,
    structured,
  };
}

export function mapSalonMessageApi(
  row: SalonMessageApi,
  selfName: string,
  captures: HouseholdCapture[],
): SalonMessage {
  const low = row.author_label.toLowerCase();
  let author: SalonMessage['author'] = 'partner';
  if (low.includes('alfred') || low === 'asse') author = 'alfred';
  else if (selfName && low.includes(selfName.trim().toLowerCase().split(' ')[0])) author = 'self';

  const time = row.created_at
    ? new Date(row.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  let proposal: SalonMessage['proposal'];
  let displayText = row.body_text;

  if (author === 'alfred') {
    // Briefings / messages système : jamais de carte capture collée
    const isBriefing = /briefing du jour/i.test(row.body_text);
    const capMatch = row.body_text.match(/^\[\[cap:(\d+)\]\]\s*/);
    const capIdFromBody = capMatch?.[1];
    displayText = capMatch ? row.body_text.replace(capMatch[0], '').trim() : row.body_text;

    if (!isBriefing) {
      const pending = captures.filter((c) => c.status === 'pending');
      let cap =
        (capIdFromBody ? pending.find((c) => c.id === capIdFromBody) : undefined) ||
        pending.find((c) => {
          const ex = c.excerpt.replace(/[«»"]/g, '').trim().toLowerCase().slice(0, 24);
          if (!ex) return false;
          return displayText.toLowerCase().includes(ex) || c.excerpt.toLowerCase().includes(displayText.slice(0, 24).toLowerCase());
        });
      // Pas de fallback sur « dernière capture » — c’était la cause du dentiste partout
      if (cap) {
        const st = (cap as { structured?: { type: string; title: string; when?: string; assignee?: string } })
          .structured;
        proposal = {
          title: st?.title || cap.excerpt.replace(/[«»]/g, '').trim() || cap.sourceLabel,
          lines: cap.inferences,
          captureId: cap.id,
          captureType: (st?.type as 'event' | 'task' | 'grocery' | 'suggestion') || 'suggestion',
          when: st?.when,
          assignee: st?.assignee,
        };
      }
    }
  }

  return {
    id: String(row.id),
    author,
    authorLabel: row.author_label,
    text: displayText,
    time,
    proposal,
  };
}

export async function fetchSalonMessages(token: string, seedIfEmpty = true): Promise<SalonMessageApi[]> {
  const q = seedIfEmpty ? '' : '?seed_if_empty=false';
  return getJson<SalonMessageApi[]>(`/api/v1/household/salon/messages${q}`, token);
}

export async function postSalonMessage(token: string, text: string): Promise<SalonMessageApi> {
  return postJson<SalonMessageApi>('/api/v1/household/salon/messages', { text }, token);
}

export async function fetchSalonCaptures(
  token: string,
  status?: 'pending' | 'approved' | 'rejected',
): Promise<CaptureApi[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return getJson<CaptureApi[]>(`/api/v1/household/salon/captures${q}`, token);
}

export async function patchSalonCapture(
  token: string,
  captureId: number,
  status: 'approved' | 'rejected',
): Promise<{ message: string; payload: Record<string, unknown> }> {
  return patchJson(`/api/v1/household/salon/captures/${captureId}`, { status }, token);
}

export async function analyzeSalon(token: string): Promise<{ captures_created: number; message: string }> {
  return postJson('/api/v1/household/salon/analyze', {}, token);
}

export function filterCapturesByChipLocal(
  captures: HouseholdCapture[],
  chip: CaptureChip,
): HouseholdCapture[] {
  if (chip === 'all') return captures;
  return captures.filter((c) => c.chip === chip);
}
