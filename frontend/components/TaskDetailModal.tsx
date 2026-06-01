'use client';

import { TaskAssignSelect, TaskDoneButton, type TaskUiItem, type TaskUiMember } from './taskUi';
import { formatDateTimeFr } from '../lib/formatClientDate';
import { useIsClient } from '../hooks/useIsClient';

export function TaskDetailModal({
  open,
  task,
  C,
  token,
  family,
  householdMembers,
  primaryMemberId,
  partnerMemberId,
  childMemberId,
  taskAssignBusyId,
  taskCompleteBusyId,
  onClose,
  onAssign,
  onComplete,
  onOpenAgenda,
}: {
  open: boolean;
  task: TaskUiItem | null;
  C: Record<string, string>;
  token: string;
  family: { prenom: string; partenaire: string; enfant: string };
  householdMembers: TaskUiMember[];
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  taskAssignBusyId: number | null;
  taskCompleteBusyId: number | null;
  onClose: () => void;
  onAssign: (taskId: number, next: number | null) => void | Promise<void>;
  onComplete: (taskId: number) => void | Promise<void>;
  onOpenAgenda?: () => void;
}) {
  const client = useIsClient();
  if (!open || !task) return null;

  const assigneeLabel =
    primaryMemberId != null && task.assigned_member_id === primaryMemberId
      ? family.prenom
      : partnerMemberId != null && task.assigned_member_id === partnerMemberId
        ? family.partenaire
        : childMemberId != null && task.assigned_member_id === childMemberId
          ? family.enfant
          : task.assigned_member_id
            ? householdMembers.find((m) => m.id === task.assigned_member_id)?.display_name
            : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 160,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(44,31,26,0.45)',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 20,
          background: C.white,
          padding: 18,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <h2 id="task-detail-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>
            {task.title}
          </h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{
              border: 'none',
              background: C.surface2,
              borderRadius: 10,
              width: 36,
              height: 36,
              fontSize: 18,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 14, lineHeight: 1.5 }}>
          {task.due_at ? (
            <div>
              <strong style={{ color: C.text }}>Échéance :</strong>{' '}
              <span suppressHydrationWarning>{formatDateTimeFr(task.due_at, client)}</span>
            </div>
          ) : (
            <div>Sans échéance définie</div>
          )}
          {assigneeLabel ? (
            <div style={{ marginTop: 6 }}>
              <strong style={{ color: C.text }}>Pour :</strong> {assigneeLabel}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <TaskAssignSelect
            C={C}
            taskId={task.id}
            assigned_member_id={task.assigned_member_id}
            members={householdMembers}
            token={token}
            busy={taskAssignBusyId === task.id}
            onAssign={onAssign}
          />
          <TaskDoneButton
            C={C}
            taskId={task.id}
            token={token}
            busyDone={taskCompleteBusyId === task.id}
            onDone={onComplete}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {task.due_at && onOpenAgenda ? (
            <button
              type="button"
              onClick={onOpenAgenda}
              style={{
                width: '100%',
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '10px 14px',
                background: C.alexXL,
                color: C.alex,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Voir dans l&apos;agenda
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '10px 14px',
              background: C.white,
              color: C.text2,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
