'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClientCalendar } from '../hooks/useClientCalendar';
import { IconBoltSoft, IconCheckSmall } from './md-icons';

const LS_KEY = 'majordome.v1.routines-v9';

export type RoutineRow = {
  id: string;
  title: string;
  emoji: string;
  cadence: 'daily' | 'weekly';
  days?: number[];
  doneDates: string[];
};

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

function ProgressRing({ pct, size, color, track }: { pct: number; size: number; color: string; track: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function RoutinesPanel({ C, userName }: { C: Record<string, string>; userName?: string }) {
  const cal = useClientCalendar();
  const [rows, setRows] = useState<RoutineRow[]>(SEED);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const today = cal.todayIso;
  const dow = cal.ready ? (cal.dayOfWeekIndex + 6) % 7 : 0;

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
  const allDone = todayList.length > 0 && doneToday === todayList.length;

  const streak = useMemo(() => {
    if (!cal.ready || !cal.todayIso) return 0;
    const dailies = rows.filter((r) => r.cadence === 'daily');
    if (dailies.length === 0) return 0;
    let s = 0;
    const base = new Date(`${cal.todayIso}T12:00:00`);
    for (let off = 0; off < 30; off++) {
      const d = new Date(base);
      d.setDate(d.getDate() - off);
      const iso = d.toISOString().slice(0, 10);
      const allDoneDay = dailies.every((r) => r.doneDates.includes(iso));
      if (allDoneDay) s++;
      else break;
    }
    return s;
  }, [rows, cal.ready, cal.todayIso]);

  function markDone(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.doneDates.includes(today)) return;

    persist(
      rows.map((r) => {
        if (r.id !== id) return r;
        return { ...r, doneDates: [...r.doneDates, today] };
      }),
    );

    setFlashId(id);
    setTimeout(() => setFlashId(null), 400);

    const willBeAllDone = todayList.every((r) => r.id === id || r.doneDates.includes(today));
    if (willBeAllDone) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 4000);
    }
  }

  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <IconBoltSoft size={26} color={C.sun} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>ROUTINES</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Coche chaque routine — un tap sur « Fait » suffit.
          </p>
        </div>
      </div>

      {showCelebration ? (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${C.greenL}, ${C.sageL})`,
            border: `1.5px solid ${C.green}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 4 }}>🌿</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>
            Tout est fait{userName ? `, bravo ${userName}` : ', bravo'} !
          </div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>Tu as géré ta journée.</div>
        </div>
      ) : null}

      <div
        style={{
          borderRadius: 20,
          padding: 16,
          marginBottom: 20,
          background: C.white,
          border: `1.5px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <ProgressRing pct={pct} size={88} color={allDone ? C.green : C.terra} track={C.surface3} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{doneToday}/{todayList.length}</span>
            <span style={{ fontSize: 10, color: C.text2 }}>aujourd&apos;hui</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text3 }}>STREAK</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.terra, lineHeight: 1 }}>
            {streak}
            {streak >= 7 ? ' 🔥' : ''}
          </div>
          <div style={{ fontSize: 12, color: C.text2 }}>jours (quotidiennes)</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>Pour aujourd&apos;hui</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {todayList.length === 0 ? (
          <p style={{ fontSize: 13, color: C.text2 }}>Aucune routine prévue aujourd&apos;hui.</p>
        ) : (
          todayList.map((r) => {
            const done = r.doneDates.includes(today);
            const flashing = flashId === r.id;
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 0,
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: `1.5px solid ${done ? C.green + '66' : C.border}`,
                  background: done ? C.greenL : C.white,
                  transform: flashing ? 'scale(0.98)' : 'scale(1)',
                  transition: 'transform 0.15s ease, background 0.2s ease',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{r.emoji}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: 700,
                      color: done ? C.green : C.text,
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {r.title}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => markDone(r.id)}
                  aria-label={done ? 'Déjà fait' : `Marquer ${r.title} comme fait`}
                  style={{
                    minWidth: 72,
                    border: 'none',
                    background: done ? C.green : C.terra,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: done ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '0 12px',
                  }}
                >
                  {done ? (
                    <>
                      <IconCheckSmall size={16} color="#fff" strokeWidth={2.5} />
                      Fait
                    </>
                  ) : (
                    '✓ Fait'
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
