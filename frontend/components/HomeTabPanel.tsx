'use client';

import Link from 'next/link';
import { TodayHome, type TodayUrgency } from './TodayHome';
import { PLUS_HUB_ITEMS, type HubKey } from './PlusHub';
import {
  IconBellRing,
  IconBrainOutline,
  IconCalendar,
  IconCheckSmall,
  IconChild,
  IconFolderVault,
  IconGift,
  IconHeartOutline,
  IconLifebuoy,
  IconRefresh,
  IconScale,
  IconSchoolBag,
  IconSparkleSmall,
  IconTarget,
  IconUserOutline,
  IconWallet,
  IconHealthCross,
} from './md-icons';
import { RecentDoneTasksCard, TaskAssignSelect, TaskDoneButton, type TaskUiItem, type TaskUiMember } from './taskUi';
import type { BudgetItem } from '../lib/budget';
import type { HomeSectionId } from '../lib/homeLayout';
import type { MentalWeather } from '../lib/mentalLoad';
import type { EquityShare } from '../lib/selectors';
import { useIsClient } from '../hooks/useIsClient';
import { formatDateFr, formatDateTimeFr } from '../lib/formatClientDate';

function GlassCard({
  C,
  children,
  style = {},
  onClick,
}: {
  C: Record<string, string>;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: '3px 8px' }}>{children}</span>;
}

