import { deleteJson, getJson, patchJson, postJson } from './api';

export type AgentInterpretResponse = {
  intent: string;
  mode: string;
  explanation: string;
  proposal?: Record<string, unknown>;
};

export type AgentExecutionResult = { done: boolean; message?: string };

export type AgentActResponse = {
  status: string;
  preview: AgentInterpretResponse;
  message?: string | null;
  result?: Record<string, unknown> | null;
};

/** Exécution côté serveur (tâches, courses, mémoire, événements…). */
export async function runServerAgentAct(
  token: string,
  command: string,
): Promise<{ completed: boolean; message?: string; preview: AgentInterpretResponse }> {
  const act = await postJson<AgentActResponse>('/api/v1/agent/act', { command }, token);
  if (act.status === 'completed' && act.message) {
    return { completed: true, message: act.message, preview: act.preview };
  }
  return { completed: false, preview: act.preview };
}

export type AlfredWebSource = { title: string; snippet?: string; url: string };

export type AlfredShoppingIngredient = {
  label: string;
  qty?: string;
  price_eur?: number;
  on_promo?: boolean;
  store_hint?: string;
};

export type AlfredVaultStoreLink = {
  store: string;
  service_key: string;
  label?: string;
  username?: string | null;
  has_password?: boolean;
  login_url?: string | null;
  drive_status?: string;
};

export type AlfredShoppingPlan = {
  recipe_title: string;
  servings?: number;
  stores?: string[];
  mood_note?: string;
  ingredients: AlfredShoppingIngredient[];
  total_eur?: number;
  promo_tips?: string[];
  disclaimer?: string;
  vault_links?: AlfredVaultStoreLink[];
};

/** Document du coffre cité par Alfred (consultation foyer). */
export type AlfredVaultDocument = {
  id: number;
  name: string;
  category?: string;
  has_file?: boolean;
};

export type AlfredMessageAttachment = {
  name: string;
  mime: string;
  previewUrl?: string;
};

/** Types acceptés par Alfred (alignés sur l’API). */
export const ALFRED_FILE_ACCEPT =
  '.pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp,image/gif,application/pdf';

export const ALFRED_FILE_MAX_MB = 12;

/** IDs de documents du coffre cités par Alfred (consultation foyer). */
export function extractVaultDocumentIds(proposal?: Record<string, unknown>): number[] {
  return extractVaultDocuments(proposal).map((d) => d.id);
}

export function extractVaultDocuments(proposal?: Record<string, unknown>): AlfredVaultDocument[] {
  const vault = proposal?.vault_documents;
  if (Array.isArray(vault)) {
    const out: AlfredVaultDocument[] = [];
    for (const item of vault) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id =
        typeof row.id === 'number'
          ? row.id
          : parseInt(String(row.id ?? row.document_id ?? ''), 10);
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!Number.isFinite(id) || id <= 0 || !name) continue;
      out.push({
        id,
        name,
        category: typeof row.category === 'string' ? row.category : undefined,
        has_file: typeof row.has_file === 'boolean' ? row.has_file : undefined,
      });
    }
    if (out.length > 0) return out.slice(0, 6);
  }
  const raw = proposal?.sources;
  if (!Array.isArray(raw)) return [];
  const fromSources: AlfredVaultDocument[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id =
      typeof row.document_id === 'number'
        ? row.document_id
        : parseInt(String(row.document_id ?? ''), 10);
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    fromSources.push({
      id,
      name,
      category: typeof row.category === 'string' ? row.category : undefined,
      has_file: typeof row.has_file === 'boolean' ? row.has_file : undefined,
    });
  }
  return fromSources.slice(0, 6);
}

export function isAlfredConsultationIntent(intent: string): boolean {
  return intent === 'household_answer' || intent === 'web_search' || intent === 'document_analyze';
}

export function extractWebSources(proposal?: Record<string, unknown>): AlfredWebSource[] {
  const raw = proposal?.sources;
  if (!Array.isArray(raw)) return [];
  const out: AlfredWebSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!url || !title) continue;
    const snippet = typeof row.snippet === 'string' ? row.snippet.trim() : undefined;
    out.push({ title, url, snippet: snippet || undefined });
  }
  return out.slice(0, 6);
}

