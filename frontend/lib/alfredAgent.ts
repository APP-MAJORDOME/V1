import { deleteJson, getJson, patchJson, postJson } from './api';
import { extractGroceryLabel, looksLikeGroceryAdd, looksLikeGroceryCorrection } from './groceryIntent';

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
  forceExecute = false,
): Promise<{ completed: boolean; message?: string; preview: AgentInterpretResponse }> {
  const act = await postJson<AgentActResponse>(
    '/api/v1/agent/act',
    { command, force_execute: forceExecute },
    token,
  );
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
  open_url?: string | null;
  drive_status?: string;
  drive_action?: string;
};

export type AlfredDriveCartItem = {
  id: number;
  label: string;
};

export type AlfredDriveSearchLink = {
  id?: number;
  label: string;
  search_url: string;
};

export type AlfredDrivePrepare = {
  status: string;
  service_key: string;
  store: string;
  open_url?: string | null;
  automation?: string;
  secret_id?: number | null;
  username?: string | null;
  label?: string | null;
  steps?: string[];
  message?: string;
  cart_items?: AlfredDriveCartItem[];
  cart_count?: number;
  cart_text?: string;
  cart_search_links?: AlfredDriveSearchLink[];
  cart_search_batch_url?: string | null;
  logged_in?: boolean;
  automation_detail?: string;
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
        open_url:
          typeof v.open_url === 'string'
            ? v.open_url
            : typeof v.login_url === 'string'
              ? v.login_url
              : null,
        drive_status: typeof v.drive_status === 'string' ? v.drive_status : undefined,
        drive_action: typeof v.drive_action === 'string' ? v.drive_action : undefined,
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

export function extractDrivePrepare(proposal?: Record<string, unknown>): AlfredDrivePrepare | null {
  const raw = proposal?.drive_prepare;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const store = typeof row.store === 'string' ? row.store.trim() : '';
  const service_key = typeof row.service_key === 'string' ? row.service_key.trim() : '';
  const status = typeof row.status === 'string' ? row.status.trim() : '';
  if (!store || !service_key || !status) return null;
  const stepsRaw = row.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : undefined;
  const cartRaw = row.cart_items;
  const cart_items: AlfredDriveCartItem[] = [];
  if (Array.isArray(cartRaw)) {
    for (const item of cartRaw) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      const id = typeof c.id === 'number' ? c.id : parseInt(String(c.id ?? ''), 10);
      const label = typeof c.label === 'string' ? c.label.trim() : '';
      if (!Number.isFinite(id) || !label) continue;
      cart_items.push({ id, label });
    }
  }
  const searchRaw = row.cart_search_links;
  const cart_search_links: AlfredDriveSearchLink[] = [];
  if (Array.isArray(searchRaw)) {
    for (const item of searchRaw) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      const label = typeof s.label === 'string' ? s.label.trim() : '';
      const search_url = typeof s.search_url === 'string' ? s.search_url.trim() : '';
      if (!label || !search_url) continue;
      const id = typeof s.id === 'number' ? s.id : undefined;
      cart_search_links.push({ id, label, search_url });
    }
  }
  return {
    status,
    service_key,
    store,
    open_url: typeof row.open_url === 'string' ? row.open_url.trim() : null,
    automation: typeof row.automation === 'string' ? row.automation : undefined,
    secret_id: typeof row.secret_id === 'number' ? row.secret_id : null,
    username: typeof row.username === 'string' ? row.username : null,
    label: typeof row.label === 'string' ? row.label : null,
    steps,
    message: typeof row.message === 'string' ? row.message.trim() : undefined,
    cart_items: cart_items.length > 0 ? cart_items : undefined,
    cart_count: typeof row.cart_count === 'number' ? row.cart_count : cart_items.length || undefined,
    cart_text: typeof row.cart_text === 'string' ? row.cart_text : undefined,
    cart_search_links: cart_search_links.length > 0 ? cart_search_links : undefined,
    cart_search_batch_url:
      typeof row.cart_search_batch_url === 'string' ? row.cart_search_batch_url.trim() : null,
    logged_in: row.logged_in === true,
    automation_detail: typeof row.automation_detail === 'string' ? row.automation_detail.trim() : undefined,
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
  if (intent === 'drive_prepare') return 'Ouvrir le Drive';
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
    looksLikeGroceryAdd(command) ||
    looksLikeGroceryCorrection(command) ||
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
    let itemLabel =
      toStr((proposal as { label?: unknown }).label) ||
      extractGroceryLabel(command) ||
      titleFromProposal;
    if (
      looksLikeGroceryCorrection(command) ||
      !itemLabel ||
      ['le', 'la', 'les', 'en'].includes(normalizeText(itemLabel))
    ) {
      const recent = ctx.openTasks[0];
      if (recent?.title) {
        itemLabel = extractGroceryLabel(recent.title) || extractGroceryLabel(`ajoute ${recent.title}`) || recent.title;
        // retire la tâche créée par erreur si on corrige
        void deleteJson(`/api/v1/tasks/${recent.id}`, token).catch(() => undefined);
        callbacks.refreshTaskSummary();
      }
    }
    itemLabel = extractGroceryLabel(itemLabel || command) || itemLabel;
    if (itemLabel && itemLabel.length >= 2) {
      callbacks.onAddCourse(itemLabel);
      return { done: true, message: `« ${itemLabel} » ajouté à ta liste de courses.` };
    }
  }

  if (
    interpreted.intent === 'task_create' ||
    ((lowered.startsWith('ajoute ') || lowered.startsWith('ajoute-moi') || lowered.includes('rajoute')) &&
      !isGrocery)
  ) {
    if (looksLikeGroceryAdd(command)) {
      const itemLabel =
        toStr((proposal as { label?: unknown }).label) || extractGroceryLabel(command) || titleFromProposal;
      if (itemLabel.length >= 2) {
        callbacks.onAddCourse(itemLabel);
        return { done: true, message: `« ${itemLabel} » ajouté à ta liste de courses.` };
      }
    }
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

  if (interpreted.intent === 'drive_prepare') {
    const prep = extractDrivePrepare(proposal);
    let url = prep?.open_url?.trim();
    const cartText = prep?.cart_text?.trim();
    if (
      prep?.service_key === 'carrefour' &&
      prep.status === 'ready' &&
      !prep.logged_in &&
      token
    ) {
      try {
        const auto = await postJson<{
          logged_in?: boolean;
          open_url?: string | null;
          message?: string;
        }>(`/api/v1/vault/drive/${encodeURIComponent(prep.service_key)}/automate-login`, {}, token);
        if (auto.logged_in && auto.open_url) {
          url = auto.open_url.trim();
        }
        if (auto.logged_in && auto.message) {
          prep.message = auto.message;
        }
      } catch {
        /* ouverture manuelle */
      }
    }
    if (cartText && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(cartText);
    }
    if (
      prep?.service_key === 'carrefour' &&
      prep.status === 'ready' &&
      (prep.cart_count ?? 0) > 0 &&
      token
    ) {
      try {
        const fill = await postJson<{
          status?: string;
          message?: string;
          items_added?: number;
          open_url?: string | null;
        }>(`/api/v1/vault/drive/${encodeURIComponent(prep.service_key)}/fill-cart`, {}, token);
        if (fill.open_url) url = fill.open_url.trim();
        if (fill.message) prep.message = fill.message;
      } catch {
        /* ouverture manuelle */
      }
    }
    if (prep?.status === 'ready' && url && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      const cartNote =
        cartText && prep.cart_count
          ? ` Liste de ${prep.cart_count} article(s) copiée dans le presse-papiers.`
          : '';
      const loginNote = prep.logged_in ? ' Connexion Drive auto OK.' : '';
      return {
        done: true,
        message: (prep.message || `Drive ${prep.store} ouvert dans un nouvel onglet.`) + loginNote + cartNote,
      };
    }
    if (prep?.status === 'needs_credentials') {
      return {
        done: false,
        message:
          prep.message ||
          'Ajoute ton compte enseigne dans Réglages → Sécurité → Trousseau mots de passe.',
      };
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

  if (interpreted.intent === 'home_control') {
    const server = await runServerAgentAct(token, command, true);
    if (server.completed) {
      return { done: true, message: server.message || 'Action domotique exécutée.' };
    }
    return {
      done: false,
      message: server.message || server.preview?.explanation || 'Action domotique non exécutée.',
    };
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
