'use client';

import { useCallback, useEffect, useState } from 'react';
import { useClientCalendar } from '../hooks/useClientCalendar';
import { IconTrash } from './md-icons';

const LS_KEY = 'majordome.v1.trash-schedule';

export type TrashSlot = { id: string; weekday: string; types: string };

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const DEFAULT_SLOTS: TrashSlot[] = [
  { id: 'd1', weekday: 'Lundi', types: 'Ordures ménagères' },
  { id: 'd2', weekday: 'Mercredi', types: 'Emballages recyclables' },
  { id: 'd3', weekday: 'Vendredi', types: 'Verre (point d’apport)' },
];

function loadSlots(): TrashSlot[] {
  if (typeof window === 'undefined') return DEFAULT_SLOTS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SLOTS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SLOTS;
    return parsed.filter((x): x is TrashSlot => x && typeof x === 'object' && typeof (x as TrashSlot).weekday === 'string');
  } catch {
    return DEFAULT_SLOTS;
  }
}

export function PoubellesPanel({ C }: { C: Record<string, string> }) {
  const cal = useClientCalendar();
  const [slots, setSlots] = useState<TrashSlot[]>(DEFAULT_SLOTS);

  useEffect(() => {
    setSlots(loadSlots());
  }, []);

  const persist = useCallback((next: TrashSlot[]) => {
    setSlots(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  function updateSlot(id: string, patch: Partial<TrashSlot>) {
    persist(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    persist([...slots, { id: `${Date.now()}`, weekday: 'Lundi', types: 'À préciser' }]);
  }

  function removeSlot(id: string) {
    const slot = slots.find((s) => s.id === id);
    const label = slot ? `${slot.weekday} — ${slot.types}` : 'ce créneau';
    if (!window.confirm(`Supprimer ${label} ?`)) return;
    persist(slots.filter((s) => s.id !== id));
  }

  const today = cal.ready ? WEEKDAYS[cal.dayOfWeekIndex] : '';
  const dueToday = cal.ready ? slots.filter((s) => s.weekday === today) : [];

  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <IconTrash size={26} color={C.sage} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>COLLECTE</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.text2, lineHeight: 1.45 }}>
            Planning local (modifiable) — rappels push à connecter plus tard.
          </p>
        </div>
      </div>
      {dueToday.length > 0 ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 14,
            background: C.sun + '22',
            border: `1px solid ${C.sun}55`,
            fontSize: 13,
            color: C.text,
          }}
        >
          <strong style={{ color: C.terra }}>Aujourd’hui ({today})</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {dueToday.map((s) => (
              <li key={s.id}>{s.types}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ marginBottom: 14, fontSize: 12, color: C.text2 }}>Rien de prévu aujourd’hui selon ton planning.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slots.map((s) => (
          <div
            key={s.id}
            style={{
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              padding: 12,
              background: C.white,
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={s.weekday}
                onChange={(e) => updateSlot(s.id, { weekday: e.target.value })}
                style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, fontSize: 12, background: C.surface }}
              >
                {WEEKDAYS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeSlot(s.id)}
                style={{
                  marginLeft: 'auto',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '6px 10px',
                  background: C.surface,
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.text2,
                  cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
            </div>
            <input
              value={s.types}
              onChange={(e) => updateSlot(s.id, { types: e.target.value })}
              aria-label={`Types de déchets pour ${s.weekday}`}
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 10, fontSize: 13 }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addSlot}
        style={{
          marginTop: 12,
          width: '100%',
          borderRadius: 12,
          border: `1.5px dashed ${C.border}`,
          padding: 12,
          background: C.surface,
          fontWeight: 700,
          fontSize: 13,
          color: C.text2,
          cursor: 'pointer',
        }}
      >
        + Ajouter un créneau
      </button>
    </div>
  );
}