export function extractShoppingPlan(proposal?: Record<string, unknown>): AlfredShoppingPlan | null {
  const raw = proposal?.shopping_plan;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const title = typeof row.recipe_title === 'string' ? row.recipe_title.trim() : '';
  const ingredientsRaw = row.ingredients;
  if (!title || !Array.isArray(ingredientsRaw)) return null;
  const ingredients: AlfredShoppingIngredient[] = [];
  for (const item of ingredientsRaw) {
    if (!item || typeof item !== 'object') continue;
    const ing = item as Record<string, unknown>;
    const label = typeof ing.label === 'string' ? ing.label.trim() : '';
    if (!label) continue;
    ingredients.push({
      label,
      qty: typeof ing.qty === 'string' ? ing.qty.trim() : undefined,
      price_eur: typeof ing.price_eur === 'number' ? ing.price_eur : undefined,
      on_promo: ing.on_promo === true,
      store_hint: typeof ing.store_hint === 'string' ? ing.store_hint.trim() : undefined,
    });
  }
  if (ingredients.length === 0) return null;
  const tipsRaw = row.promo_tips;
  const promo_tips = Array.isArray(tipsRaw)
    ? tipsRaw.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
    : undefined;
  const storesRaw = row.stores;
  const stores = Array.isArray(storesRaw)
    ? storesRaw.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
    : undefined;
  const vaultRaw = row.vault_links ?? proposal?.vault_links;
  const vault_links: AlfredVaultStoreLink[] = [];
  if (Array.isArray(vaultRaw)) {
    for (const item of vaultRaw) {
      if (!item || typeof item !== 'object') continue;
      const v = item as Record<string, unknown>;
      const store = typeof v.store === 'string' ? v.store.trim() : '';
      if (!store) continue;
      vault_links.push({
        store,
        service_key: typeof v.service_key === 'string' ? v.service_key : 'other',
        label: typeof v.label === 'string' ? v.label : undefined,
        username: typeof v.username === 'string' ? v.username : null,
        has_password: v.has_password === true,
        login_url: typeof v.login_url === 'string' ? v.login_url : null,
        drive_status: typeof v.drive_status === 'string' ? v.drive_status : undefined,
      });
    }
  }
  return {
    recipe_title: title,
    servings: typeof row.servings === 'number' ? row.servings : undefined,
    stores,
    mood_note: typeof row.mood_note === 'string' ? row.mood_note.trim() : undefined,
    ingredients,
    total_eur: typeof row.total_eur === 'number' ? row.total_eur : undefined,
    promo_tips,
    disclaimer: typeof row.disclaimer === 'string' ? row.disclaimer.trim() : undefined,
    vault_links: vault_links.length > 0 ? vault_links : undefined,
  };
}

export type AlfredTask = { id: number; title: string };
export type AlfredMember = { id: number; display_name: string };
export type AlfredAccount = { provider: string; status: string };
export type AlfredEvent = { id: number; title: string; starts_at: string; ends_at: string };

export type AlfredFamilyProfile = { prenom: string; partenaire: string; enfant: string };

export type AlfredExecuteCallbacks = {
  onAddCourse: (label: string) => void;
  onTaskCreated: (task: AlfredTask) => void;
  onTaskUpdated: (task: AlfredTask) => void;
  onEventCreated: (event: AlfredEvent) => void;
  onMemoryNote: (note: string) => void;
  refreshTaskSummary: () => void;
};

export type AlfredExecuteContext = {
  token: string;
  rawCommand: string;
  interpreted: AgentInterpretResponse;
  openTasks: AlfredTask[];
  householdMembers: AlfredMember[];
  familyProfile: AlfredFamilyProfile;
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  accounts: AlfredAccount[];
  callbacks: AlfredExecuteCallbacks;
};

export function agentNeedsConfirm(res: AgentInterpretResponse): boolean {
  if (res.mode === 'confirm' || res.mode === 'suggest') return true;
  return ['email_draft', 'call_prepare', 'event_create'].includes(res.intent);
}

export function confirmLabelForIntent(intent: string): string {
  if (intent === 'event_create') return "Ajouter à l'agenda";
  if (intent === 'email_draft') return 'Ouvrir le brouillon';
  if (intent === 'call_prepare') return 'Copier le script';
  if (intent === 'shopping_plan') return 'Ajouter à la liste courses';
  if (intent === 'home_control') return 'Exécuter domotique';
  return 'Confirmer';
}

