'use client';

import { useState } from 'react';

export function GlobalFab({
  C,
  onEvent,
  onTask,
  onGrocery,
  onPhoto,
}: {
  C: Record<string, string>;
  onEvent: () => void;
  onTask: () => void;
  onGrocery: () => void;
  onPhoto: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'rgba(0,0,0,0.25)', border: 'none' }}
        />
      ) : null}
      {open ? (
        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(var(--tab-bar-height, 72px) + 16px + env(safe-area-inset-bottom, 0px))',
            zIndex: 45,
            display: 'grid',
            gap: 8,
          }}
        >
          {[
            { label: 'Événement', action: onEvent },
            { label: 'Tâche', action: onTask },
            { label: 'Course', action: onGrocery },
            { label: 'Photo → Alfred', action: onPhoto },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.action();
              }}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '10px 14px',
                background: C.white,
                boxShadow: 'var(--md-shadow, 0 2px 12px rgba(42,33,28,.08))',
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
                textAlign: 'right',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Ajouter"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(var(--tab-bar-height, 72px) + 16px + env(safe-area-inset-bottom, 0px))',
          zIndex: 46,
          width: 52,
          height: 52,
          borderRadius: 26,
          border: 'none',
          background: C.terra,
          color: '#fff',
          fontSize: 28,
          fontWeight: 300,
          lineHeight: 1,
          boxShadow: '0 4px 16px rgba(201,107,74,0.45)',
          cursor: 'pointer',
        }}
      >
        +
      </button>
    </>
  );
}