export function HomeTabPanel({
  C,
  token,
  aiName,
  isSectionVisible,
  clientTodayLabel,
  family,
  mentalWeather,
  todayUrgencies,
  nextEventsCount,
  openTasks,
  tasksCount,
  taskSummary,
  taskSummaryRefreshing,
  fridgeAlertsCount,
  hubShortcuts,
  hubModuleBadges,
  showDebordeeCta,
  showMorningMoodCard,
  homeMood,
  budget,
  budgetUsedPct,
  equity,
  partnerContactDraft,
  partnerNotifyLoading,
  weekEvents,
  opps,
  sortedDoneTasks,
  taskAssignBusyId,
  taskCompleteBusyId,
  taskReopenBusyId,
  doneHistoryRefreshBusy,
  doneHistoryMoreBusy,
  doneHistoryPagingExhausted,
  docVaultCount,
  primaryMemberId,
  partnerMemberId,
  childMemberId,
  householdMembers,
  onOpenHub,
  onOpenAgenda,
  onOpenTasksHome,
  onOpenAlfred,
  onPersonalizeLayout,
  onDebordee,
  onMorningMood,
  onHomeMoodSelect,
  onRefreshTaskSummary,
  onPartnerContactChange,
  onNotifyPartner,
  onOpenEquiteModal,
  onOpenAlexModal,
  onAlfredDelegatePrompt,
  onGoMoi,
  onOpenDocuments,
  onOpenAssistant,
  onAssignTask,
  onCompleteTask,
  onReopenTask,
  onRefreshDoneFromServer,
  onLoadMoreDonePage,
}: {
  C: Record<string, string>;
  token: string;
  aiName: string;
  isSectionVisible: (id: HomeSectionId) => boolean;
  clientTodayLabel: string;
  family: { prenom: string; partenaire: string; enfant: string };
  mentalWeather: MentalWeather;
  todayUrgencies: TodayUrgency[];
  nextEventsCount: number;
  openTasks: TaskUiItem[];
  tasksCount: number;
  taskSummary: { open_count: number; done_count: number } | null;
  taskSummaryRefreshing: boolean;
  fridgeAlertsCount: number;
  hubShortcuts: HubKey[];
  hubModuleBadges: Partial<Record<HubKey, string>>;
  showDebordeeCta: boolean;
  showMorningMoodCard: boolean;
  homeMood: number | null;
  budget: BudgetItem[];
  budgetUsedPct: number;
  equity: EquityShare[];
  partnerContactDraft: string;
  partnerNotifyLoading: boolean;
  weekEvents: { id: number; title: string; starts_at: string }[];
  opps: { id: number; title: string; score: number }[];
  sortedDoneTasks: TaskUiItem[];
  taskAssignBusyId: number | null;
  taskCompleteBusyId: number | null;
  taskReopenBusyId: number | null;
  doneHistoryRefreshBusy: boolean;
  doneHistoryMoreBusy: boolean;
  doneHistoryPagingExhausted: boolean;
  docVaultCount: number;
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  householdMembers: TaskUiMember[];
  onOpenHub: (hub: HubKey) => void;
  onOpenAgenda: () => void;
  onOpenTasksHome: () => void;
  onOpenAlfred: () => void;
  onPersonalizeLayout: () => void;
  onDebordee: () => void;
  onMorningMood: (index: number) => void;
  onHomeMoodSelect: (index: number) => void;
  onRefreshTaskSummary: () => void;
  onPartnerContactChange: (v: string) => void;
  onNotifyPartner: () => void;
  onOpenEquiteModal: () => void;
  onOpenAlexModal: () => void;
  onAlfredDelegatePrompt: () => void;
  onGoMoi: () => void;
  onOpenDocuments: () => void;
  onOpenAssistant: () => void;
  onAssignTask: (taskId: number, next: number | null) => void | Promise<void>;
  onCompleteTask: (taskId: number) => void | Promise<void>;
  onReopenTask: (taskId: number) => void;
  onRefreshDoneFromServer: () => void;
  onLoadMoreDonePage: () => void;
}) {
  const client = useIsClient();
  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', minHeight: 0, touchAction: 'pan-y' }}>
      {isSectionVisible('hero_banner') ? (
        <TodayHome
          C={C}
          clientTodayLabel={clientTodayLabel}
          firstName={family.prenom}
          weather={mentalWeather}
          urgencies={todayUrgencies}
          eventsToday={nextEventsCount}
          openTasksCount={openTasks.length}
          remindersCount={fridgeAlertsCount}
          hubShortcuts={hubShortcuts}
          moduleBadges={hubModuleBadges}
          onOpenHub={onOpenHub}
          onOpenAgenda={onOpenAgenda}
          onOpenTasks={onOpenTasksHome}
          onOpenAlfred={onOpenAlfred}
          onPersonalize={onPersonalizeLayout}
          showPersonalize={Boolean(token)}
          showDebordee={isSectionVisible('debordee') && showDebordeeCta}
          onDebordee={onDebordee}
          showMorningMood={isSectionVisible('mood') && showMorningMoodCard}
          morningMood={homeMood}
          onMorningMood={onMorningMood}
          partenaireName={family.partenaire}
        />
      ) : null}
<div style={{ padding: '0 16px 24px' }}>
{isSectionVisible('stats_pair') ? (
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
  <GlassCard C={C} style={{ padding: 12 }}>
    <div style={{ width: 36, height: 36, borderRadius: 12, background: C.terraXL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
      <IconCalendar size={20} color={C.terra} strokeWidth={1.65} />
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.terra }}>{nextEventsCount}</div>
    <div style={{ fontSize: 11 }}>Événements aujourd&apos;hui</div>
  </GlassCard>
  <GlassCard C={C} style={{ padding: 12 }}>
    <div style={{ width: 36, height: 36, borderRadius: 12, background: C.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
      <IconCheckSmall size={22} color={C.green} strokeWidth={2} />
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.sage }}>{openTasks.length}</div>
    <div style={{ fontSize: 11 }}>Tâches ouvertes (app)</div>
    {taskSummary != null ? (
      <div
        style={{
          fontSize: 9,
          color: taskSummary.open_count === openTasks.length ? C.text3 : C.sun,
          marginTop: 5,
          lineHeight: 1.35,
        }}
      >
        Foyer : {taskSummary.open_count} ouverte(s)
        {taskSummary.open_count !== openTasks.length ? ' — recharge si tu vois un décalage.' : ''}
      </div>
    ) : null}
  </GlassCard>
</div>
) : null}
{isSectionVisible('hub_shortcuts_row') && hubShortcuts.length > 0 ? (
  <div style={{ marginBottom: 14 }}>
    <h2 style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.3, margin: '0 0 8px' }}>TES MODULES</h2>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {hubShortcuts.map((hid) => {
        const meta = PLUS_HUB_ITEMS.find((x) => x.id === hid);
        if (!meta) return null;
        const Hi = meta.Icon;
        return (
          <button
            key={hid}
            type="button"
            onClick={() => onOpenHub(hid)}
            style={{
              textAlign: 'left',
              padding: 12,
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: C.terraXL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              <Hi size={18} color={C.terra} strokeWidth={1.65} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{meta.label}</div>
            <div style={{ fontSize: 10, color: C.text2, marginTop: 2, lineHeight: 1.35 }}>{meta.hint}</div>
          </button>
        );
      })}
    </div>
  </div>
) : null}
{isSectionVisible('coffre_strip') ? (
<GlassCard C={C}
  style={{ padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
  onClick={() => onOpenDocuments()}
>
  <div
    style={{
      width: 44,
      height: 44,
      borderRadius: 14,
      background: C.sageL,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      border: `1px solid ${C.sage}44`,
    }}
  >
    <IconFolderVault size={24} color={C.sage} strokeWidth={1.65} />
  </div>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Coffre famille</div>
    <div style={{ fontSize: 11, color: C.text2, marginTop: 3, lineHeight: 1.4 }}>
      Contrats, santé, identité : ouvre le <strong>Coffre</strong> (Plus ou raccourci), sans mélange aux courses.
    </div>
    <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>{docVaultCount} référence(s)</div>
  </div>
  <span style={{ fontSize: 18, fontWeight: 300, color: C.terra, flexShrink: 0 }} aria-hidden>
    ›
  </span>
</GlassCard>
) : null}
{isSectionVisible('equity') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 14 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <IconScale size={16} color={C.text} strokeWidth={1.65} />
      <strong style={{ fontSize: 13 }}>Répartition du foyer</strong>
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 10, color: C.text2 }}>
        {taskSummary != null ? (
          <>
            {taskSummary.open_count} ouv. · {taskSummary.done_count} fait · {tasksCount} chargée(s)
          </>
        ) : (
          <>{tasksCount} tâches</>
        )}
      </span>
      <button
        type="button"
        disabled={!token || taskSummaryRefreshing}
        title="Rafraîchir les compteurs serveur"
        onClick={() => void onRefreshTaskSummary()}
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '4px 8px',
          fontSize: 10,
          fontWeight: 700,
          cursor: !token || taskSummaryRefreshing ? 'not-allowed' : 'pointer',
          background: C.surface,
          color: C.text2,
          opacity: taskSummaryRefreshing ? 0.65 : 1,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {taskSummaryRefreshing ? (
            '…'
          ) : (
            <>
              <IconRefresh size={12} color={C.text2} strokeWidth={1.8} />
              Compteurs
            </>
          )}
        </span>
      </button>
    </span>
  </div>
  <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
    {equity.map((e) => (
      <div key={e.name} style={{ flex: Math.max(e.pct, 1), background: e.color }} />
    ))}
  </div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
    {equity.map((e) => (
      <Pill key={e.name} bg={`${e.color}20`} color={e.color}>
        {e.name} {e.pct}%
      </Pill>
    ))}
  </div>
  <div style={{ fontSize: 11, color: C.text2, marginBottom: 8, lineHeight: 1.45 }}>
    {equity[0].pct > 50
      ? `Alerte déséquilibre : ${family.prenom} porte encore trop la charge.`
      : 'Répartition en progression.'}
    <span style={{ display: 'block', fontSize: 10, color: C.text3, marginTop: 4 }}>
      Calcul : tâches assignées dans l&apos;app (ouvertes comptent double). Ne inclut pas la charge invisible (pense-bête, charge mentale).
    </span>
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
    <input
      type="text"
      value={partnerContactDraft}
      onChange={(e) => onPartnerContactChange(e.target.value)}
      placeholder={`Mobile (+33…) ou e-mail de ${family.partenaire} (optionnel)`}
      aria-label={`Contact de ${family.partenaire}, mobile ou e-mail`}
      autoComplete="tel email"
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: `1.5px solid ${C.border}`,
        fontSize: 12,
        background: C.surface,
      }}
    />
    <div style={{ fontSize: 10, color: C.text3, lineHeight: 1.35 }}>
      Sans contact : la liste est enregistrée dans ton journal. Avec un numéro ou un e-mail renseigné : rappels par SMS ou message quand le service est activé sur ton compte.
    </div>
  </div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <button
      type="button"
      onClick={onOpenEquiteModal}
      style={{ borderRadius: 10, border: 'none', padding: '8px 10px', background: C.terraXL, color: C.terra, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <IconScale size={14} color={C.terra} strokeWidth={1.65} />
      Score équité hebdo
    </button>
    <button
      type="button"
      disabled={partnerNotifyLoading}
      onClick={() => void onNotifyPartner()}
      style={{
        borderRadius: 10,
        border: 'none',
        padding: '8px 10px',
        background: '#1a1a2e',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        opacity: partnerNotifyLoading ? 0.65 : 1,
      }}
    >
      {partnerNotifyLoading ? (
        '…'
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconBellRing size={14} color="#fff" strokeWidth={1.65} />
          Notifier {family.partenaire}
        </span>
      )}
    </button>
    <button
      type="button"
      onClick={onOpenAlexModal}
      style={{ borderRadius: 10, border: 'none', padding: '8px 10px', background: C.alexL, color: C.alex, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <IconUserOutline size={14} color={C.alex} strokeWidth={1.65} />
      Espace {family.partenaire}
    </button>
    <Link
      href="/partner"
      style={{
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        padding: '8px 10px',
        background: C.white,
        color: C.text2,
        fontSize: 11,
        fontWeight: 700,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <IconSparkleSmall size={14} color={C.text2} strokeWidth={1.65} />
      Vue {family.partenaire}
    </Link>
  </div>
  <button
    type="button"
    onClick={onAlfredDelegatePrompt}
    style={{ marginTop: 8, borderRadius: 10, border: 'none', padding: '8px 10px', background: C.terraXL, color: C.terra, fontSize: 11, fontWeight: 700 }}
  >
    Déléguer en 1 tap (WhatsApp)
  </button>
</GlassCard>
) : null}
{isSectionVisible('debordee') && !isSectionVisible('hero_banner') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 14, background: C.redL, border: `1.5px solid ${C.red}55` }}>
  <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
    <IconLifebuoy size={18} color={C.red} strokeWidth={1.65} />
    Mode « Je suis débordée »
  </div>
  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
    Alfred analyse toute ta liste, garde l&apos;urgent pour aujourd&apos;hui, propose du relais vers {family.partenaire}, et allège le reste.
  </p>
  <button
    type="button"
    onClick={onDebordee}
    style={{
      width: '100%',
      border: 'none',
      borderRadius: 12,
      padding: '12px 14px',
      background: C.red,
      color: '#fff',
      fontSize: 13,
      fontWeight: 800,
      cursor: 'pointer',
    }}
  >
    Je suis débordée — triage Alfred
  </button>
</GlassCard>
) : null}
{isSectionVisible('budget') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 14 }} onClick={() => onGoMoi()}>
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center', gap: 8 }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <IconWallet size={16} color={C.text} strokeWidth={1.65} />
      <strong style={{ fontSize: 13 }}>Budget du mois</strong>
    </span>
    <span style={{ fontSize: 11, color: budgetUsedPct > 90 ? C.red : C.sage, fontWeight: 700 }}>{budgetUsedPct}%</span>
  </div>
  {budget.map((b) => (
    <div key={b.id} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>{b.label}</span>
        <span>{b.spent}€ / {b.budget}€</span>
      </div>
      <div style={{ height: 7, borderRadius: 7, background: C.surface2, marginTop: 3 }}>
        <div style={{ width: `${Math.min(100, (b.spent / Math.max(1, b.budget)) * 100)}%`, height: '100%', borderRadius: 7, background: b.color }} />
      </div>
    </div>
  ))}