export function tryExtractAlfredMemory(userText: string): string | null {
  const t = userText.trim();
  if (!t) return null;
  if (/^(souviens-toi|note que|rappelle-toi)\s*:/i.test(t)) {
    const rest = t.replace(/^[^:]+:\s*/i, '').trim();
    return rest.length > 3 ? rest.slice(0, 220) : null;
  }
  if (/\b(allergi|intolérance|numéro de sécu|notre adresse|code porte)\b/i.test(t) && t.length > 12) {
    return t.slice(0, 220);
  }
  return null;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Exécute une intention Alfred (texte, voix ou confirmation). */
export async function executeAgentIntent(ctx: AlfredExecuteContext): Promise<AgentExecutionResult> {
  const { token, interpreted, callbacks } = ctx;
  const proposal = interpreted.proposal ?? {};
  const toStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const command = ctx.rawCommand.trim();
  const lowered = command.toLowerCase();
  const commandNormalized = normalizeText(command);
  const titleFromProposal = toStr((proposal as { title?: unknown }).title);
  const title = titleFromProposal || command;

  const findTaskByTitle = (hint: string): AlfredTask | null => {
    const h = normalizeText(hint);
    if (!h) return null;
    return (
      ctx.openTasks.find((t) => normalizeText(t.title) === h) ??
      ctx.openTasks.find((t) => {
        const nt = normalizeText(t.title);
        return nt.includes(h) || h.includes(nt);
      }) ??
      null
    );
  };

  const findAssigneeMemberId = (hint: string): number | null => {
    const name = normalizeText(hint);
    if (!name) return null;
    const { familyProfile: fam, primaryMemberId, partnerMemberId, childMemberId } = ctx;
    if (fam.prenom && name.includes(normalizeText(fam.prenom))) return primaryMemberId;
    if (fam.partenaire && name.includes(normalizeText(fam.partenaire))) return partnerMemberId;
    if (fam.enfant && name.includes(normalizeText(fam.enfant))) return childMemberId;
    return (
      ctx.householdMembers.find((m) => {
        const n = normalizeText(m.display_name);
        return n === name || n.includes(name) || name.includes(n);
      })?.id ?? null
    );
  };

  const assigneeHint =
    toStr((proposal as { assignee?: unknown }).assignee) ||
    toStr((proposal as { member_name?: unknown }).member_name) ||
    toStr((proposal as { assigned_to?: unknown }).assigned_to);

  const isGrocery =
    interpreted.intent === 'grocery_add' ||
    lowered.includes('liste de courses') ||
    lowered.includes('liste courses') ||
    (lowered.includes('courses') && (lowered.includes('ajoute') || lowered.includes('rajoute'))) ||
    (lowered.includes('liste') && (lowered.includes('ajoute') || lowered.includes('rajoute')));

  if (interpreted.intent === 'memory_store') {
    const note =
      toStr((proposal as { note?: unknown }).note) ||
      toStr((proposal as { title?: unknown }).title) ||
      command.slice(0, 220);
    if (note.length >= 3) {
      callbacks.onMemoryNote(note);
      void postJson('/api/v1/memory/facts', { fact_text: note }, token).catch(() => undefined);
      return { done: true, message: "C'est noté, je m'en souviendrai." };
    }
  }

  if (isGrocery) {
    const itemLabel =
      toStr((proposal as { label?: unknown }).label) ||
      titleFromProposal ||
      (() => {
        const m = command.match(/ajoute(?:r)?\s+(.+?)(?:\s+(?:à|a)\s+la\s+liste|\s*$)/i);
        return m?.[1]?.trim() ?? '';
      })() ||
      command.replace(/^(ajoute|rajoute)\s+/i, '').trim().slice(0, 80);
    if (itemLabel.length >= 2) {
      callbacks.onAddCourse(itemLabel);
      return { done: true, message: `« ${itemLabel} » ajouté à ta liste de courses.` };
    }
  }

  if (
    interpreted.intent === 'task_create' ||
    (lowered.startsWith('ajoute ') && !isGrocery) ||
    (lowered.includes('rajoute') && !isGrocery)
  ) {
    const created = await postJson<AlfredTask>('/api/v1/tasks', { title, task_type: 'manual_task' }, token);
    callbacks.onTaskCreated(created);
    callbacks.refreshTaskSummary();
    return { done: true, message: `C'est fait. Tâche créée : ${created.title}` };
  }

  const shouldAssign =
    interpreted.intent === 'task_assign' ||
    interpreted.intent.includes('assign') ||
    interpreted.intent.includes('delegate') ||
    commandNormalized.includes('assigne');
  if (shouldAssign) {
    const idFromProposal = Number((proposal as { task_id?: unknown }).task_id || 0);
    const taskHint = toStr((proposal as { task_title?: unknown }).task_title) || title;
    const task =
      (idFromProposal > 0 ? ctx.openTasks.find((t) => t.id === idFromProposal) : null) ??
      findTaskByTitle(taskHint);
    const extractedName =
      assigneeHint ||
      (() => {
        const m = commandNormalized.match(/(?:assigne|attribue).+?(?:a|à)\s+([a-z0-9 _-]{2,40})/i);
        return m?.[1]?.trim() ?? '';
      })();
    const memberId = findAssigneeMemberId(extractedName);
    if (task && memberId) {
      const updated = await patchJson<AlfredTask>(
        `/api/v1/tasks/${task.id}`,
        { assigned_member_id: memberId },
        token,
      );
      callbacks.onTaskUpdated(updated);
      return { done: true, message: `Ok, j'ai assigné « ${task.title} ».` };
    }
  }

  const shouldComplete =
    interpreted.intent === 'task_complete' ||
    interpreted.intent.includes('complete') ||
    commandNormalized.includes('termine');
  if (shouldComplete) {
    const idFromProposal = Number((proposal as { task_id?: unknown }).task_id || 0);
    const taskHint = toStr((proposal as { task_title?: unknown }).task_title) || title;
    const task =
      (idFromProposal > 0 ? ctx.openTasks.find((t) => t.id === idFromProposal) : null) ??
      findTaskByTitle(taskHint);
    if (task) {
      const updated = await postJson<AlfredTask>(`/api/v1/tasks/${task.id}/complete`, {}, token);
      callbacks.onTaskUpdated(updated);
      callbacks.refreshTaskSummary();
      return { done: true, message: `Terminé. « ${task.title} » est marquée faite.` };
    }
  }

  if (interpreted.intent === 'shopping_plan') {
    const plan = extractShoppingPlan(proposal);
    if (plan?.ingredients.length) {
      let count = 0;
      for (const ing of plan.ingredients) {
        const label = ing.qty ? `${ing.label} (${ing.qty})` : ing.label;
        try {
          await postJson('/api/v1/grocery/items', { label }, token);
          callbacks.onAddCourse(label);
          count += 1;
        } catch {
          /* ignore duplicate / network */
        }
      }
      if (count > 0) {
        return {
          done: true,
          message: `${count} ingrédient(s) ajouté(s) à ta liste de courses pour « ${plan.recipe_title} ».`,
        };
      }
    }
  }

  if (interpreted.intent === 'email_draft' && typeof window !== 'undefined') {
    const subject = toStr((proposal as { subject?: unknown }).subject) || 'Message';
    const body = toStr((proposal as { body?: unknown }).body) || '';
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { done: true, message: 'Brouillon email ouvert dans ton application mail.' };
  }

  if (interpreted.intent === 'call_prepare') {
    const script = toStr((proposal as { script?: unknown }).script) || command;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(script);
    }
    return { done: true, message: `Script d’appel copié :\n${script.slice(0, 200)}` };
  }

  const shouldCreateEvent =
    interpreted.intent === 'event_create' ||
    interpreted.intent.includes('event') ||
    interpreted.intent.includes('schedule') ||
    commandNormalized.includes('emploi du temps') ||
    commandNormalized.includes('rendez-vous') ||
    commandNormalized.includes('agenda');
  if (
    interpreted.intent === 'web_search' ||
    interpreted.intent === 'document_analyze' ||
    interpreted.intent === 'household_answer'
  ) {
    return { done: false };
  }

  if (shouldCreateEvent) {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const startsAt = toStr((proposal as { starts_at?: unknown }).starts_at) || now.toISOString();
    const endsAt = toStr((proposal as { ends_at?: unknown }).ends_at) || inOneHour.toISOString();
    const eventTitle = titleFromProposal || command.slice(0, 120);
    const msConnected = ctx.accounts.some(
      (a) => a.provider === 'microsoft_calendar' && a.status === 'connected',
    );
    const googleConnected = ctx.accounts.some(
      (a) => a.provider === 'google_calendar' && a.status === 'connected',
    );
    const eventProvider = msConnected ? 'microsoft_calendar' : googleConnected ? 'google_calendar' : 'none';
    const created = await postJson<AlfredEvent>(
      '/api/v1/events/create-and-sync',
      { title: eventTitle, starts_at: startsAt, ends_at: endsAt, provider: eventProvider },
      token,
    );
    callbacks.onEventCreated(created);
    return { done: true, message: `C'est noté. Événement ajouté : ${eventTitle}` };
  }

  return { done: false };
}

export async function clearAlfredMemoryServer(token: string): Promise<void> {
  const facts = await getJson<{ id: number }[]>('/api/v1/memory/facts', token);
  await Promise.all(facts.map((f) => deleteJson(`/api/v1/memory/facts/${f.id}`, token)));
}
