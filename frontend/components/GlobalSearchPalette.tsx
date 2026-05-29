'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch } from './md-icons';

export type SearchPaletteEntry = {
  id: string;
  kind: 'task' | 'event' | 'document';
  title: string;
  subtitle?: string;
  onSelect: () => void;
};

function kindLabel(kind: SearchPaletteEntry['kind']): string {
  switch (kind) {
    case 'task':
      return 'Tâche';
    case 'event':
      return 'Événement';
    case 'document':
      return 'Document';
    default:
      return '';
  }
}

export function GlobalSearchPalette({
  open,
  onClose,
  entries,
  C,
}: {
  open: boolean;
  onClose: () => void;
  entries: SearchPaletteEntry[];
  C: Record<string, string>;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries.slice(0, 60);
    return entries
      .filter((e) => {
        const hay = `${e.title} ${e.subtitle ?? ''}`.toLowerCase();
        return hay.includes(s);
      })
      .slice(0, 60);
  }, [entries, q]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'max(72px, calc(env(safe-area-inset-top, 0px) + 52px))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <button
        type="button"
        aria-label="Fermer la recherche"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,18,0.45)', border: 'none', cursor: 'pointer' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
        style={{
          position: 'relative',
          width: 'min(420px, calc(100vw - 32px))',
          maxHeight: 'min(520px, 70vh)',
          background: C.white,
          borderRadius: 18,
          border: `1.5px solid ${C.border}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconSearch size={18} color={C.text2} strokeWidth={1.65} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tâche, événement, document…"
            aria-label="Recherche globale"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontWeight: 600,
              color: C.text,
              background: 'transparent',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.text3 }}>Esc</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 8px 12px' }}>
          {filtered.length === 0 ? (
            <p style={{ margin: '14px 10px', fontSize: 13, color: C.text2, textAlign: 'center' }}>Aucun résultat.</p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  e.onSelect();
                  onClose();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 12px',
                  marginBottom: 4,
                  background: C.surface ?? '#F5EDE8',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: C.terra }}>{kindLabel(e.kind)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.title}</span>
                {e.subtitle ? <span style={{ fontSize: 11, color: C.text2 }}>{e.subtitle}</span> : null}
              </button>
            ))
          )}
        </div>
        <div style={{ padding: '8px 14px 10px', borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.text3, textAlign: 'center' }}>
          Raccourci : ⌘K ou Ctrl+K — recherche locale sur les données déjà chargées.
        </div>
      </div>
    </div>
  );
}
