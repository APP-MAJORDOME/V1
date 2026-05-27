'use client';

import type { ComponentType } from 'react';
import { IconDotsGrid, IconHome, IconSparkleAI, IconUserHeart } from './md-icons';

export type AppTabId = 'home' | 'alfred' | 'modules' | 'moi';

const TABS: {
  id: AppTabId;
  label: string | ((aiName: string) => string);
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { id: 'home', label: "Aujourd'hui", Icon: IconHome },
  { id: 'alfred', label: (ai) => ai, Icon: IconSparkleAI },
  { id: 'modules', label: 'Modules', Icon: IconDotsGrid },
  { id: 'moi', label: 'Moi', Icon: IconUserHeart },
];

export function BottomTabBar({
  active,
  aiName,
  C,
  onSelect,
}: {
  active: AppTabId;
  aiName: string;
  C: Record<string, string>;
  onSelect: (tab: AppTabId) => void;
}) {
  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        paddingTop: 8,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(4px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(4px, env(safe-area-inset-right, 0px))',
        minHeight: 72,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
        {TABS.map((tab) => {
          const on = tab.id === active;
          const label = typeof tab.label === 'function' ? tab.label(aiName) : tab.label;
          const NavIc = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onSelect(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                minWidth: 64,
                minHeight: 44,
                flex: 1,
                maxWidth: 96,
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: on ? `${C.terra}22` : 'transparent',
                }}
              >
                <NavIc size={on ? 26 : 24} color={on ? C.terra : C.text3} strokeWidth={1.65} />
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: on ? C.terra : C.text3,
                  fontWeight: on ? 700 : 500,
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
