'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteJson, getJson, postJson } from '../lib/api';
import { useClientCalendar } from '../hooks/useClientCalendar';
import { t } from '../lib/i18n';
import { IconGift } from './md-icons';

export type BirthdayRow = { id: number; name: string; date: string; notes?: string };

type BirthdayApi = { id: number; name: string; birthday_date: string; notes?: string };

function mapRow(b: BirthdayApi): BirthdayRow {
  return { id: b.id, name: b.name, date: b.birthday_date.slice(0, 10), notes: b.notes || undefined };
}

export function AnniversairesPanel({ C, token }: { C: Record<string, string>; token?: string }) {
  const cal = useClientCalendar();
  const [rows, setRows] = useState<BirthdayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const refresh = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getJson<BirthdayApi[]>('/api/v1/household/birthdays', token);
      setRows(data.map(mapRow));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addRow() {
    const n = name.trim();
    const d = date.trim();
    if (!n || !d || !token) return;
    await postJson('/api/v1/household/birthdays', { name: n, birthday_date: d, notes: notes.trim() }, token);
    setName('');
    setDate('');
    setNotes('');
    await refresh();
  }

  async function removeRow(id: number) {
    if (!token) return;
    await deleteJson(`/api/v1/household/birthdays/${id}`, token);
    await refresh();
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
            Partagé avec tous les membres du foyer, sur tous les appareils.
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
          onClick={() => void addRow()}
          disabled={!token || loading}
          style={{
            borderRadius: 12,
            border: 'none',
            padding: '12px 14px',
            background: C.terra,
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            cursor: token ? 'pointer' : 'not-allowed',
            opacity: token ? 1 : 0.6,
          }}
        >
          Ajouter
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 ? (
          <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>{t('empty.birthdays')}</p>
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
                onClick={() => void removeRow(r.id)}
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
