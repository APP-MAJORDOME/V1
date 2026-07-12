'use client';

import type { JournalEntry } from '../lib/journalEntries';
import { IntimateJournalPanel } from './IntimateJournalPanel';
import type { SelfMoment } from '../lib/moiWellness';

export function PrivateSpacePanel({
  C,
  open,
  onClose,
  token,
  moiMood,
  onMoiMoodChange,
  sleep,
  onSleepChange,
  cycleDay,
  onCycleDayChange,
  journalEntries,
  journalLoading,
  journalSelectedDay,
  onJournalSelectedDayChange,
  onJournalRefresh,
  selfMoments,
  onToggleSelfMoment,
  selfDoneCount,
  onAddSelfMomentAsTask,
  onToast,
}: {
  C: Record<string, string>;
  open: boolean;
  onClose: () => void;
  token: string;
  moiMood: number;
  onMoiMoodChange: (index: number) => void;
  sleep: number;
  onSleepChange: (hours: number) => void;
  cycleDay: number;
  onCycleDayChange: (day: number) => void;
  journalEntries: JournalEntry[];
  journalLoading: boolean;
  journalSelectedDay: string;
  onJournalSelectedDayChange: (day: string) => void;
  onJournalRefresh: () => void | Promise<void>;
  selfMoments: SelfMoment[];
  onToggleSelfMoment: (id: string) => void;
  selfDoneCount: number;
  onAddSelfMomentAsTask: (label: string) => void;
  onToast: (kind: 'success' | 'error' | 'info', text: string) => void;
}) {
  if (!open) return null;

  const moodOptions = [
    { emoji: '😴', label: 'À plat' },
    { emoji: '😟', label: 'Tendu·e' },
    { emoji: '😐', label: 'Ok' },
    { emoji: '🙂', label: 'Bien' },
    { emoji: '😄', label: 'Super' },
  ] as const;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: C.white,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="md-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>
            Mon espace
          </h2>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.green,
              background: C.greenL,
              padding: '2px 8px',
              borderRadius: 8,
            }}
          >
            Visible uniquement par toi
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        <div style={{ background: C.white, borderRadius: 16, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 8 }}>Humeur</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
            {moodOptions.map((m, i) => (
              <button
                key={m.emoji}
                type="button"
                aria-label={m.label}
                onClick={() => {
                  onMoiMoodChange(i);
                  onToast('success', 'Humeur enregistrée');
                }}
                style={{
                  border: 'none',
                  background: moiMood === i ? C.lilacL : C.surface,
                  borderRadius: 12,
                  padding: '8px 6px',
                  flex: 1,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 24 }}>{m.emoji}</div>
                <div style={{ fontSize: 9, color: C.text2 }}>{m.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 16, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>
            Sommeil : {sleep.toFixed(1)} h
            <input
              type="range"
              min={4}
              max={10}
              step={0.5}
              value={sleep}
              onChange={(e) => onSleepChange(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8 }}
            />
          </label>
        </div>
        <div style={{ background: C.white, borderRadius: 16, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>
            Cycle — jour {cycleDay}
            <input
              type="range"
              min={1}
              max={28}
              value={cycleDay}
              onChange={(e) => onCycleDayChange(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8 }}
            />
          </label>
        </div>
        <IntimateJournalPanel
          C={C}
          token={token}
          entries={journalEntries}
          loading={journalLoading}
          selectedDay={journalSelectedDay}
          onSelectedDayChange={onJournalSelectedDayChange}
          onRefresh={onJournalRefresh}
        />
        <div style={{ marginTop: 12, fontSize: 11, color: C.text3 }}>
          Moments pour toi : {selfDoneCount}/{selfMoments.length} — ces données ne sont jamais partagées au foyer.
        </div>
      </div>
    </div>
  );
}
