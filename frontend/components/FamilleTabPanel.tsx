'use client';

import type { EquityShare } from '../lib/selectors';

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
  partenaireName,
  partnerContactDraft,
  onPartnerContactChange,
  partnerNotifyLoading,
  onOpenEquiteModal,
  onNotifyPartner,
  onGoMoi,
}: {
  C: Record<string, string>;
  equity: EquityShare[];
  partenaireName: string;
  partnerContactDraft: string;
  onPartnerContactChange: (value: string) => void;
  partnerNotifyLoading: boolean;
  onOpenEquiteModal: () => void;
  onNotifyPartner: () => void;
  onGoMoi: () => void;
}) {
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
        <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 8 }}>Répartition visible</div>
        <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          {equity.map((e) => (
            <div key={e.name} style={{ flex: Math.max(e.pct, 1), background: e.color }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {equity.map((e) => (
            <Pill key={e.name} bg={`${e.color}20`} color={e.color}>
              {e.name} {e.pct}%
            </Pill>
          ))}
        </div>
        <input
          type="text"
          value={partnerContactDraft}
          onChange={(e) => onPartnerContactChange(e.target.value)}
          placeholder={`Mobile ou e-mail de ${partenaireName} (optionnel)`}
          autoComplete="tel email"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1.5px solid ${C.border}`,
            fontSize: 12,
            background: C.surface,
            marginBottom: 10,
          }}
        />
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
            Score équité hebdo
          </button>
          <button
            type="button"
            disabled={partnerNotifyLoading}
            onClick={onNotifyPartner}
            style={{
              borderRadius: 10,
              border: 'none',
              padding: '8px 10px',
              background: C.alex,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              opacity: partnerNotifyLoading ? 0.65 : 1,
            }}
          >
            {partnerNotifyLoading ? 'Envoi…' : `Notifier ${partenaireName}`}
          </button>
          <button
            type="button"
            onClick={onGoMoi}
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
            Zone « Moi »
          </button>
        </div>
      </GlassCard>
      <p style={{ fontSize: 11, color: C.text3, lineHeight: 1.45, margin: 0 }}>
        La carte complète charge mentale reste sur l&apos;accueil ; ici, raccourcis depuis le hub Plus.
      </p>
    </div>
  );
}
