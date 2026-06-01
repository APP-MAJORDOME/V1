/**
 * Calculs dérivés purs (tâches, membres, équité locale) — réutilisables et testables hors composants.
 */

export type TaskLike = {
  id: number;
  title: string;
  status: string;
  due_at?: string | null;
  assigned_member_id?: number | null;
  updated_at?: string;
};

export type HouseholdMemberLike = { id: number; display_name: string; role: string };

export function selectOpenTasks(tasks: TaskLike[]): TaskLike[] {
  return tasks.filter((t) => t.status.toLowerCase() !== 'done');
}

export function selectDoneTasks(tasks: TaskLike[]): TaskLike[] {
  return tasks.filter((t) => t.status.toLowerCase() === 'done');
}

export function sortAgendaOpenTasks(openTasks: TaskLike[]): TaskLike[] {
  return [...openTasks].sort((a, b) => {
    if (!a.due_at && !b.due_at) return a.id - b.id;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
}

export function sortDoneTasksRecent(doneTasks: TaskLike[]): TaskLike[] {
  return [...doneTasks].sort((a, b) => {
    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  });
}

/** Résout un membre par rôle canonique puis par correspondance de nom affiché. */
export function resolveHouseholdMemberId(
  members: HouseholdMemberLike[],
  role: string,
  nameHint: string
): number | null {
  const byRole = members.find((m) => m.role === role);
  if (byRole) return byRole.id;
  const target = nameHint.trim().toLowerCase();
  if (!target) return null;
  return (
    members.find((m) => m.display_name.trim().toLowerCase() === target)?.id ??
    members.find((m) => {
      const d = m.display_name.trim().toLowerCase();
      return d.includes(target) || target.includes(d);
    })?.id ??
    null
  );
}

export type EquityShare = { name: string; pct: number; color: string };

export function computeDemoEquityShares(
  openTasksLen: number,
  doneTasksLen: number,
  names: { prenom: string; partenaire: string; enfant: string },
  colors: { terra: string; alex: string; mint: string }
): EquityShare[] {
  const j = Math.max(openTasksLen, 1);
  const a = Math.max(doneTasksLen, 1);
  const l = Math.max(Math.round(openTasksLen / 3), 1);
  const total = j + a + l;
  return [
    { name: names.prenom, pct: Math.round((j / total) * 100), color: colors.terra },
    { name: names.partenaire, pct: Math.round((a / total) * 100), color: colors.alex },
    { name: names.enfant, pct: Math.round((l / total) * 100), color: colors.mint },
  ];
}

export type TaskForEquity = { status?: string; assigned_member_id?: number | null };

/** Répartition basée sur les tâches assignées (ouvertes ×2, terminées ×1). */
export function computeHouseholdEquityShares(
  tasks: TaskForEquity[],
  memberIds: { primary: number | null; partner: number | null; child: number | null },
  names: { prenom: string; partenaire: string; enfant: string },
  colors: { terra: string; alex: string; mint: string },
): EquityShare[] {
  const slots = [
    { id: memberIds.primary, name: names.prenom, color: colors.terra },
    { id: memberIds.partner, name: names.partenaire, color: colors.alex },
    { id: memberIds.child, name: names.enfant, color: colors.mint },
  ].filter((s): s is { id: number; name: string; color: string } => s.id != null);

  if (slots.length === 0) {
    return computeDemoEquityShares(0, 0, names, colors);
  }

  const weights = new Map<number, number>();
  for (const t of tasks) {
    const w = t.status === 'done' ? 1 : 2;
    const mid = t.assigned_member_id ?? memberIds.primary;
    if (mid == null) continue;
    weights.set(mid, (weights.get(mid) ?? 0) + w);
  }

  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total === 0) {
    const even = Math.floor(100 / slots.length);
    const shares = slots.map((s, i) => ({
      name: s.name,
      pct: i === slots.length - 1 ? 100 - even * (slots.length - 1) : even,
      color: s.color,
    }));
    return shares;
  }

  const raw = slots.map((s) => ({
    name: s.name,
    pct: Math.round(((weights.get(s.id) ?? 0) / total) * 100),
    color: s.color,
  }));
  const sum = raw.reduce((a, s) => a + s.pct, 0);
  if (sum !== 100 && raw[0]) {
    raw[0] = { ...raw[0], pct: raw[0].pct + (100 - sum) };
  }
  return raw;
}

export type FridgeRow = { expires_at: string };

/** Aliments périmés ou dont la DLC tombe dans les `hoursAhead` prochaines heures. */
export function selectFridgeAlertsWithinHours(fridge: FridgeRow[], hoursAhead: number): FridgeRow[] {
  const now = Date.now();
  const cutoff = now + hoursAhead * 60 * 60 * 1000;
  return fridge.filter((f) => {
    const t = new Date(f.expires_at.includes('T') ? f.expires_at : `${f.expires_at}T23:59:59`).getTime();
    return t <= cutoff;
  });
}

/** Pourcentage de tâches terminées (plancher 10 % pour l’affichage démo). */
export function computeTaskCompletionPct(openCount: number, totalCount: number): number {
  return Math.max(10, Math.round(((totalCount - openCount) / Math.max(totalCount, 1)) * 100));
}

export type BudgetLine = { spent: number; budget: number };

export function computeBudgetUsedPct(lines: BudgetLine[]): number {
  const spent = lines.reduce((acc, b) => acc + b.spent, 0);
  const cap = lines.reduce((acc, b) => acc + b.budget, 0);
  return Math.round((spent / Math.max(1, cap)) * 100);
}
