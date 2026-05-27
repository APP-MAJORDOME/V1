'use client';

import { useState } from 'react';
import { DONE_HISTORY_FETCH_LIMIT, INITIAL_DONE_TASKS_LIMIT } from '../lib/constants';
import { IconCheckSmall } from './md-icons';

export type TaskUiMember = { id: number; display_name: string };
export type TaskUiItem = {
  id: number;
  title: string;
  status: string;
  due_at?: string | null;
  assigned_member_id?: number | null;
  updated_at?: string;
};

function GlassCard({
  C,
  children,
  style = {},
}: {
  C: Record<string, string>;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

export function TaskAssignSelect({
  C,
  taskId,
  assigned_member_id,
  members,
  token,
  busy,
  onAssign,
  compact,
}: {
  C: Record<string, string>;
  taskId: number;
  assigned_member_id?: number | null;
  members: TaskUiMember[];
  token: string;
  busy: boolean;
  onAssign: (taskId: number, next: number | null) => void | Promise<void>;
  compact?: boolean;
}) {
  if (!token || members.length === 0 || taskId <= 0) return null;
  const v = assigned_member_id == null ? '' : String(assigned_member_id);
  const sorted = [...members].sort((a, b) => a.display_name.localeCompare(b.display_name, 'fr'));
  return (
    <select
      aria-label="Assigner la tâche"
      title="Qui porte cette tâche ?"
      value={v}
      disabled={busy}
      onChange={(e) => {
        const raw = e.target.value;
        void onAssign(taskId, raw === '' ? null : Number(raw));
      }}
      style={{
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color: C.text2,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: compact ? '3px 6px' : '4px 8px',
        background: C.surface,
        maxWidth: compact ? 118 : 168,
      }}
    >
      <option value="">Foyer</option>
      {sorted.map((m) => (
        <option key={m.id} value={m.id}>
          {m.display_name}
        </option>
      ))}
    </select>
  );
}

export function TaskDoneButton({
  C,
  taskId,
  token,
  busyDone,
  onDone,
}: {
  C: Record<string, string>;
  taskId: number;
  token: string;
  busyDone: boolean;
  onDone: (taskId: number) => void | Promise<void>;
}) {
  if (!token || taskId <= 0) return null;
  return (
    <button
      type="button"
      disabled={busyDone}
      onClick={() => void onDone(taskId)}
      style={{
        fontSize: 10,
        fontWeight: 800,
        borderRadius: 8,
        border: `1px solid ${C.green}`,
        background: C.greenL,
        color: C.green,
        padding: '4px 10px',
        cursor: busyDone ? 'wait' : 'pointer',
        flexShrink: 0,
      }}
    >
      {busyDone ? '…' : 'Fait'}
    </button>
  );
}

export function RecentDoneTasksCard({
  C,
  sortedDone,
  token,
  reopenBusyId,
  onReopen,
  compact,
  previewFirst = 8,
  onRefreshDoneFromServer,
  refreshDoneBusy,
  onLoadMoreDonePage,
  loadMoreDoneBusy,
  donePagingExhausted,
  serverDoneTotal,
}: {
  C: Record<string, string>;
  sortedDone: TaskUiItem[];
  token: string;
  reopenBusyId: number | null;
  onReopen: (taskId: number) => void;
  compact?: boolean;
  previewFirst?: number;
  onRefreshDoneFromServer?: () => void;
  refreshDoneBusy?: boolean;
  onLoadMoreDonePage?: () => void;
  loadMoreDoneBusy?: boolean;
  donePagingExhausted?: boolean;
  serverDoneTotal?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const pad = compact ? 12 : 14;
  const mb = compact ? 10 : 18;
  const titleFs = compact ? 12 : 14;
  const visible = expanded ? sortedDone : sortedDone.slice(0, previewFirst);
  const hasMore = sortedDone.length > previewFirst;

  return (
    <GlassCard C={C} style={{ padding: pad, marginBottom: mb, background: C.greenL, border: `1.5px solid ${C.green}33` }}>
      <strong style={{ fontSize: titleFs, color: C.green, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconCheckSmall size={15} color={C.green} strokeWidth={2} />
        Récemment terminées
      </strong>
      <p style={{ fontSize: 11, color: C.text2, margin: '6px 0 8px', lineHeight: 1.45 }}>
        {compact
          ? 'Rouvre une tâche si la coche était trop rapide.'
          : 'Les dernières coches — tu peux rouvrir une tâche si c’était une erreur.'}
      </p>
      {onRefreshDoneFromServer ? (
        <p style={{ fontSize: 10, color: C.text3, margin: '-2px 0 8px', lineHeight: 1.4 }}>
          {compact
            ? `Astuce : « Page suivante » puis fusion rapide — deux boutons ci-dessous.`
            : `Au lancement : jusqu’à ${INITIAL_DONE_TASKS_LIMIT} terminées récentes. « Page suivante » enchaîne par paquets ; « Fusion rapide » recharge les ${DONE_HISTORY_FETCH_LIMIT} premières depuis le début.`}
        </p>
      ) : null}
      {typeof serverDoneTotal === 'number' ? (
        <div style={{ fontSize: 10, color: C.text2, margin: '-4px 0 10px', lineHeight: 1.45 }}>
          <strong>Foyer</strong> : {serverDoneTotal} terminée(s) au total · {sortedDone.length} chargée(s) dans l’app
          {serverDoneTotal > sortedDone.length
            ? ' — poursuis avec « Page suivante » ou « Fusion rapide ».'
            : ' — tout est chargé côté terminées.'}
        </div>
      ) : null}
      {sortedDone.length === 0 ? (
        <div style={{ fontSize: 12, color: C.text2 }}>Aucune tâche terminée pour l’instant.</div>
      ) : (
        <>
          {visible.map((t) => (
            <div key={t.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.text3, textDecoration: 'line-through' }}>{t.title}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>
                {t.updated_at
                  ? `Terminée le ${new Date(t.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
                  : 'Terminée'}
              </div>
              <button
                type="button"
                disabled={reopenBusyId === t.id || !token}
                onClick={() => void onReopen(t.id)}
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: `1px solid ${C.text3}`,
                  background: C.white,
                  color: C.text2,
                  padding: '4px 10px',
                  cursor: reopenBusyId === t.id ? 'wait' : 'pointer',
                }}
              >
                {reopenBusyId === t.id ? '…' : 'Rouvrir'}
              </button>
            </div>
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                background: 'transparent',
                color: C.green,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? 'Réduire' : `Voir plus (${sortedDone.length - previewFirst} autres)`}
            </button>
          ) : null}
        </>
      )}
      {token && onLoadMoreDonePage && !donePagingExhausted ? (
        <button
          type="button"
          disabled={Boolean(loadMoreDoneBusy || refreshDoneBusy)}
          onClick={() => void onLoadMoreDonePage()}
          style={{
            marginTop: sortedDone.length === 0 ? 8 : 10,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px solid ${C.sage}`,
            background: C.sageL,
            color: C.sage,
            padding: '6px 10px',
            cursor: loadMoreDoneBusy || refreshDoneBusy ? 'wait' : 'pointer',
            width: '100%',
          }}
        >
          {loadMoreDoneBusy ? 'Chargement…' : `Page suivante (+${INITIAL_DONE_TASKS_LIMIT} terminées)`}
        </button>
      ) : null}
      {token && onRefreshDoneFromServer ? (
        <button
          type="button"
          disabled={refreshDoneBusy || Boolean(loadMoreDoneBusy)}
          onClick={() => void onRefreshDoneFromServer()}
          style={{
            marginTop: sortedDone.length === 0 && !(onLoadMoreDonePage && !donePagingExhausted) ? 8 : 10,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px dashed ${C.green}`,
            background: C.white,
            color: C.green,
            padding: '6px 10px',
            cursor: refreshDoneBusy || loadMoreDoneBusy ? 'wait' : 'pointer',
            width: '100%',
          }}
        >
          {refreshDoneBusy ? 'Synchronisation…' : `Fusion rapide : ${DONE_HISTORY_FETCH_LIMIT} terminées depuis le début`}
        </button>
      ) : null}
    </GlassCard>
  );
}
