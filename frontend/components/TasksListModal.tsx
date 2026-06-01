'use client';

import type { TaskUiItem } from './taskUi';
import { formatDateTimeFr } from '../lib/formatClientDate';
import { useIsClient } from '../hooks/useIsClient';

export function TasksListModal({
  open,
  tasks,
  C,
  onClose,
  onSelectTask,
}: {
  open: boolean;
  tasks: TaskUiItem[];
  C: Record<string, string>;
  onClose: () => void;
  onSelectTask: (taskId: number) => void;
}) {
  const client = useIsClient();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tasks-list-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 155,
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
          maxHeight: '80vh',
          overflowY: 'auto',
          borderRadius: 20,
          background: C.white,
          padding: 18,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 id="tasks-list-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>
            Tâches ouvertes ({tasks.length})
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
            }}
          >
            ×
          </button>
        </div>
        {tasks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: C.text2 }}>Aucune tâche en cours.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTask(t.id)}
                style={{
                  textAlign: 'left',
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  background: C.white,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: C.text2 }} suppressHydrationWarning>
                  {t.due_at ? formatDateTimeFr(t.due_at, client) : 'Sans échéance'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