</GlassCard>
) : null}
{isSectionVisible('mood') && !isSectionVisible('hero_banner') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 14, background: C.lilacL }}>
  <div style={{ fontSize: 11, color: C.text2, marginBottom: 8, fontWeight: 700 }}>COMMENT TU TE SENS CE MATIN ?</div>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    {['😴', '😟', '😐', '🙂', '😄'].map((m, i) => (
      <button key={m} type="button" aria-label={`Humeur ${i + 1} sur 5`} onClick={() => onHomeMoodSelect(i)} style={{ border: 'none', background: homeMood === i ? C.white : 'transparent', borderRadius: 10, padding: '6px 8px' }}>
        {m}
      </button>
    ))}
  </div>
</GlassCard>
) : null}
{isSectionVisible('alfred_teaser') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 14, background: C.terraXL }}>
  <div style={{ fontSize: 11, fontWeight: 700, color: C.terra }}>{aiName.toUpperCase()}</div>
  <p style={{ fontSize: 13, margin: '6px 0', color: C.text }}>Conflits détectés : je peux proposer un plan en 1 clic via le bouton {aiName} (centre) ou depuis Plus.</p>
  <button onClick={() => onOpenAssistant()} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: C.terra, color: '#fff', fontWeight: 700 }}>Ouvrir {aiName}</button>
