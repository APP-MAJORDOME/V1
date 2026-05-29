'use client';

import { useCallback, useEffect, useState } from 'react';
import { useClientCalendar } from '../hooks/useClientCalendar';
import { IconGift } from './md-icons';

const LS_KEY = 'majordome.v1.birthdays';

export type BirthdayRow = { id: string; name: string; date: string; notes?: string };

function loadBirthdays(): BirthdayRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is BirthdayRow => x && typeof x === 'object' && typeof (x as BirthdayRow).name === 'string' && typeof (x as BirthdayRow).date === 'string');
  } catch {
    return [];
  }
}

export function AnniversairesPanel({ C }: { C: Record<string, string> }) {
  const cal = useClientCalendar();
  const [rows, setRows] = useState<BirthdayRow[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setRows(loadBirthdays());
  }, []);

  const persist = useCallback((next: BirthdayRow[]) => {
    setRows(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  function addRow() {
    const n = name.trim();
    const d = date.trim();
    if (!n || !d) return;
    persist([...rows, { id: `${Date.now()}`, name: n, date: d, notes: notes.trim() || undefined }]);
    setName('');
    setDate('');
    setNotes('');
  }

  function removeRow(id: string) {
    persist(rows.filter((r) => r.id !== id));
  }

  function nextBirthdayLabel(isoOrText: string): string {
    if (!cal.ready) return isoOrText;
    const m = isoOrText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return isoOrText;
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let y = now.getFullYear();
    let next = new Date(y, month, day);
    let startNext = new Date(next.getFullYear(), next.getMonth(), next.getDate());
    if (startNext < startToday) {
      y += 1;
      next = new Date(y, month, day);
      startNext = new Date(next.getFullYear(), next.getMonth(), next.getDate());
    }
    const diff = Math.round((startNext.getTime() - startToday.getTime()) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    return `Dans ${diff} j. (${next.toLocaleDateString('fr-FR')})`;
  }

  return (
    <div style={{ padding: '14px 18px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <IconGift size={26} color={C.terra} strokeWidth={1.65} />
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.5 }}>FOYER</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.text2, lineHeight: 1.45 }}>
            Les dates sont enregistrées pour ton foyer sur cet appareil.
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
        <input
          placeholder="Prénom"
          aria-label="Prénom de la personne"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ borderRadius: 12, border: `1.5px solid ${C.border}`, padding: '10px 12px', fontSize: 13, background: C.white }}
        />
        <input
          type="date"
          aria-label="Date d'anniversaire"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ borderRadius: 12, border: `1.5px solid ${C.border}`, padding: '10px 12px', fontSize: 13, background: C.white }}
        />
        <input
          placeholder="Idée cadeau / notes (optionnel)"
          aria-label="Idée cadeau ou notes, optionnel"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ borderRadius: 12, border: `1.5px solid ${C.border}`, padding: '10px 12px', fontSize: 13, background: C.surface }}
        />
        <button
          type="button"
          onClick={addRow}
          style={{
            borderRadius: 12,
            border: 'none',
            padding: '12px 14px',
            background: C.terra,
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Ajouter
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 ? (
          <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>Aucun anniversaire — ajoute les tiens.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{
                borderRadius: 16,
                border: `1.5px solid ${C.border}`,
                padding: 12,
                background: C.white,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.terra, marginTop: 4 }}>{nextBirthdayLabel(r.date)}</div>
                {r.notes ? (
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 6, lineHeight: 1.45 }}>{r.notes}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                style={{
                  flexShrink: 0,
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
                Retirer
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
