'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { useIsClient } from '../hooks/useIsClient';
import {
  createJournalEntry,
  deleteJournalEntry,
  excerptJournal,
  formatJournalDayLabel,
  todayDayKey,
  updateJournalEntry,
  type JournalEntry,
} from '../lib/journalEntries';
import { formatNotes } from '../lib/pluralize';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function IntimateJournalPanel({
  C,
  token,
  entries,
  loading,
  selectedDay,
  onSelectedDayChange,
  onRefresh,
  onGoAgenda,
  compact,
}: {
  C: Record<string, string>;
  token: string;
  entries: JournalEntry[];
  loading: boolean;
  selectedDay: string;
  onSelectedDayChange: (day: string) => void;
  onRefresh: () => void | Promise<void>;
  onGoAgenda?: () => void;
  compact?: boolean;
}) {
  const client = useIsClient();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const dayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.entry_date === selectedDay)
        .sort((a, b) => b.id - a.id),
    [entries, selectedDay],
  );

  const recentDays = useMemo(() => {
    const set = new Set(entries.map((e) => e.entry_date));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1)).slice(0, 14);
  }, [entries]);

  useEffect(() => {
    setEditingId(null);
    setEditDraft('');
  }, [selectedDay]);

  const addEntry = useCallback(async () => {
    const text = draft.trim();
    if (!text || !token) return;
    setSaveState('saving');
    try {
      await createJournalEntry(token, { entry_date: selectedDay, content: text });
      setDraft('');
      setSaveState('saved');
      await onRefresh();
      window.setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
    }
  }, [draft, token, selectedDay, onRefresh]);

  const saveEdit = useCallback(async () => {
    if (editingId == null || !token) return;
    const text = editDraft.trim();
    if (!text) return;
    setSaveState('saving');
    try {
      await updateJournalEntry(token, editingId, { content: text });
      setEditingId(null);
      setEditDraft('');
      setSaveState('saved');
      await onRefresh();
      window.setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
    }
  }, [editingId, editDraft, token, onRefresh]);

  const removeEntry = useCallback(
    async (id: number) => {
      if (!token) return;
      if (!window.confirm('Supprimer cette note du journal ?')) return;
      setSaveState('saving');
      try {
        await deleteJournalEntry(token, id);
        if (editingId === id) {
          setEditingId(null);
          setEditDraft('');
        }
        await onRefresh();
        setSaveState('idle');
      } catch {
        setSaveState('error');
      }
    },
    [token, editingId, onRefresh],
  );

  const statusLabel =
    saveState === 'saving'
      ? 'Enregistrement…'
      : saveState === 'saved'
        ? 'Enregistré'
        : saveState === 'error'
          ? 'Erreur — réessaie'
          : loading
            ? 'Chargement…'
            : 'Plusieurs notes par jour · privé';

  return (
    <CollapsibleSection title="Mon journal intime" C={C} defaultOpen>
      <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.45 }}>
        Chaque note est datée et reste dans ton espace privé.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>
          Jour
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => onSelectedDayChange(e.target.value)}
            aria-label="Date de la note"
            style={{
              display: 'block',
              marginTop: 4,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              padding: '8px 10px',
              fontSize: 14,
              width: '100%',
              minWidth: 160,
            }}
          />
        </label>
        {onGoAgenda && !compact ? (
          <button
            type="button"
            onClick={onGoAgenda}
            style={{
              marginTop: 18,
              border: `1px solid ${C.terra}`,
              borderRadius: 10,
              padding: '8px 12px',
              background: C.white,
              color: C.terra,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Voir dans l&apos;agenda
          </button>
        ) : null}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.terra, marginBottom: 6 }}>
        {formatJournalDayLabel(selectedDay, client)}
        {dayEntries.length > 0 ? ` · ${formatNotes(dayEntries.length)}` : ''}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Écris une nouvelle note pour ce jour…"
        aria-label="Nouvelle note de journal"
        style={{
          width: '100%',
          minHeight: compact ? 64 : 88,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 10,
          resize: 'vertical',
          fontSize: 14,
          marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: saveState === 'error' ? C.red : saveState === 'saved' ? C.green : C.text3 }} aria-live="polite">
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={() => void addEntry()}
          disabled={!draft.trim() || saveState === 'saving'}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '8px 14px',
            background: C.terra,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: !draft.trim() || saveState === 'saving' ? 'not-allowed' : 'pointer',
            opacity: !draft.trim() || saveState === 'saving' ? 0.6 : 1,
          }}
        >
          Ajouter la note
        </button>
      </div>
      {dayEntries.length > 0 ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dayEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: C.surface,
              }}
            >
              {editingId === entry.id ? (
                <>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    aria-label="Modifier la note"
                    style={{
                      width: '100%',
                      minHeight: 72,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      padding: 8,
                      fontSize: 14,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      style={{
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 10px',
                        background: C.terra,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft('');
                      }}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '6px 10px',
                        background: C.white,
                        fontSize: 11,
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: C.text }}>
                    {entry.content}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.id);
                        setEditDraft(entry.content);
                      }}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '4px 8px',
                        background: C.white,
                        fontSize: 11,
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeEntry(entry.id)}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '4px 8px',
                        background: C.white,
                        color: C.red,
                        fontSize: 11,
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: C.text3, marginTop: 12 }}>Aucune note pour ce jour.</p>
      )}
      {!compact && recentDays.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 6 }}>Jours avec notes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recentDays.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onSelectedDayChange(day)}
                style={{
                  border: `1px solid ${day === selectedDay ? C.terra : C.border}`,
                  borderRadius: 20,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: day === selectedDay ? 700 : 600,
                  background: day === selectedDay ? C.terraXL : C.white,
                  color: day === selectedDay ? C.terra : C.text2,
                  cursor: 'pointer',
                }}
              >
                {formatJournalDayLabel(day, client)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

export function AgendaJournalSection({
  C,
  selectedDay,
  entries,
  loading,
  onOpenMoi,
}: {
  C: Record<string, string>;
  selectedDay: string;
  entries: JournalEntry[];
  loading: boolean;
  onOpenMoi: () => void;
}) {
  const client = useIsClient();
  const dayEntries = entries.filter((e) => e.entry_date === selectedDay);

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 10,
        borderRadius: 20,
        border: `1.5px solid ${C.lilac}`,
        background: C.lilacL,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.lilac }}>Journal intime</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
            {formatJournalDayLabel(selectedDay, client)}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenMoi}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '6px 10px',
            background: C.lilac,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Écrire
        </button>
      </div>
      {loading ? (
        <p style={{ fontSize: 12, color: C.text2, margin: 0 }}>Chargement…</p>
      ) : dayEntries.length === 0 ? (
        <p style={{ fontSize: 12, color: C.text2, margin: 0 }}>Aucune note pour ce jour.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dayEntries.map((e) => (
            <div
              key={e.id}
              style={{
                padding: 10,
                borderRadius: 12,
                background: C.white,
                border: `1px solid ${C.border}`,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', color: C.text }}>
                {excerptJournal(e.content, 280)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