</GlassCard>
) : null}
{isSectionVisible('agenda_snippet') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18 }} onClick={() => onOpenAgenda()}>
  <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <IconCalendar size={18} color={C.terra} strokeWidth={1.65} />
    Cette semaine
  </strong>
  <div style={{ marginTop: 8, fontSize: 12, color: C.text2 }}>
    {weekEvents.slice(0, 5).map((e) => (
      <div key={e.id} style={{ marginBottom: 6 }} suppressHydrationWarning>{formatDateFr(e.starts_at, client)} · {e.title}</div>
    ))}
  </div>
</GlassCard>
) : null}

{isSectionVisible('tasks_feed') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
    <h2 style={{ fontSize: 14, margin: 0 }}>Tes tâches</h2>
    {taskSummary != null ? (
      <span style={{ fontSize: 10, color: C.text3 }}>
        Ouvertes foyer : {taskSummary.open_count}
      </span>
    ) : null}
  </div>
  <div style={{ marginTop: 8 }}>
    {openTasks.slice(0, 5).map((t) => (
      <div key={t.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span>{t.title}</span>
          {primaryMemberId != null && t.assigned_member_id === primaryMemberId ? (
            <Pill bg={C.terraXL} color={C.terra}>
              → {family.prenom}
            </Pill>
          ) : null}
          {partnerMemberId != null && t.assigned_member_id === partnerMemberId ? (
            <Pill bg={C.alexXL} color={C.alex}>
              → {family.partenaire}
            </Pill>
          ) : null}
          {childMemberId != null && t.assigned_member_id === childMemberId ? (
            <Pill bg="#FFF8E8" color="#B8860B">
              → {family.enfant}
            </Pill>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: C.text2 }} suppressHydrationWarning>{t.due_at ? formatDateTimeFr(t.due_at, client) : 'Sans echeance'}</div>
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
          <TaskDoneButton C={C} taskId={t.id} token={token} busyDone={taskCompleteBusyId === t.id} onDone={onCompleteTask} />
        </div>
      </div>
    ))}
  </div>
</GlassCard>
) : null}

