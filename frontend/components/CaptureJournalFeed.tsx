'use client';

import type { CaptureChip, HouseholdCapture } from '../lib/householdCaptures';
import { IconSparkleSmall } from './md-icons';

export type CaptureJournalFeedProps = {
  C: Record<string, string>;
  firstName: string;
  clientTodayLabel: string;
  pendingCount: number;
  captures: HouseholdCapture[];
  chip: CaptureChip;
  chips: { id: CaptureChip; label: string }[];
  onChipChange: (chip: CaptureChip) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onOpenSalon: () => void;
  /** Bandeau compact sur l'accueil ; liste complète dans le Salon. */
  variant?: 'banner' | 'full';
};

function kindLabel(kind: HouseholdCapture['kind']): string {
  if (kind === 'event_proposal') return 'Agenda';
  if (kind === 'task_proposal') return 'Tâche';
  if (kind === 'reminder') return 'Rappel';
  return 'Suggestion';
}

export function CaptureJournalFeed({
  C,
  firstName,
  clientTodayLabel,
  pendingCount,
  captures,
  chip,
  chips,
  onChipChange,
  onApprove,
  onReject,
  onOpenSalon,
  variant = 'full',
}: CaptureJournalFeedProps) {
  const banner = (
    <div
      style={{
        background: `linear-gradient(145deg, ${C.terraXL} 0%, ${C.white} 72%)`,
        borderRadius: variant === 'banner' ? 16 : 20,
        border: `1.5px solid ${C.border}`,
        padding: variant === 'banner' ? '12px 14px' : '16px 16px 14px',
        marginBottom: variant === 'banner' ? 0 : 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {variant === 'full' ? (
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>{clientTodayLabel || "Aujourd'hui"}</div>
          ) : null}
          {variant === 'full' ? (
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
              Bonjour, {firstName || 'toi'}.
            </h2>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>
              {pendingCount} capture{pendingCount > 1 ? 's' : ''} à valider
            </div>
          )}
          <p style={{ margin: 0, fontSize: variant === 'banner' ? 12 : 13, color: C.text2, lineHeight: 1.45 }}>
            {variant === 'banner' ? (
              <>Alfred a détecté des actions dans le Salon — valide ou ignore depuis le fil.</>
            ) : pendingCount > 0 ? (
              <>
                <strong style={{ color: C.terra }}>{pendingCount} capture{pendingCount > 1 ? 's' : ''}</strong> à
                valider — MajorDome a suivi la conversation pendant que tu dormais.
              </>
            ) : (
              <>Rien en attente. Le majordome écoute le Salon et l’agenda.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSalon}
          style={{
            flexShrink: 0,
            marginTop: variant === 'full' ? 0 : 2,
            border: 'none',
            borderRadius: 12,
            padding: variant === 'banner' ? '7px 10px' : '8px 12px',
            background: C.terra,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {variant === 'banner' ? 'Salon' : 'Ouvrir le Salon'}
        </button>
      </div>
    </div>
  );

  if (variant === 'banner') {
    return <div style={{ padding: '8px 16px 0' }}>{banner}</div>;
  }

  return (
    <div style={{ padding: '0 16px 8px' }}>
      {banner}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {chips.map((c) => {
          const on = chip === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChipChange(c.id)}
              style={{
                border: `1.5px solid ${on ? C.terra : C.border}`,
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                background: on ? C.terraXL : C.white,
                color: on ? C.terra : C.text2,
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {captures.length === 0 ? (
        <div
          style={{
            borderRadius: 16,
            border: `1px dashed ${C.border}`,
            padding: 14,
            fontSize: 12,
            color: C.text2,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Aucune capture en attente pour ce filtre.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 8 }}>
          {captures.map((cap, index) => (
            <article
              key={cap.id}
              style={{
                background: C.white,
                borderRadius: 18,
                border: `1.5px solid ${C.border}`,
                padding: '14px 14px 12px',
                boxShadow: '0 2px 12px rgba(44,31,26,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.terra }}>
                  ① {index + 1} · {kindLabel(cap.kind)}
                </span>
                <span style={{ fontSize: 10, color: C.text3 }}>{cap.createdLabel}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{cap.sourceLabel}</div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: C.text, fontStyle: 'italic', lineHeight: 1.45 }}>
                {cap.excerpt}
              </p>
              <ul style={{ margin: '0 0 10px', paddingLeft: 16, fontSize: 11, color: C.text2, lineHeight: 1.5 }}>
                {cap.inferences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cap.ctaPrimary ? (
                  <button
                    type="button"
                    onClick={() => onApprove(cap.id)}
                    style={{
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: C.green,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ {cap.ctaPrimary}
                  </button>
                ) : null}
                {cap.ctaSecondary ? (
                  <button
                    type="button"
                    onClick={() => onReject(cap.id)}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: C.white,
                      color: C.text2,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {cap.ctaSecondary}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <p
        style={{
          margin: '4px 0 12px',
          fontSize: 10,
          color: C.text3,
          lineHeight: 1.45,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconSparkleSmall size={14} color={C.lilac} />
        Salon connecté — valider crée tâches, courses ou événements. WhatsApp à l’étape C.
      </p>
    </div>
  );
}
