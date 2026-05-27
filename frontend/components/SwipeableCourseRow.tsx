'use client';

import { useRef, useState } from 'react';
import { IconCheckSmall, IconCircleOutline } from './md-icons';

const SWIPE_THRESHOLD = 56;

export function SwipeableCourseRow({
  label,
  done,
  delegated,
  C,
  partnerName,
  onToggle,
  onDelete,
  onDelegate,
}: {
  label: string;
  done: boolean;
  delegated?: boolean;
  C: Record<string, string>;
  partnerName: string;
  onToggle: () => void;
  onDelete: () => void;
  onDelegate: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    setOffsetX(Math.max(-120, Math.min(120, dx)));
  }

  function onTouchEnd() {
    dragging.current = false;
    if (offsetX > SWIPE_THRESHOLD) {
      onDelegate();
      setOffsetX(0);
      return;
    }
    if (offsetX < -SWIPE_THRESHOLD) {
      onDelete();
      setOffsetX(0);
      return;
    }
    setOffsetX(0);
  }

  return (
    <div style={{ position: 'relative', marginBottom: 8, overflow: 'hidden', borderRadius: 16 }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            background: C.alex,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          → {partnerName || 'Partenaire'}
        </div>
        <div
          style={{
            flex: 1,
            background: C.red,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 12,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Supprimer
        </div>
      </div>
      <div
        className={done ? 'ui-check-flash' : undefined}
        style={{
          position: 'relative',
          transform: `translateX(${offsetX}px)`,
          transition: dragging.current ? 'none' : 'transform var(--duration-base) ease, background var(--duration-base) ease',
          background: done ? C.greenL : delegated ? C.alexL : C.white,
          border: `1.5px solid ${C.border}`,
          borderRadius: 16,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          touchAction: 'pan-y',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          aria-label={done ? 'Marquer non acheté' : 'Marquer acheté'}
          onClick={onToggle}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            border: `2px solid ${done ? C.green : C.border}`,
            background: done ? C.green : C.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {done ? <IconCheckSmall size={20} color="#fff" strokeWidth={2.5} /> : <IconCircleOutline size={18} color={C.text3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: done ? C.green : C.text,
              textDecoration: done ? 'line-through' : 'none',
            }}
          >
            {label}
          </div>
          {delegated ? (
            <div style={{ fontSize: 11, color: C.alex, marginTop: 2, fontWeight: 700 }}>Délégué à {partnerName}</div>
          ) : (
            <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>Glisser ← supprimer · → déléguer</div>
          )}
        </div>
      </div>
    </div>
  );
}