{isSectionVisible('self_care') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18, background: C.lilacL, border: `1.5px solid ${C.lilac}40` }}>
  <div style={{ fontSize: 13, fontWeight: 700, color: C.lilac, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
    <IconHeartOutline size={17} color={C.lilac} strokeWidth={1.65} />
    Et toi, dans tout ça ?
  </div>
  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
    Tu n&apos;as rien planifié pour toi cette semaine. Tu mérites aussi une pause — je peux t&apos;aider à trouver un créneau.
  </p>
  <button
    onClick={() => {
      onGoMoi();
    }}
    style={{
      fontSize: 12,
      fontWeight: 700,
      color: C.lilac,
      background: 'white',
      border: `1.5px solid ${C.lilac}50`,
      borderRadius: 10,
      padding: '8px 14px',
      cursor: 'pointer',
    }}
  >
    Ouvrir mes moments pour moi
  </button>
</GlassCard>
) : null}
{isSectionVisible('priorities') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18 }}>
  <h2 style={{ fontSize: 14, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <IconTarget size={17} color={C.text} strokeWidth={1.65} />
    Priorités du jour
  </h2>
  <div style={{ marginTop: 8 }}>
    {openTasks.slice(0, 4).map((t) => (
      <div key={t.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span>{t.title}</span>
        {primaryMemberId != null && t.assigned_member_id === primaryMemberId ? (
          <Pill bg={C.terraXL} color={C.terra}>
            → {family.prenom}
          </Pill>
        ) : null}
        {partnerMemberId != null && t.assigned_member_id === partnerMemberId ? (
          <Pill bg={C.alexXL} color={C.alex}>
            → {family.partenaire}
          </Pill>
        ) : null}
        {childMemberId != null && t.assigned_member_id === childMemberId ? (
          <Pill bg="#FFF8E8" color="#B8860B">
            → {family.enfant}
          </Pill>
        ) : null}
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
        <TaskDoneButton C={C} taskId={t.id} token={token} busyDone={taskCompleteBusyId === t.id} onDone={onCompleteTask} />
      </div>
    ))}
    {openTasks.length === 0 ? <div style={{ fontSize: 12, color: C.text2 }}>Aucune priorité en attente.</div> : null}
  </div>
</GlassCard>
) : null}
{isSectionVisible('recent_done') ? (
<RecentDoneTasksCard
  C={C}
  sortedDone={sortedDoneTasks}
  token={token}
  reopenBusyId={taskReopenBusyId}
  onReopen={onReopenTask}
  onRefreshDoneFromServer={onRefreshDoneFromServer}
  refreshDoneBusy={doneHistoryRefreshBusy}
  onLoadMoreDonePage={onLoadMoreDonePage}
  loadMoreDoneBusy={doneHistoryMoreBusy}
  donePagingExhausted={doneHistoryPagingExhausted}
  serverDoneTotal={taskSummary?.done_count ?? null}
/>
) : null}
{isSectionVisible('opportunities') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18 }}>
  <h2 style={{ fontSize: 14, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <IconGift size={17} color={C.text} strokeWidth={1.65} />
    Opportunités utiles
  </h2>
  <div style={{ marginTop: 8 }}>
    {opps.slice(0, 3).map((o) => (
      <div key={o.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12 }}>{o.title}</div>
        <div style={{ fontSize: 11, color: C.text2 }}>Score: {Math.round(o.score * 100)}%</div>
      </div>
    ))}
  </div>
</GlassCard>
) : null}
{isSectionVisible('child_tracking') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18 }}>
  <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <IconChild size={17} color={C.text} strokeWidth={1.65} />
    {family.enfant} — Suivi enfant
  </strong>
  <div style={{ marginTop: 8, fontSize: 12, color: C.text2 }}>
    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconHealthCross size={14} color={C.sage} strokeWidth={1.65} />
      Traitement en cours: Doliprane si fièvre
    </div>
    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconCalendar size={14} color={C.terra} strokeWidth={1.65} />
      Prochain RDV: <span suppressHydrationWarning>{weekEvents[0] ? formatDateFr(weekEvents[0].starts_at, client) : 'A planifier'}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconSchoolBag size={14} color={C.sun} strokeWidth={1.65} />
      Devoirs/liaison: vérifier cahier ce soir
    </div>
  </div>
</GlassCard>
) : null}
{isSectionVisible('relief_checklist') ? (
<GlassCard C={C} style={{ padding: 14, marginBottom: 18, background: C.surface2 }}>
  <h2 style={{ fontSize: 14, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <IconBrainOutline size={17} color={C.text} strokeWidth={1.65} />
    Bientôt disponible
  </h2>
  <p style={{ fontSize: 11, color: C.text2, margin: '8px 0 10px', lineHeight: 1.45 }}>
    Ces connexions arrivent prochainement — elles ne sont pas encore actives dans l&apos;app.
  </p>
  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
    <li>École : Pronote / Skolengo</li>
    <li>Santé : prise de rendez-vous Doctolib en un tap</li>
    <li>Partenaire : rappels type WhatsApp</li>
    <li>Maison : commandes vocales Alexa, Google Home, Siri</li>
  </ul>
</GlassCard>
) : null}
      </div>
    </div>
  );
}
