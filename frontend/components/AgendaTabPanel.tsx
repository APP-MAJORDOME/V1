'use client';

import { AgendaJournalSection } from './IntimateJournalPanel';
import { IconAlertOutline, IconCheckSmall, IconMeal } from './md-icons';
import type { JournalEntry } from '../lib/journalEntries';
import { RecentDoneTasksCard, TaskAssignSelect, TaskDoneButton, type TaskUiItem, type TaskUiMember } from './taskUi';
import type { MealPlan } from '../lib/meals';
import { useIsClient } from '../hooks/useIsClient';
import { formatDateTimeFr } from '../lib/formatClientDate';

function GlassCard({
  C,
  children,
  style = {},
}: {
  C: Record<string, string>;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: '3px 8px' }}>
      {children}
    </span>
  );
}

type AgendaEvent = { id: number; title: string; starts_at: string };
type ConnectedAccount = { provider: string; status: string };

export function AgendaTabPanel({
  C,
  token,
  accounts,
  appleCaldavAvailable,
  newEventTitle,
  onNewEventTitleChange,
  newEventStart,
  onNewEventStartChange,
  newEventEnd,
  onNewEventEndChange,
  newEventProvider,
  onNewEventProviderChange,
  creatingEvent,
  onCreateEvent,
  selectedMealDay,
  onSelectedMealDayChange,
  selectedMeal,
  onMealLunchChange,
  onMealDinnerChange,
  onMealMissingChange,
  onGenerateCoursesFromMeal,
  agendaOpenTasks,
  taskSummary,
  familyNames,
  primaryMemberId,
  partnerMemberId,
  childMemberId,
  householdMembers,
  taskAssignBusyId,
  taskCompleteBusyId,
  onAssignTask,
  onCompleteTask,
  sortedDoneTasks,
  taskReopenBusyId,
  onReopenTask,
  onRefreshDoneFromServer,
  doneHistoryRefreshBusy,
  onLoadMoreDonePage,
  doneHistoryMoreBusy,
  doneHistoryPagingExhausted,
  urgentCount,
  nextEvents,
  editingEventId,
  editTitle,
  onEditTitleChange,
  editStart,
  onEditStartChange,
  editEnd,
  onEditEndChange,
  onBeginEditEvent,
  onDeleteEvent,
  onSaveEditEvent,
  onCancelEditEvent,
  journalEntries,
  journalLoading,
  onOpenMoiJournal,
}: {
  C: Record<string, string>;
  token: string;
  accounts: ConnectedAccount[];
  appleCaldavAvailable: boolean | null;
  newEventTitle: string;
  onNewEventTitleChange: (v: string) => void;
  newEventStart: string;
  onNewEventStartChange: (v: string) => void;
  newEventEnd: string;
  onNewEventEndChange: (v: string) => void;
  newEventProvider: 'none' | 'google_calendar' | 'microsoft_calendar' | 'apple_calendar';
  onNewEventProviderChange: (v: 'none' | 'google_calendar' | 'microsoft_calendar' | 'apple_calendar') => void;
  creatingEvent: boolean;
  onCreateEvent: () => void | Promise<void>;
  selectedMealDay: string;
  onSelectedMealDayChange: (v: string) => void;
  selectedMeal: MealPlan;
  onMealLunchChange: (v: string) => void;
  onMealDinnerChange: (v: string) => void;
  onMealMissingChange: (v: string) => void;
  onGenerateCoursesFromMeal: () => void;
  agendaOpenTasks: TaskUiItem[];
  taskSummary: { open_count: number; done_count: number } | null;
  familyNames: { prenom: string; partenaire: string; enfant: string };
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  householdMembers: TaskUiMember[];
  taskAssignBusyId: number | null;
  taskCompleteBusyId: number | null;
  onAssignTask: (taskId: number, next: number | null) => void | Promise<void>;
  onCompleteTask: (taskId: number) => void | Promise<void>;
  sortedDoneTasks: TaskUiItem[];
  taskReopenBusyId: number | null;
  onReopenTask: (taskId: number) => void;
  onRefreshDoneFromServer: () => void;
  doneHistoryRefreshBusy: boolean;
  onLoadMoreDonePage: () => void;
  doneHistoryMoreBusy: boolean;
  doneHistoryPagingExhausted: boolean;
  urgentCount: number;
  nextEvents: AgendaEvent[];
  editingEventId: number | null;
  editTitle: string;
  onEditTitleChange: (v: string) => void;
  editStart: string;
  onEditStartChange: (v: string) => void;
  editEnd: string;
  onEditEndChange: (v: string) => void;
  onBeginEditEvent: (event: AgendaEvent) => void;
  onDeleteEvent: (eventId: number) => void;
  onSaveEditEvent: () => void | Promise<void>;
  onCancelEditEvent: () => void;
  journalEntries: JournalEntry[];
  journalLoading: boolean;
  onOpenMoiJournal: () => void;
}) {
  const client = useIsClient();
  const googleConnected = accounts.some((a) => a.provider === 'google_calendar' && a.status === 'connected');
  const microsoftConnected = accounts.some((a) => a.provider === 'microsoft_calendar' && a.status === 'connected');
  const appleConnected = accounts.some((a) => a.provider === 'apple_calendar' && a.status === 'connected');
  const appleSyncPossible = appleConnected && appleCaldavAvailable !== false;

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
      <h2 style={{ margin: '0 0 10px', color: C.text }}>Agenda familial</h2>
      <AgendaJournalSection
        C={C}
        selectedDay={selectedMealDay}
        entries={journalEntries}
        loading={journalLoading}
        onOpenMoi={onOpenMoiJournal}
      />
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Ajouter depuis l application</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
            Titre
            <input
              id="event-title"
              value={newEventTitle}
              onChange={(e) => onNewEventTitleChange(e.target.value)}
              placeholder="Ex. RDV pédiatre"
              aria-label="Titre de l'événement"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
            Début
            <input
              id="event-start"
              value={newEventStart}
              onChange={(e) => onNewEventStartChange(e.target.value)}
              type="datetime-local"
              aria-label="Date et heure de début"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
            Fin
            <input
              id="event-end"
              value={newEventEnd}
              onChange={(e) => onNewEventEndChange(e.target.value)}
              type="datetime-local"
              aria-label="Date et heure de fin"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            />
          </label>
          {appleConnected && appleCaldavAvailable === false ? (
            <div
              style={{
                fontSize: 11,
                color: C.sun,
                lineHeight: 1.4,
                padding: '6px 8px',
                borderRadius: 10,
                background: '#FFF8E6',
                border: `1px solid ${C.border}`,
              }}
            >
              Apple : synchronisation indisponible sur ce serveur — événements seulement dans l’app (voir Paramètres →
              Connexions).
            </div>
          ) : null}
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
            Synchroniser avec
            <select
              id="event-provider"
              value={newEventProvider}
              onChange={(e) =>
                onNewEventProviderChange(
                  e.target.value as 'none' | 'google_calendar' | 'microsoft_calendar' | 'apple_calendar',
                )
              }
              aria-label="Calendrier de synchronisation"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            >
              <option value="microsoft_calendar" disabled={!microsoftConnected}>
                Outlook / Microsoft 365
              </option>
              <option value="google_calendar" disabled={!googleConnected}>
                Google Calendar
              </option>
              <option value="apple_calendar" disabled={!appleSyncPossible}>
                Apple Calendar
              </option>
              <option value="none">Application seulement</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void onCreateEvent()}
            disabled={creatingEvent}
            style={{ borderRadius: 10, border: 'none', background: C.terra, color: '#fff', padding: 8, fontWeight: 700 }}
          >
            {creatingEvent ? 'Creation...' : 'Creer evenement'}
          </button>
        </div>
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: C.sageL }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconMeal size={16} color={C.sage} strokeWidth={1.65} />
          Plan repas (jour)
        </div>
        <input
          type="date"
          value={selectedMealDay}
          onChange={(e) => onSelectedMealDayChange(e.target.value)}
          aria-label="Jour affiché (repas et journal)"
          style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 6 }}
        />
        <input
          placeholder="Repas midi"
          value={selectedMeal.lunch}
          onChange={(e) => onMealLunchChange(e.target.value)}
          aria-label="Repas du midi"
          style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 6 }}
        />
        <input
          placeholder="Repas soir"
          value={selectedMeal.dinner}
          onChange={(e) => onMealDinnerChange(e.target.value)}
          aria-label="Repas du soir"
          style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 6 }}
        />
        <input
          placeholder="Ingredients manquants (virgules)"
          value={selectedMeal.missing.join(', ')}
          onChange={(e) => onMealMissingChange(e.target.value)}
          aria-label="Ingrédients manquants"
          style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 8 }}
        />
        <button
          type="button"
          onClick={onGenerateCoursesFromMeal}
          style={{
            borderRadius: 10,
            border: 'none',
            background: C.sage,
            color: '#fff',
            padding: 8,
            fontWeight: 700,
            width: '100%',
          }}
        >
          Generer courses depuis repas
        </button>
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: C.terraXL }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: C.terra, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconCheckSmall size={15} color={C.terra} strokeWidth={2} />
          Tâches ouvertes
        </div>
        <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
          Tri par échéance — assigner ou marquer fait sans passer par l’accueil.
        </p>
        {taskSummary != null ? (
          <p style={{ fontSize: 10, color: C.text3, margin: '-4px 0 8px', lineHeight: 1.4 }}>
            Dans l’app : {agendaOpenTasks.length} ouverte(s) · Sur le foyer (serveur) : {taskSummary.open_count}
          </p>
        ) : null}
        {agendaOpenTasks.length === 0 ? (
          <div style={{ fontSize: 12, color: C.text2 }}>Rien en attente.</div>
        ) : (
          agendaOpenTasks.slice(0, 14).map((t) => (
            <div key={t.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <span>{t.title}</span>
                {primaryMemberId != null && t.assigned_member_id === primaryMemberId ? (
                  <Pill bg={C.terraXL} color={C.terra}>
                    → {familyNames.prenom}
                  </Pill>
                ) : null}
                {partnerMemberId != null && t.assigned_member_id === partnerMemberId ? (
                  <Pill bg={C.alexXL} color={C.alex}>
                    → {familyNames.partenaire}
                  </Pill>
                ) : null}
                {childMemberId != null && t.assigned_member_id === childMemberId ? (
                  <Pill bg="#FFF8E8" color="#B8860B">
                    → {familyNames.enfant}
                  </Pill>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }} suppressHydrationWarning>
                {t.due_at ? formatDateTimeFr(t.due_at, client) : 'Sans échéance'}
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <TaskAssignSelect
                  C={C}
                  taskId={t.id}
                  assigned_member_id={t.assigned_member_id}
                  members={householdMembers}
                  token={token}
                  busy={taskAssignBusyId === t.id}
                  onAssign={onAssignTask}
                  compact
                />
                <TaskDoneButton
                  C={C}
                  taskId={t.id}
                  token={token}
                  busyDone={taskCompleteBusyId === t.id}
                  onDone={onCompleteTask}
                />
              </div>
            </div>
          ))
        )}
      </GlassCard>
      <RecentDoneTasksCard
        C={C}
        sortedDone={sortedDoneTasks}
        token={token}
        reopenBusyId={taskReopenBusyId}
        onReopen={onReopenTask}
        compact
        onRefreshDoneFromServer={onRefreshDoneFromServer}
        refreshDoneBusy={doneHistoryRefreshBusy}
        onLoadMoreDonePage={onLoadMoreDonePage}
        loadMoreDoneBusy={doneHistoryMoreBusy}
        donePagingExhausted={doneHistoryPagingExhausted}
        serverDoneTotal={taskSummary?.done_count ?? null}
      />
      {urgentCount > 0 ? (
        <div
          style={{
            background: C.redL,
            padding: 10,
            borderRadius: 12,
            color: C.red,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconAlertOutline size={18} color={C.red} strokeWidth={1.65} />
          {urgentCount} conflit(s) detecte(s)
        </div>
      ) : null}
      {nextEvents.map((e) => (
        <GlassCard C={C} key={e.id} style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.title}</div>
          <div style={{ fontSize: 11, color: C.text2 }} suppressHydrationWarning>{formatDateTimeFr(e.starts_at, client)}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => onBeginEditEvent(e)}
              style={{
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: '#fff',
                color: C.text2,
                fontSize: 11,
                padding: '4px 8px',
              }}
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => void onDeleteEvent(e.id)}
              style={{
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: '#fff',
                color: C.text2,
                fontSize: 11,
                padding: '4px 8px',
              }}
            >
              Annuler
            </button>
          </div>
        </GlassCard>
      ))}
      {editingEventId !== null ? (
        <GlassCard C={C} style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Modifier l evenement</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <input
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              placeholder="Titre evenement"
              aria-label="Titre de l'événement à modifier"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            />
            <input
              value={editStart}
              onChange={(e) => onEditStartChange(e.target.value)}
              type="datetime-local"
              aria-label="Nouvelle date et heure de début"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            />
            <input
              value={editEnd}
              onChange={(e) => onEditEndChange(e.target.value)}
              type="datetime-local"
              aria-label="Nouvelle date et heure de fin"
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => void onSaveEditEvent()}
                style={{ borderRadius: 10, border: 'none', background: C.terra, color: '#fff', padding: 8, fontWeight: 700 }}
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={onCancelEditEvent}
                style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, padding: 8 }}
              >
                Annuler
              </button>
            </div>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
