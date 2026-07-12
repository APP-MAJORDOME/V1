'use client';

import { IconHeartOutline } from './md-icons';
import { PlusHub, type HubKey } from './PlusHub';

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
  aiName,
  openTaskCount,
  onLogout,
  userFirstName,
  alfredNoteCount,
  onOpenHubModule,
  onOpenPrivateSpace,
}: {
  C: Record<string, string>;
  token?: string;
  aiName: string;
  openTaskCount: number;
  moiMood?: number;
  onMoiMoodChange?: (index: number) => void;
  sleep?: number;
  onSleepChange?: (hours: number) => void;
  cycleDay?: number;
  onCycleDayChange?: (day: number) => void;
  journalEntries?: unknown[];
  journalLoading?: boolean;
  journalSelectedDay?: string;
  onJournalSelectedDayChange?: (day: string) => void;
  onJournalRefresh?: () => void | Promise<void>;
  onGoAgenda?: () => void;
  selfMoments?: unknown[];
  onToggleSelfMoment?: (id: string) => void;
  selfDoneCount?: number;
  onAddSelfMomentAsTask?: (label: string) => void;
  budget?: unknown[];
  onBudgetChange?: (updater: (prev: unknown[]) => unknown[]) => void;
  budgetEditing?: boolean;
  onBudgetEditingToggle?: () => void;
  onSaveBudget?: () => void | Promise<void>;
  onLogout?: () => void;
  onToast?: (kind: 'success' | 'error' | 'info', text: string) => void;
  userFirstName?: string;
  alfredNoteCount?: number;
  onOpenHubModule: (hub: HubKey) => void;
  onOpenPrivateSpace?: () => void;
}) {
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
        <a href="/settings" style={{ fontSize: 13, fontWeight: 700, color: C.terra, textDecoration: 'none' }}>
          Paramètres et connexions
        </a>
      </GlassCard>

      {onOpenPrivateSpace ? (
        <GlassCard C={C} style={{ padding: 14, marginBottom: 12, background: C.lilacL }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <IconHeartOutline size={18} color={C.lilac} strokeWidth={1.65} />
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Mon espace privé</span>
          </div>
          <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.45 }}>
            Humeur, sommeil, cycle et journal — visible uniquement par toi.
          </p>
          <button
            type="button"
            onClick={onOpenPrivateSpace}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              background: C.terra,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ouvrir mon espace
          </button>
        </GlassCard>
      ) : null}

      <div id="moi-modules-hub" style={{ marginBottom: 16 }}>
        <PlusHub
          C={C}
          embedded
          userFirstName={userFirstName}
          alfredNoteCount={alfredNoteCount}
          onOpen={onOpenHubModule}
        />
      </div>

      <GlassCard C={C} style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Suggestion {aiName}</div>
        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
          Tu as {openTaskCount} tâche{openTaskCount !== 1 ? 's' : ''} ouverte{openTaskCount !== 1 ? 's' : ''}. Prends 20 min pour toi avant 20h, puis je te relance.
        </div>
      </GlassCard>
    </div>
  );
}
