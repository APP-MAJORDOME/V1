'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useModalA11y } from '../lib/useModalA11y';
import type { HubKey } from './PlusHub';
import { ALL_HUB_KEYS, PLUS_HUB_ITEMS } from './PlusHub';
import {
  type HomeLayoutConfig,
  type HomeSectionId,
  DEFAULT_HOME_LAYOUT,
  HOME_SECTION_LABELS,
} from '../lib/homeLayout';

export function HomeLayoutEditor({
  open,
  onClose,
  initial,
  onSave,
  C,
}: {
  open: boolean;
  onClose: () => void;
  initial: HomeLayoutConfig;
  onSave: (next: HomeLayoutConfig) => void;
  C: Record<string, string>;
}) {
  const [hubShortcuts, setHubShortcuts] = useState<HubKey[]>(initial.hubShortcuts);
  const [sections, setSections] = useState<Record<HomeSectionId, boolean>>(initial.sections);
  const panelRef = useRef<HTMLDivElement>(null);

  const hubMeta = useMemo(() => new Map(PLUS_HUB_ITEMS.map((i) => [i.id, i])), []);

  useModalA11y(open, onClose, panelRef);

  useEffect(() => {
    if (!open) return;
    setHubShortcuts([...initial.hubShortcuts]);
    setSections({ ...initial.sections });
    // Relire la disposition sauvegardée à chaque ouverture (initial = render courant).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne pas resynchroniser à chaque rerender si homeLayout change pendant l’édition
  }, [open]);

  if (!open) return null;

  const pool = ALL_HUB_KEYS.filter((k) => !hubShortcuts.includes(k));

  function toggleSection(id: HomeSectionId, v: boolean) {
    setSections((prev) => ({ ...prev, [id]: v }));
  }

  function moveShortcut(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= hubShortcuts.length) return;
    setHubShortcuts((prev) => {
      const copy = [...prev];
      const tmp = copy[idx]!;
      copy[idx] = copy[j]!;
      copy[j] = tmp;
      return copy;
    });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,18,0.5)', border: 'none', cursor: 'pointer' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-layout-editor-title"
        tabIndex={-1}
        style={{
          position: 'relative',
          width: 'min(420px, 100vw)',
          maxHeight: '88vh',
          background: C.white,
          borderRadius: '22px 22px 0 0',
          border: `1.5px solid ${C.border}`,
          boxShadow: '0 -12px 48px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${C.border}`, position: 'relative' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 10px' }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la personnalisation"
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              width: 36,
              height: 36,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              background: C.white,
              color: C.text2,
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          <h2 id="home-layout-editor-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text, paddingRight: 44 }}>
            Personnaliser l&apos;accueil
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Choisis les modules <strong>Univers</strong> en raccourci et affiche ou masque les blocs de ton écran d&apos;accueil. Réglages enregistrés sur cet appareil pour ton compte.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.terra, marginBottom: 8 }}>RACCOURCIS UNIVERS</div>
          <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px', lineHeight: 1.45 }}>
            Même liste que l&apos;onglet Plus — ordre = grille sur l&apos;accueil.
          </p>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {hubShortcuts.map((id, idx) => {
              const m = hubMeta.get(id);
              if (!m) return null;
              const Ic = m.Icon;
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 10,
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: C.surface ?? '#FFF5F0',
                  }}
                >
                  <Ic size={22} color={C.terra} strokeWidth={1.65} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: C.text3 }}>{m.hint}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => moveShortcut(idx, -1)}
                      disabled={idx === 0}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '2px 8px', fontSize: 11, background: C.white }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveShortcut(idx, 1)}
                      disabled={idx === hubShortcuts.length - 1}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '2px 8px', fontSize: 11, background: C.white }}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHubShortcuts((prev) => prev.filter((x) => x !== id))}
                    style={{ border: 'none', background: C.redL, color: C.red, borderRadius: 10, padding: '8px 10px', fontSize: 11, fontWeight: 700 }}
                  >
                    Retirer
                  </button>
                </div>
              );
            })}
          </div>
          {pool.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text2, marginBottom: 6 }}>Ajouter un module</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pool.map((id) => {
                  const m = hubMeta.get(id);
                  if (!m) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHubShortcuts((prev) => [...prev, id])}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 12,
                        padding: '8px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: C.white,
                        color: C.text,
                        cursor: 'pointer',
                      }}
                    >
                      + {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={{ fontSize: 11, fontWeight: 800, color: C.terra, marginBottom: 8 }}>BLOCS DE L&apos;ACCUEIL</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {(Object.keys(HOME_SECTION_LABELS) as HomeSectionId[]).map((sid) => (
              <label
                key={sid}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  cursor: 'pointer',
                  background: C.white,
                }}
              >
                <input
                  type="checkbox"
                  checked={sections[sid] !== false}
                  onChange={(e) => toggleSection(sid, e.target.checked)}
                  aria-label={`Afficher la section ${HOME_SECTION_LABELS[sid]}`}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                  <strong>{HOME_SECTION_LABELS[sid]}</strong>
                  {sid === 'hub_shortcuts_row' ? (
                    <span style={{ display: 'block', fontSize: 10, color: C.text3, marginTop: 2 }}>
                      Désactiver masque toute la grille de raccourcis (les modules restent dans Plus).
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 18px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setHubShortcuts([...DEFAULT_HOME_LAYOUT.hubShortcuts]);
              setSections({ ...DEFAULT_HOME_LAYOUT.sections });
            }}
            style={{
              flex: 1,
              minWidth: 120,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              fontWeight: 700,
              fontSize: 13,
              background: C.surface2,
              color: C.text,
              cursor: 'pointer',
            }}
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ hubShortcuts, sections });
              onClose();
            }}
            style={{
              flex: 1,
              minWidth: 120,
              border: 'none',
              borderRadius: 12,
              padding: '12px 14px',
              fontWeight: 800,
              fontSize: 13,
              background: C.terra,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
