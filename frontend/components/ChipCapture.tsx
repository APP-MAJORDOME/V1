'use client';

export type ChipCaptureType = 'event' | 'task' | 'grocery' | 'suggestion';

const TYPE_META: Record<ChipCaptureType, { icon: string; label: string }> = {
  event: { icon: '📅', label: 'Événement' },
  task: { icon: '✓', label: 'Tâche' },
  grocery: { icon: '🛒', label: 'Course' },
  suggestion: { icon: '💡', label: 'Suggestion' },
};

export function ChipCapture({
  C,
  type,
  title,
  when,
  assignee,
  busy,
  onAdd,
  onEdit,
  onIgnore,
}: {
  C: Record<string, string>;
  type: ChipCaptureType;
  title: string;
  when?: string;
  assignee?: string;
  busy?: boolean;
  onAdd?: () => void;
  onEdit?: () => void;
  onIgnore?: () => void;
}) {
  const meta = TYPE_META[type] ?? TYPE_META.suggestion;
  return (
    <div
      style={{
        marginTop: 8,
        width: '100%',
        maxWidth: 320,
        background: C.white,
        borderRadius: 14,
        border: `1.5px solid ${C.lilac ?? '#B49BD1'}55`,
        padding: '10px 12px',
        boxShadow: 'var(--md-shadow, 0 2px 12px rgba(42,33,28,.08))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }} aria-hidden>
          {meta.icon}
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.lilac ?? '#B49BD1', textTransform: 'uppercase' }}>
          {meta.label}
        </span>
      </div>
      <div className="md-display" style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        {title}
      </div>
      {when ? <div style={{ fontSize: 11, color: C.text2, marginBottom: 2 }}>{when}</div> : null}
      {assignee ? (
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>Assigné · {assignee}</div>
      ) : (
        <div style={{ marginBottom: 8 }} />
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {onAdd ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAdd}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              background: C.green,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            ✓ Ajouter
          </button>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '6px 10px',
              background: C.white,
              fontSize: 10,
              fontWeight: 700,
              color: C.text2,
              cursor: 'pointer',
            }}
          >
            ✎ Modifier
          </button>
        ) : null}
        {onIgnore ? (
          <button
            type="button"
            disabled={busy}
            onClick={onIgnore}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '6px 10px',
              background: C.white,
              fontSize: 10,
              fontWeight: 700,
              color: C.text3,
              cursor: 'pointer',
            }}
          >
            ✕ Ignorer
          </button>
        ) : null}
      </div>
    </div>
  );
}
