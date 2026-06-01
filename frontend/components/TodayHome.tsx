'use client';

import type { HubKey } from './PlusHub';
import { PLUS_HUB_ITEMS } from './PlusHub';
import { MajordomeHomeLogo } from './BrandLogo';
import { hubColor } from '../lib/moduleColors';
import type { MentalWeather } from '../lib/mentalLoad';

export type TodayUrgency = {
  id: string;
  label: string;
  actionLabel: string;
  tone: 'danger' | 'warning';
  onAction: () => void;
};

function ModuleShortcutCard({
  hubId,
  badge,
  onOpen,
  C,
}: {
  hubId: HubKey;
  badge?: string;
  onOpen: () => void;
  C: Record<string, string>;
}) {
  const meta = PLUS_HUB_ITEMS.find((x) => x.id === hubId);
  if (!meta) return null;
  const Hi = meta.Icon;
  const accent = hubColor(hubId);
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        textAlign: 'left',
        padding: 14,
        paddingLeft: 18,
        borderRadius: 16,
        border: `1.5px solid ${C.border}`,
        background: C.white,
        cursor: 'pointer',
        minHeight: 88,
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      {badge ? (
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontSize: 10,
            fontWeight: 800,
            background: '#FDEAEA',
            color: '#C04040',
            borderRadius: 10,
            padding: '2px 8px',
          }}
        >
          {badge}
        </span>
      ) : null}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          background: `${accent}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Hi size={22} color={accent} strokeWidth={1.65} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{meta.label}</div>
      <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.35 }}>{meta.hint}</div>
    </button>
  );
}

export function TodayHome({
  C,
  clientTodayLabel,
  firstName,
  weather,
  urgencies,
  eventsToday,
  openTasksCount,
  remindersCount,
  hubShortcuts,
  moduleBadges,
  onOpenHub,
  onOpenAgenda,
  onOpenTasks,
  onOpenAlfred,
  onPersonalize,
  showPersonalize,
  showDebordee,
  onDebordee,
  showMorningMood,
  morningMood,
  onMorningMood,
  partenaireName,
}: {
  C: Record<string, string>;
  clientTodayLabel: string;
  firstName: string;
  weather: MentalWeather;
  urgencies: TodayUrgency[];
  eventsToday: number;
  openTasksCount: number;
  remindersCount: number;
  hubShortcuts: HubKey[];
  moduleBadges?: Partial<Record<HubKey, string>>;
  onOpenHub: (id: HubKey) => void;
  onOpenAgenda: () => void;
  onOpenTasks: () => void;
  onOpenAlfred?: () => void;
  onPersonalize: () => void;
  showPersonalize?: boolean;
  showDebordee?: boolean;
  onDebordee: () => void;
  showMorningMood?: boolean;
  morningMood: number | null;
  onMorningMood: (index: number) => void;
  partenaireName: string;
}) {
  const shortcuts = hubShortcuts.slice(0, 4);
  const MOODS = ['😴', '😟', '😐', '🙂', '😄'] as const;

  return (
    <div
      style={{
        padding: '12px 16px 24px',
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        minHeight: 0,
        touchAction: 'pan-y',
      }}
    >
      {showPersonalize ? (
        <div
          style={{
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 36,
          }}
        >
          <MajordomeHomeLogo maxHeight={40} />
          <button
            type="button"
            onClick={onPersonalize}
            aria-label="Personnaliser l'accueil"
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.terra,
              background: C.terraXL,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '6px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Personnaliser
          </button>
        </div>
      ) : null}

      {/* Météo mentale */}
      <div
        style={{
          padding: '18px 16px',
          borderRadius: 22,
          marginBottom: 16,
          background: weather.bg,
          border: `1px solid ${weather.accent}33`,
        }}
      >
        <p style={{ fontSize: 12, color: C.text2, margin: '0 0 4px' }} suppressHydrationWarning>
          {clientTodayLabel || '\u00a0'}
        </p>
        <h1 style={{ fontSize: 28, margin: '0 0 6px', color: C.text, lineHeight: 1.1 }} suppressHydrationWarning>
          Bonjour {firstName || 'toi'}
        </h1>
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: weather.accent }}>{weather.message}</p>
      </div>

      {/* Humeur matin (optionnel) */}
      {showMorningMood && morningMood === null ? (
        <div
          style={{
            padding: 14,
            borderRadius: 18,
            marginBottom: 16,
            background: C.white,
            border: `1.5px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 10 }}>Comment tu te sens ?</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
            {MOODS.map((m, i) => (
              <button
                key={m}
                type="button"
                aria-label={`Humeur ${i + 1} sur 5`}
                onClick={() => onMorningMood(i)}
                style={{
                  border: 'none',
                  background: C.surface2,
                  borderRadius: 12,
                  padding: '8px 10px',
                  fontSize: 28,
                  lineHeight: 1,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Urgences (max 3) */}
      {urgencies.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.text2,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              margin: '0 0 10px',
            }}
          >
            Maintenant
          </h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {urgencies.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: C.white,
                  border: `1.5px solid ${u.tone === 'danger' ? C.red + '55' : C.sun + '55'}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{u.label}</div>
                </div>
                <button
                  type="button"
                  onClick={u.onAction}
                  style={{
                    flexShrink: 0,
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 12px',
                    background: u.tone === 'danger' ? C.red : C.terra,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {u.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* KPI compact */}
      {eventsToday + openTasksCount + remindersCount === 0 ? (
        <div
          className="empty-state"
          style={{
            marginBottom: 16,
            padding: '18px 16px',
            borderRadius: 16,
            border: `1.5px dashed ${C.border}`,
            background: C.white,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Journée tranquille</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, marginBottom: 12 }}>
            Aucun événement ni tâche urgente pour l’instant.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {onOpenAlfred ? (
              <button
                type="button"
                onClick={onOpenAlfred}
                style={{
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 14px',
                  background: C.terra,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Parler à Alfred
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenAgenda}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '10px 14px',
                background: C.white,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Voir l’agenda
            </button>
          </div>
        </div>
      ) : (
        <div
          role="group"
          aria-label="Résumé du jour"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={onOpenAgenda}
            style={{
              flex: '1 1 100px',
              padding: '12px 14px',
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 14,
              color: C.text,
            }}
          >
            <span style={{ marginRight: 8 }}>🗓</span>
            <strong>{eventsToday}</strong> événement{eventsToday !== 1 ? 's' : ''}
          </button>
          <button
            type="button"
            onClick={onOpenTasks}
            style={{
              flex: '1 1 100px',
              padding: '12px 14px',
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 14,
              color: C.text,
            }}
          >
            <span style={{ marginRight: 8 }}>✓</span>
            <strong>{openTasksCount}</strong> tâche{openTasksCount !== 1 ? 's' : ''}
          </button>
          {remindersCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenHub('courses')}
              style={{
                flex: '1 1 100px',
                padding: '12px 14px',
                borderRadius: 16,
                border: `1.5px solid ${C.red}44`,
                background: C.redL,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
                color: C.text,
              }}
            >
              <span style={{ marginRight: 8 }}>🧊</span>
              <strong>{remindersCount}</strong> alerte{remindersCount !== 1 ? 's' : ''} frigo
            </button>
          ) : null}
        </div>
      )}

      {/* Modules favoris */}
      {shortcuts.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.text2,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Tes modules
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {shortcuts.map((hid) => (
              <ModuleShortcutCard
                key={hid}
                hubId={hid}
                badge={moduleBadges?.[hid]}
                onOpen={() => onOpenHub(hid)}
                C={C}
              />
            ))}
          </div>
        </div>
      ) : showPersonalize ? (
        <div
          className="empty-state"
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 14,
            background: C.terraXL,
            fontSize: 13,
            color: C.text2,
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={onPersonalize}
            style={{
              border: 'none',
              background: 'transparent',
              color: C.terra,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Personnaliser l’accueil →
          </button>
        </div>
      ) : null}

      {/* Débordée — contextuel */}
      {showDebordee ? (
        <div
          style={{
            padding: 16,
            borderRadius: 18,
            marginBottom: 16,
            background: `linear-gradient(135deg, ${C.terraXL}, #FFF4E8)`,
            border: `1.5px solid ${C.terra}44`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: C.terra, marginBottom: 6 }}>Tu es débordée ?</div>
          <p style={{ fontSize: 13, color: C.text2, margin: '0 0 12px', lineHeight: 1.45 }}>
            {partenaireName ? `Alfred trie ta liste et propose du relais vers ${partenaireName}.` : 'Alfred peut trier ta liste et alléger la journée.'}
          </p>
          <button
            type="button"
            onClick={onDebordee}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 12,
              padding: '12px 14px',
              background: C.terra,
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Lancer le triage Alfred
          </button>
        </div>
      ) : null}

      {openTasksCount > 0 ? (
        <button
          type="button"
          onClick={onOpenTasks}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 14,
            border: `1.5px dashed ${C.border}`,
            background: 'transparent',
            color: C.terra,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Voir toutes les tâches ({openTasksCount})
        </button>
      ) : null}
    </div>
  );
}
