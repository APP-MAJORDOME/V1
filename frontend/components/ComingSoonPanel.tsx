'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import { t } from '../lib/i18n';

export function ComingSoonPanel({
  C,
  title,
  Icon,
  onNotify,
}: {
  C: Record<string, string>;
  title: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onNotify?: () => void;
}) {
  const [done, setDone] = useState(false);

  return (
    <div style={{ padding: '32px 20px 48px', textAlign: 'center', maxWidth: 360, margin: '0 auto' }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          background: C.terraXL,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Icon size={36} color={C.terra} strokeWidth={1.55} />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: C.text }}>{title}</h3>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: C.text2, lineHeight: 1.55 }}>{t('coming_soon.title')}</p>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{t('coming_soon.body')}</p>
      <button
        type="button"
        disabled={done}
        onClick={() => {
          setDone(true);
          onNotify?.();
        }}
        style={{
          border: 'none',
          borderRadius: 14,
          padding: '12px 20px',
          background: done ? C.surface2 : C.terra,
          color: done ? C.text2 : '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: done ? 'default' : 'pointer',
          minHeight: 48,
          minWidth: 160,
        }}
      >
        {done ? t('coming_soon.notified') : t('coming_soon.notify')}
      </button>
    </div>
  );
}
