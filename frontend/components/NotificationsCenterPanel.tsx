'use client';

import { IconBellRing } from './md-icons';
import type { TodayUrgency } from './TodayHome';

export function NotificationsCenterPanel({
  C,
  items,
}: {
  C: Record<string, string>;
  items: TodayUrgency[];
}) {
  return (
    <div
      style={{
        padding: '14px 18px 40px',
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        minHeight: 0,
        touchAction: 'pan-y',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <IconBellRing size={26} color={C.lilac} strokeWidth={1.65} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Centre de notifications</div>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Alertes foyer : frigo, agenda, Salon, tâches.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 16,
            border: `1.5px solid ${C.border}`,
            background: C.white,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Rien d’urgent</div>
          <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
            Quand un produit expire, un conflit d’agenda apparaît ou Alfred capture quelque chose dans le Salon, ça
            s’affiche ici.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onAction}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 16,
                border: `1.5px solid ${item.tone === 'danger' ? `${C.red}44` : C.border}`,
                background: item.tone === 'danger' ? C.redL : C.white,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: item.tone === 'danger' ? C.red : C.terra,
                }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 650, color: C.text, lineHeight: 1.35 }}>
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: item.tone === 'danger' ? C.red : C.terra,
                  flexShrink: 0,
                }}
              >
                {item.actionLabel} →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
