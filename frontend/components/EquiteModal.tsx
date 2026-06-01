'use client';

import { EquityGlyphIcon } from './md-icons';

type EquiteTab = 'semaine' | 'categories' | 'plan';

type EquityWeek = {
  label: string;
  joanne: number;
  alex: number;
  lea: number;
  tasks: { joanne: number; alex: number; lea: number };
};

type EquityCategory = {
  label: string;
  joanne: number;
  alex: number;
  lea: number;
  glyph: string;
};

type EquitySuggestion = {
  task: string;
  from: string;
  to: string;
  save: string;
};

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

export function EquiteModal({
  C,
  open,
  prenom,
  partenaire,
  enfant,
  equiteTab,
  onEquiteTabChange,
  equityWeeks,
  equityCategories,
  equitySuggestions,
  equitePlanText,
  equitePlanLoading,
  onClose,
  onAlfredPrompt,
}: {
  C: Record<string, string>;
  open: boolean;
  prenom: string;
  partenaire: string;
  enfant: string;
  equiteTab: EquiteTab;
  onEquiteTabChange: (tab: EquiteTab) => void;
  equityWeeks: EquityWeek[];
  equityCategories: EquityCategory[];
  equitySuggestions: EquitySuggestion[];
  equitePlanText: string;
  equitePlanLoading: boolean;
  onClose: () => void;
  onAlfredPrompt: (text: string) => void;
}) {
  if (!open) return null;

  const w = equityWeeks[0];

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '92%',
          background: C.white,
          borderRadius: '22px 22px 0 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>Score équité</h2>
          <p style={{ fontSize: 11, color: C.text2, margin: '0 0 6px', lineHeight: 1.45 }}>
            Aperçu : historique démo + tâches assignées dans l&apos;app. La charge invisible (courses de tête, admin non saisi) n&apos;est pas mesurée.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                ['semaine', 'Semaine'],
                ['categories', 'Domaines'],
                ['plan', 'Plan'],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => onEquiteTabChange(id)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 12,
                  border: `1.5px solid ${equiteTab === id ? C.terra : C.border}`,
                  background: equiteTab === id ? C.terra : 'transparent',
                  color: equiteTab === id ? '#fff' : C.text2,
                  fontSize: 9.5,
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 28px' }}>
          {equiteTab === 'semaine' && w ? (
            <>
              <div
                style={{
                  background: C.redL,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                  border: `1.5px solid ${C.red}33`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 8 }}>DÉSÉQUILIBRE DÉTECTÉ</div>
                <div style={{ display: 'flex', gap: 3, height: 14, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ flex: w.joanne, background: C.terra }} />
                  <div style={{ flex: w.alex, background: C.alex }} />
                  <div style={{ flex: w.lea, background: C.mint }} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { n: prenom, p: w.joanne, t: w.tasks.joanne, c: C.terra },
                    { n: partenaire, p: w.alex, t: w.tasks.alex, c: C.alex },
                    { n: enfant, p: w.lea, t: w.tasks.lea, c: C.mint },
                  ].map((x) => (
                    <div key={x.n} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: x.c }}>{x.p}%</div>
                      <div style={{ fontSize: 10, color: C.text2, fontWeight: 600 }}>{x.n}</div>
                      <div style={{ fontSize: 9, color: C.text3 }}>{x.t} tâches</div>
                    </div>
                  ))}
                </div>
              </div>
              <GlassCard C={C} style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Évolution 4 semaines</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {equityWeeks.map((week, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: 4 }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${(week.joanne / 100) * 56}px`,
                            background: `${C.terra}99`,
                            borderRadius: '4px 4px 0 0',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? C.terra : C.text3 }}>{week.joanne}%</div>
                      <div style={{ fontSize: 8, color: C.text3, lineHeight: 1.3 }}>
                        {i === 0 ? 'Ce sem.' : i === 1 ? 'Sem. -1' : `-${i} sem.`}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: C.text2, fontStyle: 'italic' }}>
                  {prenom} porte en moyenne environ <strong style={{ color: C.terra }}>69 %</strong> de la charge visible — l&apos;objectif
                  équitable tourne autour de 33 % chacun.
                </div>
              </GlassCard>
            </>
          ) : null}
          {equiteTab === 'categories' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {equityCategories.map((cat, i) => (
                <GlassCard C={C} key={i} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <EquityGlyphIcon glyph={cat.glyph} size={15} color={C.text} />
                        {cat.label}
                      </span>
                    </span>
                    {cat.joanne > 80 ? (
                      <Pill color={C.red} bg={C.redL}>
                        {prenom}
                      </Pill>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ flex: cat.joanne, background: C.terra }} />
                    <div style={{ flex: cat.alex, background: C.alex }} />
                    <div style={{ flex: cat.lea, background: C.mint }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: C.text3 }}>
                    <span>
                      <strong style={{ color: C.terra }}>{cat.joanne}%</strong> {prenom}
                    </span>
                    <span>
                      <strong style={{ color: C.alex }}>{cat.alex}%</strong> {partenaire}
                    </span>
                    <span>
                      <strong style={{ color: C.mint }}>{cat.lea}%</strong> {enfant}
                    </span>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : null}
          {equiteTab === 'plan' ? (
            <>
              <div
                style={{
                  background: C.sageL,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  border: `1.5px solid ${C.sage}33`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, marginBottom: 6 }}>PLAN ALFRED</div>
                {equitePlanLoading ? (
                  <div style={{ fontSize: 13, color: C.text2 }}>Alfred rédige ton plan…</div>
                ) : (
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.55, margin: 0 }}>{equitePlanText}</p>
                )}
              </div>
              {equitySuggestions.map((s, i) => (
                <GlassCard C={C} key={i} style={{ padding: 14, marginBottom: 8, borderColor: C.alex + '44' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.task}</div>
                  <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>
                    {s.from} → <strong style={{ color: C.alex }}>{s.to}</strong> · <span style={{ color: C.green }}>{s.save}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAlfredPrompt(`Message pour ${s.to} : peux-tu prendre la tâche « ${s.task} » ?`)}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      padding: 8,
                      borderRadius: 10,
                      border: 'none',
                      background: C.alex,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Proposer via Alfred
                  </button>
                </GlassCard>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
