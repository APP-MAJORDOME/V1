'use client';

import { useState } from 'react';

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  C,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  C: Record<string, string>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        marginBottom: 10,
        borderRadius: 16,
        border: `1.5px solid ${C.border}`,
        background: C.white,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
          color: C.text,
          minHeight: 44,
        }}
      >
        <span>{title}</span>
        <span style={{ color: C.text3, fontSize: 12 }} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}` }}>{children}</div>
      ) : null}
    </div>
  );
}
