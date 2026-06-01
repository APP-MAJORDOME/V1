'use client';

import { CollapsibleSection } from './CollapsibleSection';
import { IntimateJournalPanel } from './IntimateJournalPanel';
import type { JournalEntry } from '../lib/journalEntries';
import {
  IconChart,
  IconCheckSmall,
  IconCircleOutline,
  IconHeartOutline,
  IconWallet,
} from './md-icons';
import type { BudgetItem } from '../lib/budget';
import type { SelfMoment } from '../lib/moiWellness';

function GlassCard({
  children,
  style = {},
  onClick,
  C,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  C: Record<string, string>;
}) {
  return (
    <div
      onClick={onClick}
      style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}
    >
      {children}
    </div>
  );
}

export function MoiTabPanel({
  C,
  token,
  aiName,
  openTaskCount,
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
  onGoAgenda,
  selfMoments,
  onToggleSelfMoment,
  selfDoneCount,
  onAddSelfMomentAsTask,
  budget,
  onBudgetChange,
  budgetEditing,
  onBudgetEditingToggle,
  onSaveBudget,
  onLogout,
  onToast,
}: {
  C: Record<string, string>;
  token: string;
  aiName: string;
  openTaskCount: number;
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
  onGoAgenda: () => void;
  selfMoments: SelfMoment[];
  onToggleSelfMoment: (id: string) => void;
  selfDoneCount: number;
  onAddSelfMomentAsTask: (label: string) => void;
  budget: BudgetItem[];
  onBudgetChange: (updater: (prev: BudgetItem[]) => BudgetItem[]) => void;
  budgetEditing: boolean;
  onBudgetEditingToggle: () => void;
  onSaveBudget: () => void | Promise<void>;
  onLogout: () => void;
  onToast: (kind: 'success' | 'error' | 'info', text: string) => void;
}) {
  const moodOptions = [
    { emoji: '😴', label: 'Épuisée' },
    { emoji: '😟', label: 'Stressée' },
    { emoji: '😐', label: 'Ok' },
    { emoji: '🙂', label: 'Bien' },
    { emoji: '😄', label: 'Super' },
  ] as const;

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
      <GlassCard C={C} style={{ padding: 14, marginBottom: 12, background: C.surface }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 8 }}>Compte</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href="/settings" style={{ fontSize: 13, fontWeight: 700, color: C.terra, textDecoration: 'none' }}>
            Paramètres et connexions
          </a>
          <button
            type="button"
            onClick={onLogout}
            style={{
              alignSelf: 'flex-start',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 12px',
              background: C.white,
              color: C.text2,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      </GlassCard>
      <h2 style={{ margin: '0 0 10px', color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconHeartOutline size={22} color={C.lilac} strokeWidth={1.65} />
        Moi d&apos;abord
      </h2>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: C.lilacL }}>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>Humeur du jour</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          {moodOptions.map((m, i) => (
            <button
              key={m.emoji}
              type="button"
              aria-label={m.label}
              onClick={() => {
                onMoiMoodChange(i);
                onToast('success', 'Humeur enregistrée ✓');
              }}
              style={{
                border: 'none',
                background: moiMood === i ? C.white : 'transparent',
                borderRadius: 12,
                padding: '8px 6px',
                flex: 1,
                cursor: 'pointer',
                boxShadow: moiMood === i ? `0 0 0 2px ${C.lilac}` : 'none',
              }}
            >
              <div style={{ fontSize: 32, lineHeight: 1 }}>{m.emoji}</div>
              <div style={{ fontSize: 9, color: C.text2, marginTop: 4, fontWeight: 600 }}>{m.label}</div>
            </button>
          ))}
        </div>
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10 }}>
        <label htmlFor="sleep-range" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
          Sommeil : <strong>{sleep}h</strong>
        </label>
        <input
          id="sleep-range"
          type="range"
          min={3}
          max={11}
          step={0.5}
          value={sleep}
          onChange={(e) => onSleepChange(Number(e.target.value))}
          aria-label="Heures de sommeil"
          aria-valuemin={3}
          aria-valuemax={11}
          aria-valuenow={sleep}
          style={{ width: '100%' }}
        />
      </GlassCard>
      <CollapsibleSection title="Mon cycle" C={C}>
        <p style={{ fontSize: 10, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
          Donnée de santé : tu peux ajuster ou laisser vide. Stockée pour ton foyer ; tu peux demander la suppression dans{' '}
          <a href="/settings#confidentialite" style={{ color: C.terra, fontWeight: 700 }}>
            Confidentialité
          </a>
          .
        </p>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>Jour J{cycleDay} de ton cycle</div>
        <input
          type="range"
          min={1}
          max={28}
          step={1}
          value={cycleDay}
          onChange={(e) => onCycleDayChange(Number(e.target.value))}
          aria-label="Jour du cycle menstruel"
          aria-valuemin={1}
          aria-valuemax={28}
          aria-valuenow={cycleDay}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: 11, color: C.text2, marginTop: 8, lineHeight: 1.45 }}>
          {cycleDay <= 5
            ? 'Phase menstruelle : repose-toi et hydrate-toi.'
            : cycleDay <= 13
              ? 'Phase folliculaire : énergie en hausse.'
              : cycleDay <= 16
                ? 'Ovulation : bonne fenêtre pour planifier.'
                : 'Phase lutéale : ralentir, prioriser le sommeil.'}
        </div>
      </CollapsibleSection>
      <IntimateJournalPanel
        C={C}
        token={token}
        entries={journalEntries}
        loading={journalLoading}
        selectedDay={journalSelectedDay}
        onSelectedDayChange={onJournalSelectedDayChange}
        onRefresh={onJournalRefresh}
        onGoAgenda={onGoAgenda}
      />
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconHeartOutline size={15} color={C.lilac} strokeWidth={1.65} />
          Moments pour toi ({selfDoneCount}/{selfMoments.length})
        </div>
        {selfMoments.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <button
              type="button"
              aria-label={m.done ? 'Marquer non fait' : 'Marquer fait'}
              onClick={() => onToggleSelfMoment(m.id)}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '4px 8px',
                background: m.done ? C.greenL : C.white,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 44,
                minHeight: 44,
              }}
            >
              {m.done ? <IconCheckSmall size={13} color={C.green} /> : <IconCircleOutline size={13} color={C.text3} />}
            </button>
            <span style={{ flex: 1, fontSize: 12, color: m.done ? C.green : C.text }}>{m.label}</span>
            <button
              type="button"
              onClick={() => onAddSelfMomentAsTask(m.label)}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 10px',
                background: C.terraXL,
                color: C.terra,
                fontSize: 11,
                fontWeight: 700,
                minHeight: 44,
              }}
            >
              + Tâche
            </button>
          </div>
        ))}
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconWallet size={15} color={C.text} strokeWidth={1.65} />
            Budget du mois
          </div>
          <button
            type="button"
            onClick={() => {
              if (budgetEditing) void onSaveBudget();
              onBudgetEditingToggle();
            }}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '6px 10px',
              background: C.white,
              fontSize: 11,
              fontWeight: 700,
              color: C.terra,
              cursor: 'pointer',
            }}
          >
            {budgetEditing ? 'Enregistrer' : 'Modifier'}
          </button>
        </div>
        {budget.map((b) => {
          const pct = b.budget > 0 ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0;
          const barColor = pct > 80 ? C.red : pct > 50 ? C.sun : C.green;
          return (
            <div key={b.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{b.label}</span>
                <span style={{ color: C.text2 }}>
                  {b.spent}€ / {b.budget}€
                </span>
              </div>
              {budgetEditing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <label style={{ fontSize: 10, color: C.text2 }}>
                    Dépensé
                    <input
                      type="number"
                      aria-label={`Montant dépensé pour ${b.label}`}
                      value={b.spent}
                      onChange={(e) =>
                        onBudgetChange((prev) =>
                          prev.map((x) => (x.id === b.id ? { ...x, spent: Number(e.target.value || 0) } : x)),
                        )
                      }
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        padding: 6,
                        marginTop: 2,
                      }}
                    />
                  </label>
                  <label style={{ fontSize: 10, color: C.text2 }}>
                    Budget
                    <input
                      type="number"
                      aria-label={`Budget prévu pour ${b.label}`}
                      value={b.budget}
                      onChange={(e) =>
                        onBudgetChange((prev) =>
                          prev.map((x) => (x.id === b.id ? { ...x, budget: Number(e.target.value || 0) } : x)),
                        )
                      }
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        padding: 6,
                        marginTop: 2,
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div style={{ height: 8, background: C.surface3, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 8 }} />
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>
          Total : {budget.reduce((s, b) => s + b.spent, 0)}€ / {budget.reduce((s, b) => s + b.budget, 0)}€
        </div>
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconChart size={15} color={C.text} strokeWidth={1.65} />
          Stats bien-être hebdo
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>
            Humeur moyenne: {moodOptions[moiMood]?.emoji ?? '😐'}
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>
            Sommeil moyen: {sleep.toFixed(1)}h
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>
            Moments faits: {selfDoneCount}
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>Cycle: J{cycleDay}</div>
        </div>
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Suggestion {aiName}</div>
        <div style={{ fontSize: 12, color: C.text2 }}>
          Tu as {openTaskCount} tache(s) ouverte(s). Prends 20 min pour toi avant 20h, puis je te relance.
        </div>
      </GlassCard>
    </div>
  );
}
