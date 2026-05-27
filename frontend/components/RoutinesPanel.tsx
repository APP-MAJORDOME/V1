'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconBoltSoft } from './md-icons';

const LS_KEY = 'majordome.v1.routines-v9';

export type RoutineRow = {
  id: string;
  title: string;
  emoji: string;
  cadence: 'daily' | 'weekly';
  /** 0 = Monday … 6 = Sunday (aligned with V9 filter) */
  days?: number[];
  doneDates: string[];
};

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6 */
function todayDowMon0(): number {
  const js = new Date().getDay();
  return (js + 6) % 7;
}

const SEED: RoutineRow[] = [
  { id: 'rt1', title: 'Aérer les chambres', emoji: '🪟', cadence: 'daily', doneDates: [] },
  { id: 'rt2', title: 'Lancer machine / sécher', emoji: '🧺', cadence: 'daily', doneDates: [] },
  { id: 'rt3', title: 'Préparer cartables', emoji: '🎒', cadence: 'weekly', days: [0, 1, 2, 3, 4], doneDates: [] },
  { id: 'rt4', title: 'Sortir les poubelles', emoji: '🗑️', cadence: 'weekly', days: [2, 5], doneDates: [] },
];

function loadRoutines(): RoutineRow[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED;
    return parsed.filter((x): x is RoutineRow => x && typeof x === 'object' && typeof (x as RoutineRow).title === 'string');
  } catch {
    return SEED;
  }
}

export function RoutinesPanel({ C }: { C: Record<string, string> }) {
  const [rows, setRows] = useState<RoutineRow[]>(SEED);
  const today = todayIso();
  const dow = todayDowMon0();

  useEffect(() => {
    setRows(loadRoutines());
  }, []);

  const persist = useCallback((next: RoutineRow[]) => {
    setRows(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const todayList = useMemo(() => {
    return rows.filter((r) => {
      if (r.cadence === 'daily') return true;
      return r.days?.includes(dow) ?? false;
    });
  }, [rows, dow]);

  const doneToday = todayList.filter((r) => r.doneDates.includes(today)).length;
  const pct = todayList.length ? Math.round((doneToday / todayList.length) * 100) : 0;

  const streak = useMemo(() => {
    const dailies = rows.filter((r) => r.cadence === 'daily');
    if (dailies.length === 0) return 0;
    let s = 0;
    for (let off = 0; off < 30; off++) {
      const d = new Date();
      d.setDate(d.getDate() - off);
      const iso = d.toISOString().slice(0, 10);
      const allDone = dailies.every((r) => r.doneDates.includes(iso));
      if (allDone) s++;
      else break;
    }
    return s;
  }, [rows]);

  function toggle(id: string) {
    persist(
      rows.map((r) => {
        if (r.id !== id) return r;
        const has = r.doneDates.includes(today);
        return {
          ...r,
          doneDates: has ? r.doneDates.filter((d) => d !== today) : [...r.doneDates, today],
        };
      }),
    );
  }

  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <IconBoltSoft size={26} color={C.sun} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>ROUTINES</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Coche chaque routine au fil de la journée pour suivre ta progression.
          </p>
        </div>
      </div>

      <div
        style={{
          borderRadius: 18,
          padding: 14,
          marginBottom: 16,
          background: `linear-gradient(135deg, ${C.terraXL}, ${C.surface})`,
          border: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.text3 }}>STREAK</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.terra, lineHeight: 1.1 }}>{streak}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>jours (quotidiennes)</div>
        </div>
        <div style={{ textAlign: 'right', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.text3 }}>AUJOURD&apos;HUI</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>
            {doneToday}/{todayList.length}
          </div>
          <div style={{ height: 8, borderRadius: 8, background: C.surface3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: C.terra, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 10 }}>Pour aujourd&apos;hui</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {todayList.length === 0 ? (
          <p style={{ fontSize: 13, color: C.text2 }}>Aucune routine prévue — ajoute-en depuis les réglages (bientôt).</p>
        ) : (
          todayList.map((r) => {
            const done = r.doneDates.includes(today);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: `1.5px solid ${C.border}`,
                  background: done ? C.greenL : C.white,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>{r.emoji}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: done ? C.green : C.text }}>{r.title}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: done ? C.green : C.text3 }}>{done ? 'Fait' : 'À faire'}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
