'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api';

type HouseholdMember = {
  id: number;
  display_name: string;
  role: string;
};

type TaskRow = {
  id: number;
  title: string;
  status: string;
  due_at?: string | null;
  assigned_member_id?: number | null;
};

type TaskSummaryApi = {
  open_count: number;
  done_count: number;
};

function resolvePartnerMemberId(members: HouseholdMember[], partnerLabel: string): number | null {
  const byRole = members.find((m) => m.role === 'partner_adult');
  if (byRole) return byRole.id;
  const target = partnerLabel.trim().toLowerCase();
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

function assignmentBadge(
  assignedId: number | null | undefined,
  partnerMemberId: number | null,
  members: HouseholdMember[],
): { label: string; bg: string; color: string } {
  if (assignedId == null) {
    return { label: 'Priorité foyer', bg: '#334155', color: '#e2e8f0' };
  }
  if (partnerMemberId != null && assignedId === partnerMemberId) {
    return { label: 'À toi', bg: '#0c4a6e', color: '#7dd3fc' };
  }
  const m = members.find((x) => x.id === assignedId);
  if (m) {
    if (m.role === 'primary_adult') {
      return { label: `Pour ${m.display_name}`, bg: '#7c2d12', color: '#fed7aa' };
    }
    if (m.role === 'child') {
      return { label: `Pour ${m.display_name}`, bg: '#713f12', color: '#fde68a' };
    }
    return { label: `Pour ${m.display_name}`, bg: '#422006', color: '#fdba74' };
  }
  return { label: 'Autre assignation', bg: '#451a03', color: '#fcd34d' };
}

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#38bdf8',
  ok: '#4ade80',
  border: '#334155',
};

export default function PartnerPage() {
  const [token, setToken] = useState('');
  const [partnerName, setPartnerName] = useState('Partenaire');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [partnerMemberId, setPartnerMemberId] = useState<number | null>(null);
  const [taskSummary, setTaskSummary] = useState<TaskSummaryApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (accessToken: string, name: string) => {
    setLoading(true);
    setError('');
    try {
      let fam = { prenom: '', partenaire: '', enfant: '' };
      try {
        const raw = localStorage.getItem('majordome_family_profile');
        if (raw) Object.assign(fam, JSON.parse(raw) as Partial<typeof fam>);
      } catch {
        /* ignore */
      }
      await postJson('/api/v1/household/profile/sync-members', {
        primary_name: fam.prenom || '',
        partner_name: fam.partenaire || '',
        child_name: fam.enfant || '',
      }, accessToken);
      const q = name.trim() ? `?partner_name=${encodeURIComponent(name.trim())}` : '';
      const [rows, memberRows, summaryRes] = await Promise.all([
        getJson<TaskRow[]>(`/api/v1/tasks/partner-inbox${q}`, accessToken),
        getJson<HouseholdMember[]>('/api/v1/household/members', accessToken),
        getJson<TaskSummaryApi>('/api/v1/tasks/summary', accessToken).catch(() => null),
      ]);
      setTasks(rows);
      setMembers(memberRows);
      setPartnerMemberId(resolvePartnerMemberId(memberRows, name));
      setTaskSummary(summaryRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
      setTasks([]);
      setMembers([]);
      setPartnerMemberId(null);
      setTaskSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('majordome_access_token') || '';
    setToken(t);
    let name = 'Partenaire';
    try {
      const famRaw = localStorage.getItem('majordome_family_profile');
      if (famRaw) {
        const fam = JSON.parse(famRaw) as { partenaire?: string };
        if (fam.partenaire?.trim()) name = fam.partenaire.trim();
      }
    } catch {
      /* ignore */
    }
    setPartnerName(name);
    if (!t) {
      setLoading(false);
      setError('Connecte-toi depuis l’app principale pour voir tes tâches.');
      return;
    }
    void load(t, name);
  }, [load]);

  async function markDone(taskId: number) {
    if (!token) return;
    setBusyId(taskId);
    try {
      await postJson<TaskRow>(`/api/v1/tasks/${taskId}/complete`, {}, token);
      setTasks((prev) => prev.filter((x) => x.id !== taskId));
      try {
        setTaskSummary(await getJson<TaskSummaryApi>('/api/v1/tasks/summary', token));
      } catch {
        /* garde le résumé précédent */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.bg} 0%, #020617 100%)`, color: C.text }}>
      <header style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>MAJORDOME</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>Bonjour {partnerName}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Vue simplifiée — uniquement les tâches à traiter.</p>
        </div>
        <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: C.accent, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          ← App complète
        </Link>
      </header>

      <main style={{ padding: '18px 20px 40px', maxWidth: 520, margin: '0 auto' }}>
        {!token ? (
          <p style={{ color: C.muted, lineHeight: 1.6 }}>
            Pas de session :{' '}
            <Link href="/" style={{ color: C.accent }}>
              ouvre MajorDome
            </Link>{' '}
            et reconnecte-toi, puis reviens ici.
          </p>
        ) : null}

        {error ? (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>{error}</div>
        ) : null}

        {loading ? <p style={{ color: C.muted }}>Chargement…</p> : null}

        {!loading && token && taskSummary != null ? (
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: `${C.card}80`,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: C.text }}>Foyer</strong> : {taskSummary.open_count} ouverte(s) ·{' '}
            {taskSummary.done_count} terminée(s)
            <span style={{ opacity: 0.9 }}> — ta liste partenaire : {tasks.length} à traiter</span>
          </div>
        ) : null}

        {!loading && token && tasks.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 15 }}>Rien en attente pour le moment. Profite-en.</p>
        ) : null}

        {!loading && token && tasks.length > 0 && partnerMemberId == null ? (
          <p style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Connexion au foyer OK — si les libellés « À toi » manquent, vérifie le prénom du partenaire dans l’app (Profil foyer).
          </p>
        ) : null}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => (
            <li
              key={task.id}
              style={{
                background: C.card,
                borderRadius: 14,
                padding: '14px 16px',
                border: `1px solid ${C.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, flex: '1 1 180px' }}>{task.title}</div>
                {(() => {
                  const b = assignmentBadge(task.assigned_member_id, partnerMemberId, members);
                  return (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: b.bg,
                        color: b.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.label}
                    </span>
                  );
                })()}
              </div>
              {task.due_at ? (
                <div style={{ fontSize: 12, color: C.muted }}>Échéance : {new Date(task.due_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
              ) : (
                <div style={{ fontSize: 12, color: C.muted }}>Pas d’échéance précise</div>
              )}
              <button
                type="button"
                disabled={busyId === task.id}
                onClick={() => void markDone(task.id)}
                style={{
                  alignSelf: 'flex-start',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: busyId === task.id ? 'wait' : 'pointer',
                  background: C.ok,
                  color: '#052e16',
                }}
              >
                {busyId === task.id ? '…' : 'Marquer fait'}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
