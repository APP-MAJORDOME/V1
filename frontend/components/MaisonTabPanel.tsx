'use client';

import {
  IconCheckSmall,
  IconCircleOutline,
  IconHouseCare,
  IconLeaf,
  IconSmartHome,
} from './md-icons';

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

export function MaisonTabPanel({
  C,
  aiName,
  enfantName,
  morningDone,
  onToggleMorning,
  eveningDone,
  onToggleEvening,
  onOpenAssistant,
  homeConnected = false,
  onOpenIntegrations,
}: {
  C: Record<string, string>;
  aiName: string;
  enfantName: string;
  morningDone: boolean[];
  onToggleMorning: (index: number) => void;
  eveningDone: boolean[];
  onToggleEvening: (index: number) => void;
  onOpenAssistant: () => void;
  homeConnected?: boolean;
  onOpenIntegrations?: () => void;
}) {
  const morningPct = Math.round((morningDone.filter(Boolean).length / Math.max(morningDone.length, 1)) * 100);
  const eveningPct = Math.round((eveningDone.filter(Boolean).length / Math.max(eveningDone.length, 1)) * 100);

  return (
    <div
      style={{
        padding: '14px 18px',
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        minHeight: 0,
        touchAction: 'pan-y',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <IconHouseCare size={26} color={C.terra} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Domotique, extérieur et routines du foyer — tout ce qui concerne le logement (pas les courses).
          </p>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.6, margin: '0 0 8px' }}>
        DOMOTIQUE & ÉQUIPEMENTS
      </div>
      <GlassCard C={C} style={{ padding: 14, marginBottom: 12, background: C.alexL, border: `1.5px solid ${C.alex}44` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <IconSmartHome size={22} color={C.alex} strokeWidth={1.65} />
          <strong style={{ fontSize: 13, color: C.alex }}>Maison connectée</strong>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 999,
              background: homeConnected ? C.greenL : C.white,
              color: homeConnected ? C.green : C.text3,
            }}
          >
            {homeConnected ? 'Connectée' : 'Non connectée'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: C.text2, margin: 0, lineHeight: 1.5 }}>
          {homeConnected
            ? 'Home Assistant est lié. Pilote tes appareils depuis Intégrations, ou demande à Alfred (« éteins le salon »).'
            : 'Connecte Home Assistant (ou Tahoma / Ezviz) pour piloter éclairage, chauffage, volets et scénarios.'}
        </p>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['Éclairage', 'Chauffage', 'Volets', 'Alarme', 'Prises', 'Scénarios'] as const).map((label) => (
            <Pill key={label} bg={C.white} color={C.alex}>
              {label}
            </Pill>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {onOpenIntegrations ? (
            <button
              type="button"
              onClick={onOpenIntegrations}
              style={{
                width: '100%',
                borderRadius: 12,
                border: 'none',
                padding: '10px 12px',
                background: C.alex,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {homeConnected ? 'Ouvrir Intégrations →' : 'Connecter la maison →'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenAssistant}
            style={{
              width: '100%',
              borderRadius: 12,
              border: `1px solid ${C.alex}`,
              padding: '10px 12px',
              background: C.white,
              color: C.alex,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            En parler avec {aiName}
          </button>
        </div>
      </GlassCard>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.6, margin: '14px 0 8px' }}>
        JARDIN & EXTÉRIEUR
      </div>
      <GlassCard C={C} style={{ padding: 14, marginBottom: 12, background: C.sageL, border: `1.5px solid ${C.sage}44` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <IconLeaf size={22} color={C.sage} strokeWidth={1.65} />
          <strong style={{ fontSize: 13, color: C.sage }}>Extérieur</strong>
        </div>
        <p style={{ fontSize: 12, color: C.text2, margin: 0, lineHeight: 1.5 }}>
          Arrosage, plants, outils : zone dédiée. Prochaine étape : rappels météo et calendrier d&apos;entretien.
        </p>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill bg={C.white} color={C.sage}>
            Arrosage
          </Pill>
          <Pill bg={C.white} color={C.sage}>
            Plants saison
          </Pill>
          <Pill bg={C.white} color={C.sage}>
            Outils
          </Pill>
        </div>
      </GlassCard>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.6, margin: '14px 0 8px' }}>
        ROUTINES DU FOYER
      </div>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: C.terraXL }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Matin · {morningPct}%</div>
        <div style={{ height: 8, background: C.surface3, borderRadius: 8, marginTop: 6 }}>
          <div style={{ width: `${morningPct}%`, height: '100%', background: C.terra, borderRadius: 8 }} />
        </div>
      </GlassCard>
      {['Aérer', 'Machine', `Cartable ${enfantName}`].map((label, idx) => (
        <GlassCard
          key={label}
          C={C}
          style={{ padding: 12, marginBottom: 8, background: morningDone[idx] ? C.greenL : C.white }}
        >
          <button
            type="button"
            onClick={() => onToggleMorning(idx)}
            style={{
              border: 'none',
              background: 'transparent',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
              {morningDone[idx] ? (
                <IconCheckSmall size={16} color={C.green} />
              ) : (
                <IconCircleOutline size={16} color={C.text3} />
              )}
            </span>
            <span>{label}</span>
          </button>
        </GlassCard>
      ))}
      <GlassCard C={C} style={{ padding: 12, marginTop: 12, marginBottom: 10, background: C.sageL }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Soir · {eveningPct}%</div>
        <div style={{ height: 8, background: C.surface3, borderRadius: 8, marginTop: 6 }}>
          <div style={{ width: `${eveningPct}%`, height: '100%', background: C.sage, borderRadius: 8 }} />
        </div>
      </GlassCard>
      {['Ranger salon', 'Préparer affaires', 'Lave-vaisselle'].map((label, idx) => (
        <GlassCard
          key={label}
          C={C}
          style={{ padding: 12, marginBottom: 8, background: eveningDone[idx] ? C.greenL : C.white }}
        >
          <button
            type="button"
            onClick={() => onToggleEvening(idx)}
            style={{
              border: 'none',
              background: 'transparent',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
              {eveningDone[idx] ? (
                <IconCheckSmall size={16} color={C.green} />
              ) : (
                <IconCircleOutline size={16} color={C.text3} />
              )}
            </span>
            <span>{label}</span>
          </button>
        </GlassCard>
      ))}
    </div>
  );
}
