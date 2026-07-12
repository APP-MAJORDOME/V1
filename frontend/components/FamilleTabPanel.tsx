'use client';

import type { EquityShare } from '../lib/selectors';
import type { EquityApiResponse } from '../hooks/useHouseholdEquity';

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
}

function GlassCard({
  children,
  style = {},
  C,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  C: Record<string, string>;
}) {
  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

export function FamilleTabPanel({
  C,
  equity,
  equityMode,
  onEquityModeChange,
  suggestions,
  onProposeTransfer,
  partenaireName,
  inviteUrl,
  onShareInvite,
  onOpenEquiteModal,
  onOpenPrivateSpace,
}: {
  C: Record<string, string>;
  equity: EquityShare[];
  equityMode?: 'execution' | 'planning' | 'combined';
  onEquityModeChange?: (mode: 'execution' | 'planning' | 'combined') => void;
  suggestions?: EquityApiResponse['suggestions'];
  onProposeTransfer?: (taskId: string) => void;
  partenaireName: string;
  inviteUrl?: string;
  onShareInvite?: () => void;
  onOpenEquiteModal: () => void;
  onOpenPrivateSpace?: () => void;
}) {
  const mode = equityMode ?? 'combined';
  return (
    <div
      style={{
        padding: '14px 18px',
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
      }}
    >
      <GlassCard C={C} style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 4 }}>La semaine du foyer</div>
        <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.45 }}>
          Balance coopérative — l&apos;objectif est l&apos;équilibre, pas un classement.
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['execution', 'planning', 'combined'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onEquityModeChange?.(m)}
              style={{
                border: `1px solid ${mode === m ? C.terra : C.border}`,
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: 10,
                fontWeight: 700,
                background: mode === m ? C.terraXL : C.white,
                color: mode === m ? C.terra : C.text2,
                cursor: 'pointer',
              }}
            >
              {m === 'execution' ? 'Exécution' : m === 'planning' ? 'Planification' : 'Les deux'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, height: 12, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          {equity.map((e) => (
            <div key={e.name} style={{ flex: Math.max(e.pct, 1), background: e.color }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {equity.map((e) => (
            <Pill key={e.name} bg={`${e.color}20`} color={e.color}>
              {e.name} {e.pct}%
            </Pill>
          ))}
        </div>
        {suggestions && suggestions.length > 0 ? (
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {suggestions.map((s) => (
              <div
                key={s.task_id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                }}
              >
                <p style={{ fontSize: 12, color: C.text, margin: '0 0 8px', lineHeight: 1.45 }}>{s.message}</p>
                <button
                  type="button"
                  onClick={() => onProposeTransfer?.(s.task_id)}
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 12px',
                    background: C.terra,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Proposer à {s.to}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenEquiteModal}
            style={{
              borderRadius: 10,
              border: 'none',
              padding: '8px 10px',
              background: C.terraXL,
              color: C.terra,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Voir le détail
          </button>
          {inviteUrl && onShareInvite ? (
            <button
              type="button"
              onClick={onShareInvite}
              style={{
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                padding: '8px 10px',
                background: C.white,
                fontSize: 11,
                fontWeight: 700,
                color: C.text,
              }}
            >
              Inviter {partenaireName || 'un membre'}
            </button>
          ) : null}
          {onOpenPrivateSpace ? (
            <button
              type="button"
              onClick={onOpenPrivateSpace}
              style={{
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                padding: '8px 10px',
                background: C.white,
                fontSize: 11,
                fontWeight: 700,
                color: C.text2,
              }}
            >
              Mon espace privé
            </button>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
