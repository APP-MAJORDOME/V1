'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTH_LOGOUT_EVENT,
  AUTH_TOKEN_EVENT,
  deleteJson,
  downloadAuthed,
  getJson,
  patchJson,
  postFormData,
  postJson,
  putJson,
  saveBlobAsFile,
} from '../lib/api';
import { newToastId, newLocalNumericId } from '../lib/clientId';
import {
  TOAST_DURATION_MS,
  FRIDGE_ALERT_HOURS_AHEAD,
  INITIAL_DONE_TASKS_LIMIT,
  DONE_HISTORY_FETCH_LIMIT,
} from '../lib/constants';
import { BottomTabBar, type AppTabId } from '../components/BottomTabBar';
import { TodayHome, type TodayUrgency } from '../components/TodayHome';
import {
  fridgeExpiryTone,
  isExpired,
  partitionCoupons,
  sortFridgeByExpiry,
} from '../lib/expiry';
import { computeMentalWeather } from '../lib/mentalLoad';
import {
  computeBudgetUsedPct,
  computeDemoEquityShares,
  computeTaskCompletionPct,
  resolveHouseholdMemberId,
  selectDoneTasks,
  selectFridgeAlertsWithinHours,
  selectOpenTasks,
  sortAgendaOpenTasks,
  sortDoneTasksRecent,
} from '../lib/selectors';
import {
  IconHome,
  IconCalendar,
  IconCart,
  IconHouseCare,
  IconSmartHome,
  IconFolderVault,
  IconUserHeart,
  IconSparkleAI,
  IconPaperclip,
  IconSearch,
  IconAlertOutline,
  IconRefresh,
  IconCheckSmall,
  IconCircleOutline,
  IconScale,
  IconBellRing,
  IconUserOutline,
  IconSparkleSmall,
  IconWallet,
  IconCoupon,
  IconMoon,
  IconPenLine,
  IconChart,
  IconMeal,
  IconBrainOutline,
  IconGift,
  IconChild,
  IconHealthCross,
  IconMic,
  IconSpeaker,
  IconCamera,
  IconMail,
  IconSchoolBag,
  IconLeaf,
  IconPeopleOutline,
  IconTarget,
  IconHeartOutline,
  IconLifebuoy,
  IconPartyOutline,
  IconBoltSoft,
  DocGlyphBubble,
  DocGlyphPicker,
  docCategoryLabel,
  DOC_CATEGORY_FILTER_IDS,
  docMatchesCategoryFilter,
  InlineDocGlyph,
  EquityGlyphIcon,
  IconDotsGrid,
} from '../components/md-icons';
import { PlusHub } from '../components/PlusHub';
import { OverlayChrome } from '../components/OverlayChrome';
import { AnniversairesPanel } from '../components/AnniversairesPanel';
import { PoubellesPanel } from '../components/PoubellesPanel';
import { NotifsStubPanel } from '../components/NotifsStubPanel';
import { RecettesPanel } from '../components/RecettesPanel';
import { CourrierPanel } from '../components/CourrierPanel';
import { AlbumsPanel } from '../components/AlbumsPanel';
import { RoutinesPanel } from '../components/RoutinesPanel';
import { CoursesPanel } from '../components/CoursesPanel';
import { AlfredChatPanel } from '../components/AlfredChatPanel';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { AppLoader, MajordomeMark, MajordomeWordmark } from '../components/BrandLogo';
import { LoginAuthScreen } from '../components/LoginAuthScreen';
import {
  executeAgentIntent as runAgentIntent,
  type AgentExecutionResult,
  type AgentInterpretResponse,
} from '../lib/alfredAgent';
import { useAlfredAssistant } from '../hooks/useAlfredAssistant';
import { useAppDocumentTitle } from '../hooks/useAppDocumentTitle';
import {
  clearDoneGroceryItems,
  createGroceryItem,
  deleteGroceryItem,
  fetchGroceryItems,
  mapGroceryToCourse,
  patchGroceryItem,
} from '../lib/grocery';
import {
  createFridgeItem,
  deleteFridgeItem,
  fetchFridgeItems,
  mapFridgeToUi,
} from '../lib/fridge';
import {
  createCoupon,
  createWalletCard,
  fetchCoupons,
  fetchWalletCards,
  mapCouponToUi,
  mapWalletCardToUi,
  type Coupon,
  type WalletCard,
} from '../lib/wallet';
import { GlobalSearchPalette, type SearchPaletteEntry } from '../components/GlobalSearchPalette';
import { FamilleTempsReelPanel } from '../components/FamilleTempsReelPanel';
import { HomeLayoutEditor } from '../components/HomeLayoutEditor';
import { WelcomeSetupWizard } from '../components/WelcomeSetupWizard';
import { PLUS_HUB_ITEMS, type HubKey } from '../components/PlusHub';
import { useAppUiStore } from '../lib/store/appUiStore';
import {
  LAYOUT_USER_EMAIL_KEY,
  loadHomeLayoutForUser,
  mergeHomeLayout,
  saveHomeLayoutForUser,
  type HomeLayoutConfig,
  type HomeSectionId,
} from '../lib/homeLayout';
import {
  buildHomeLayoutFromPostLoginChoices,
  isWelcomeWizardV2Complete,
  markPostLoginPersonalizationComplete,
  markWelcomeWizardV2Complete,
} from '../lib/postLoginPersonalization';

type EventItem = { id: number; title: string; starts_at: string; ends_at?: string; updated_at?: string; source_provider?: string | null };
type TaskItem = {
  id: number;
  title: string;
  status: string;
  due_at?: string | null;
  assigned_member_id?: number | null;
  updated_at?: string;
};

type TaskSummaryApi = { open_count: number; done_count: number };


function mergeTasksById(prev: TaskItem[], incoming: TaskItem[]): TaskItem[] {
  const map = new Map<number, TaskItem>();
  for (const t of prev) {
    map.set(t.id, t);
  }
  for (const t of incoming) {
    const cur = map.get(t.id);
    map.set(t.id, cur ? { ...cur, ...t } : t);
  }
  return Array.from(map.values());
}
type HouseholdMemberRow = { id: number; household_id: number; display_name: string; role: string };
type OpportunityItem = { id: number; title: string; score: number };
type ConflictItem = { event_a: number; event_b: number; title_a: string; title_b: string; severity?: string };
type ConnectedAccount = { id: number; provider: string; status: string };
type LoginResponse = { access_token: string; refresh_token: string };
type DebordeeApiResponse = { critique: string[]; deleguer: string[]; supprimer: string[]; message: string };
type FamilyProfile = { prenom: string; partenaire: string; enfant: string; ageEnfant: string; objectif: string };
type DocVaultItem = {
  id: number;
  icon: string;
  name: string;
  cat: string;
  date: string;
  exp?: string;
  who: string;
  urgent?: boolean;
  notes?: string;
  expiresAtIso?: string | null;
  attachmentOriginalName?: string | null;
  attachmentSizeBytes?: number | null;
};
type DocEditDraft = {
  id: number;
  icon: string;
  name: string;
  category: string;
  date_label: string;
  who: string;
  notes: string;
  expires_date: string;
};
type HouseholdDocumentApi = {
  id: number;
  household_id: number;
  icon: string;
  name: string;
  category: string;
  date_label: string | null;
  expires_at: string | null;
  who: string | null;
  urgent: boolean;
  notes: string | null;
  attachment_original_name: string | null;
  attachment_mime: string | null;
  attachment_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

function mapDocFromApi(d: HouseholdDocumentApi): DocVaultItem {
  return {
    id: d.id,
    icon: d.icon,
    name: d.name,
    cat: d.category,
    date: d.date_label || '—',
    exp: d.expires_at ? new Date(d.expires_at).toLocaleDateString('fr-FR') : undefined,
    who: d.who || 'Famille',
    urgent: d.urgent,
    notes: d.notes ?? '',
    expiresAtIso: d.expires_at,
    attachmentOriginalName: d.attachment_original_name,
    attachmentSizeBytes: d.attachment_size_bytes,
  };
}

/** Valeurs historiques API / imports ; l’affichage utilise `docCategoryLabel`. */
const DOC_COFFRE_CATEGORIES = ['🏥 Santé', '📚 École', '🏛️ Admin', '💰 Finance', '🏠 Maison', '🛂 Identité', 'Divers'] as const;

/** Filtres UI (sans emoji) → libellés encore présents en base pour POST/PATCH. */
const DOC_FILTER_TO_API_CAT: Record<string, string> = {
  Santé: '🏥 Santé',
  École: '📚 École',
  Admin: '🏛️ Admin',
  Finance: '💰 Finance',
  Maison: '🏠 Maison',
  Identité: '🛂 Identité',
  Divers: 'Divers',
};

function docCategoryForApi(filterId: string): string {
  if (filterId === 'Tous') return 'Divers';
  return DOC_FILTER_TO_API_CAT[filterId] ?? filterId;
}

function formatDocStorageShort(usedBytes: number, quotaBytes: number | null): string {
  const fmt = (b: number) =>
    b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`;
  if (quotaBytes == null) return `Pièces jointes : ${fmt(usedBytes)} (sans quota global)`;
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  return `Stockage PJ : ${fmt(usedBytes)} / ${fmt(quotaBytes)} (${pct} %)`;
}
type BudgetItem = { id: string; label: string; spent: number; budget: number; color: string };
type MealPlan = { lunch: string; dinner: string; missing: string[] };
type FridgeItem = { id: number; label: string; expires_at: string; qty: number };
type UiToast = { id: string; kind: 'success' | 'error' | 'info'; text: string };

const C = {
  bg: '#FEF9F5',
  white: '#FFFFFF',
  surface: '#FFF5F0',
  surface2: '#F5EDE8',
  surface3: '#EDE3DE',
  terra: '#D96B52',
  terraL: '#F0896E',
  terraXL: '#FDEAE5',
  sage: '#6BA898',
  sageL: '#EAF4F1',
  blush: '#F2A98F',
  lilac: '#B49BD1',
  lilacL: '#F0EBFA',
  sun: '#F5B942',
  text: '#2C1F1A',
  text2: '#9A8882',
  text3: '#C8BAB5',
  border: '#EDE3DE',
  green: '#5BAA8A',
  greenL: '#E8F6EF',
  red: '#E05C5C',
  redL: '#FDEAEA',
  alex: '#4A72B8',
  alexL: '#E8EEFB',
  alexXL: '#EEF3FE',
  mint: '#3DAF88',
};

type MainTab = 'home' | 'alfred' | 'modules' | 'moi' | 'agenda';
type OverlayId =
  | 'plus'
  | 'courses'
  | 'maison'
  | 'documents'
  | 'assistant'
  | 'famille'
  | 'anniversaires'
  | 'poubelles'
  | 'notifs'
  | 'messages'
  | 'recettes'
  | 'routines'
  | 'courrier'
  | 'albums'
  | 'integrations';

function GlassCard({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}>{children}</div>;
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: '3px 8px' }}>{children}</span>;
}

function TaskAssignSelect({
  taskId,
  assigned_member_id,
  members,
  token,
  busy,
  onAssign,
  compact,
}: {
  taskId: number;
  assigned_member_id?: number | null;
  members: HouseholdMemberRow[];
  token: string;
  busy: boolean;
  onAssign: (taskId: number, next: number | null) => void | Promise<void>;
  compact?: boolean;
}) {
  if (!token || members.length === 0 || taskId <= 0) return null;
  const v = assigned_member_id == null ? '' : String(assigned_member_id);
  const sorted = [...members].sort((a, b) => a.display_name.localeCompare(b.display_name, 'fr'));
  return (
    <select
      aria-label="Assigner la tâche"
      title="Qui porte cette tâche ?"
      value={v}
      disabled={busy}
      onChange={(e) => {
        const raw = e.target.value;
        void onAssign(taskId, raw === '' ? null : Number(raw));
      }}
      style={{
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color: C.text2,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: compact ? '3px 6px' : '4px 8px',
        background: C.surface,
        maxWidth: compact ? 118 : 168,
      }}
    >
      <option value="">Foyer</option>
      {sorted.map((m) => (
        <option key={m.id} value={m.id}>
          {m.display_name}
        </option>
      ))}
    </select>
  );
}

function TaskDoneButton({
  taskId,
  token,
  busyDone,
  onDone,
}: {
  taskId: number;
  token: string;
  busyDone: boolean;
  onDone: (taskId: number) => void | Promise<void>;
}) {
  if (!token || taskId <= 0) return null;
  return (
    <button
      type="button"
      disabled={busyDone}
      onClick={() => void onDone(taskId)}
      style={{
        fontSize: 10,
        fontWeight: 800,
        borderRadius: 8,
        border: `1px solid ${C.green}`,
        background: C.greenL,
        color: C.green,
        padding: '4px 10px',
        cursor: busyDone ? 'wait' : 'pointer',
        flexShrink: 0,
      }}
    >
      {busyDone ? '…' : 'Fait'}
    </button>
  );
}

function RecentDoneTasksCard({
  sortedDone,
  token,
  reopenBusyId,
  onReopen,
  compact,
  previewFirst = 8,
  onRefreshDoneFromServer,
  refreshDoneBusy,
  onLoadMoreDonePage,
  loadMoreDoneBusy,
  donePagingExhausted,
  serverDoneTotal,
}: {
  sortedDone: TaskItem[];
  token: string;
  reopenBusyId: number | null;
  onReopen: (taskId: number) => void;
  compact?: boolean;
  previewFirst?: number;
  onRefreshDoneFromServer?: () => void;
  refreshDoneBusy?: boolean;
  onLoadMoreDonePage?: () => void;
  loadMoreDoneBusy?: boolean;
  donePagingExhausted?: boolean;
  serverDoneTotal?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const pad = compact ? 12 : 14;
  const mb = compact ? 10 : 18;
  const titleFs = compact ? 12 : 14;
  const visible = expanded ? sortedDone : sortedDone.slice(0, previewFirst);
  const hasMore = sortedDone.length > previewFirst;

  return (
    <GlassCard style={{ padding: pad, marginBottom: mb, background: C.greenL, border: `1.5px solid ${C.green}33` }}>
      <strong style={{ fontSize: titleFs, color: C.green, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconCheckSmall size={15} color={C.green} strokeWidth={2} />
        Récemment terminées
      </strong>
      <p style={{ fontSize: 11, color: C.text2, margin: '6px 0 8px', lineHeight: 1.45 }}>
        {compact
          ? 'Rouvre une tâche si la coche était trop rapide.'
          : 'Les dernières coches — tu peux rouvrir une tâche si c’était une erreur.'}
      </p>
      {onRefreshDoneFromServer ? (
        <p style={{ fontSize: 10, color: C.text3, margin: '-2px 0 8px', lineHeight: 1.4 }}>
          {compact
            ? `Astuce : « Page suivante » puis fusion rapide — deux boutons ci-dessous.`
            : `Au lancement : jusqu’à ${INITIAL_DONE_TASKS_LIMIT} terminées récentes. « Page suivante » enchaîne par paquets ; « Fusion rapide » recharge les ${DONE_HISTORY_FETCH_LIMIT} premières depuis le début.`}
        </p>
      ) : null}
      {typeof serverDoneTotal === 'number' ? (
        <div style={{ fontSize: 10, color: C.text2, margin: '-4px 0 10px', lineHeight: 1.45 }}>
          <strong>Foyer</strong> : {serverDoneTotal} terminée(s) au total · {sortedDone.length} chargée(s) dans l’app
          {serverDoneTotal > sortedDone.length
            ? ' — poursuis avec « Page suivante » ou « Fusion rapide ».'
            : ' — tout est chargé côté terminées.'}
        </div>
      ) : null}
      {sortedDone.length === 0 ? (
        <div style={{ fontSize: 12, color: C.text2 }}>Aucune tâche terminée pour l’instant.</div>
      ) : (
        <>
          {visible.map((t) => (
            <div key={t.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.text3, textDecoration: 'line-through' }}>{t.title}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>
                {t.updated_at ? `Terminée le ${new Date(t.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Terminée'}
              </div>
              <button
                type="button"
                disabled={reopenBusyId === t.id || !token}
                onClick={() => void onReopen(t.id)}
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: `1px solid ${C.text3}`,
                  background: C.white,
                  color: C.text2,
                  padding: '4px 10px',
                  cursor: reopenBusyId === t.id ? 'wait' : 'pointer',
                }}
              >
                {reopenBusyId === t.id ? '…' : 'Rouvrir'}
              </button>
            </div>
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                background: 'transparent',
                color: C.green,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? 'Réduire' : `Voir plus (${sortedDone.length - previewFirst} autres)`}
            </button>
          ) : null}
        </>
      )}
      {token && onLoadMoreDonePage && !donePagingExhausted ? (
        <button
          type="button"
          disabled={Boolean(loadMoreDoneBusy || refreshDoneBusy)}
          onClick={() => void onLoadMoreDonePage()}
          style={{
            marginTop: sortedDone.length === 0 ? 8 : 10,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px solid ${C.sage}`,
            background: C.sageL,
            color: C.sage,
            padding: '6px 10px',
            cursor: loadMoreDoneBusy || refreshDoneBusy ? 'wait' : 'pointer',
            width: '100%',
          }}
        >
          {loadMoreDoneBusy ? 'Chargement…' : `Page suivante (+${INITIAL_DONE_TASKS_LIMIT} terminées)`}
        </button>
      ) : null}
      {token && onRefreshDoneFromServer ? (
        <button
          type="button"
          disabled={refreshDoneBusy || Boolean(loadMoreDoneBusy)}
          onClick={() => void onRefreshDoneFromServer()}
          style={{
            marginTop: sortedDone.length === 0 && !(onLoadMoreDonePage && !donePagingExhausted) ? 8 : 10,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px dashed ${C.green}`,
            background: C.white,
            color: C.green,
            padding: '6px 10px',
            cursor: refreshDoneBusy || loadMoreDoneBusy ? 'wait' : 'pointer',
            width: '100%',
          }}
        >
          {refreshDoneBusy ? 'Synchronisation…' : `Fusion rapide : ${DONE_HISTORY_FETCH_LIMIT} terminées depuis le début`}
        </button>
      ) : null}
    </GlassCard>
  );
}

function AppBrandMark({ height = 24 }: { height?: number }) {
  return <MajordomeMark size={Math.round(height * 2.2)} />;
}

function StatusBar({ onOpenSearch }: { onOpenSearch?: () => void }) {
  /** null jusqu’au montage client — évite décalage SSR/heure locale (hydratation #425). */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const hh = now ? now.getHours().toString().padStart(2, '0') : '–';
  const mm = now ? now.getMinutes().toString().padStart(2, '0') : '–';
  const ink = C.text;
  const dim = C.text3;
  /** La pastille « encoche » décorative est centrée en haut : ne pas mettre la recherche au centre (elle passerait dessous). */
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        paddingBottom: 0,
        color: ink,
        background: C.bg,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 22 }}>
        <span style={{ fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{hh}:{mm}</span>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexShrink: 0 }} aria-hidden>
          <svg width={17} height={11} viewBox="0 0 17 11" fill="none">
            <rect x={1} y={7} width={3} height={4} rx={1} fill={dim} />
            <rect x={6} y={5} width={3} height={6} rx={1} fill={dim} />
            <rect x={11} y={2} width={3} height={9} rx={1} fill={ink} />
          </svg>
          <svg width={16} height={11} viewBox="0 0 16 11" fill="none">
            <path d="M2 8c2.5-4 9.5-4 12 0" stroke={dim} strokeWidth={1.2} strokeLinecap="round" />
            <path d="M4 5c2-2 6-2 8 0" stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
            <circle cx={8} cy={9} r={1} fill={ink} />
          </svg>
          <svg width={22} height={11} viewBox="0 0 22 11" fill="none">
            <rect x={2} y={2} width={18} height={8} rx={2} stroke={dim} strokeWidth={1.2} />
            <rect x={17} y={4} width={4} height={4} rx={1} fill={ink} />
          </svg>
        </span>
      </div>
      {onOpenSearch ? (
        <div style={{ padding: '10px 0 12px' }}>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Recherche globale"
            title="Recherche (⌘K ou Ctrl+K)"
            style={{
              width: '100%',
              minHeight: 44,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '0 14px',
              background: C.white,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
            }}
          >
            <IconSearch size={18} color={C.text2} strokeWidth={1.65} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text2, textAlign: 'left', flex: 1 }}>Rechercher…</span>
          </button>
        </div>
      ) : (
        <div style={{ height: 8 }} />
      )}
    </div>
  );
}

export default function HomePage() {
  const [mainTab, setMainTab] = useState<MainTab>('home');
  const [overlay, setOverlay] = useState<OverlayId | null>(null);
  const globalSearchOpen = useAppUiStore((s) => s.globalSearchOpen);
  const setGlobalSearchOpen = useAppUiStore((s) => s.setGlobalSearchOpen);
  const toggleGlobalSearch = useAppUiStore((s) => s.toggleGlobalSearch);
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [homeLayout, setHomeLayout] = useState<HomeLayoutConfig>(() => mergeHomeLayout(null));
  const [homeLayoutEditorOpen, setHomeLayoutEditorOpen] = useState(false);
  const [layoutUserEmail, setLayoutUserEmail] = useState('');
  const [postLoginSetupResolved, setPostLoginSetupResolved] = useState(false);
  const [postLoginSetupDone, setPostLoginSetupDone] = useState(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMemberRow[]>([]);
  const [opps, setOpps] = useState<OpportunityItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  /** null = pas encore chargé depuis /integrations/capabilities */
  const [appleCaldavAvailable, setAppleCaldavAvailable] = useState<boolean | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventProvider, setNewEventProvider] = useState<'none' | 'google_calendar' | 'apple_calendar'>('google_calendar');
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editExpectedUpdatedAt, setEditExpectedUpdatedAt] = useState('');
  const [homeMood, setHomeMood] = useState<number | null>(null);
  const [courses, setCourses] = useState<Array<{ id: number; label: string; done: boolean; delegated?: boolean }>>([]);
  const [newCourse, setNewCourse] = useState('');
  const [coursesTab, setCoursesTab] = useState<'liste' | 'frigo' | 'wallet'>('liste');
  const [morningDone, setMorningDone] = useState([true, false, false]);
  const [eveningDone, setEveningDone] = useState([false, false, false]);
  const [moiMood, setMoiMood] = useState(3);
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [sleep, setSleep] = useState(7);
  const [budget, setBudget] = useState<BudgetItem[]>([
    { id: 'courses', label: 'Courses', spent: 0, budget: 400, color: C.sage },
    { id: 'loisirs', label: 'Loisirs', spent: 0, budget: 140, color: C.lilac },
    { id: 'enfants', label: 'Enfants', spent: 0, budget: 220, color: C.terra },
  ]);
  /** Vide au premier rendu (SSR = client), puis rempli dans useEffect — évite jour UTC ≠ jour local. */
  const [selectedMealDay, setSelectedMealDay] = useState('');
  /** Libellé date du jour uniquement côté client (évite hydratation #425 dans le hero). */
  const [clientTodayLabel, setClientTodayLabel] = useState('');
  const [mealPlans, setMealPlans] = useState<Record<string, MealPlan>>({});
  const [selfMoments, setSelfMoments] = useState([
    { id: 'm1', label: '20 min de marche sans téléphone', done: false },
    { id: 'm2', label: '10 min respiration / méditation', done: false },
    { id: 'm3', label: 'Lire 15 pages ce soir', done: false },
  ]);
  const [journal, setJournal] = useState('');
  const [cycleDay, setCycleDay] = useState(18);
  const [fridge, setFridge] = useState<FridgeItem[]>([]);
  const [walletCards, setWalletCards] = useState<WalletCard[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const defaultFamily = (): FamilyProfile => ({
    prenom: 'Joanne',
    partenaire: 'Alexandre',
    enfant: 'Léa',
    ageEnfant: '8',
    objectif: 'Répartir équitablement les tâches',
  });
  const emptyFamily = (): FamilyProfile => ({
    prenom: '',
    partenaire: '',
    enfant: '',
    ageEnfant: '',
    objectif: '',
  });
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile>(() => emptyFamily());
  /** Évite mismatch SSR/client tant que localStorage n’est pas lu. */
  const [clientReady, setClientReady] = useState(false);
  /** Toujours false au 1er rendu pour matcher le SSR ; useEffect applique localStorage. */
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [loginSplashDone, setLoginSplashDone] = useState(false);
  const [alfredMemory, setAlfredMemory] = useState<string[]>([]);
  const [modalDebordee, setModalDebordee] = useState<'closed' | 'confirm' | 'loading' | 'result'>('closed');
  const [debordeeResult, setDebordeeResult] = useState<DebordeeApiResponse | null>(null);
  const [modalAlex, setModalAlex] = useState(false);
  const [alexDoneIds, setAlexDoneIds] = useState<number[]>([]);
  const [alexNotified, setAlexNotified] = useState(false);
  const [partnerContactDraft, setPartnerContactDraft] = useState('');
  const [partnerNotifyLoading, setPartnerNotifyLoading] = useState(false);
  const [courrierImportBusy, setCourrierImportBusy] = useState(false);
  const [modalCoffre, setModalCoffre] = useState(false);
  const [modalEquite, setModalEquite] = useState(false);
  const [equiteTab, setEquiteTab] = useState<'semaine' | 'categories' | 'plan'>('semaine');
  const [equitePlanText, setEquitePlanText] = useState('');
  const [equitePlanLoading, setEquitePlanLoading] = useState(false);
  const [docCat, setDocCat] = useState('Tous');
  const [docSearch, setDocSearch] = useState('');
  const [docAddedFlash, setDocAddedFlash] = useState(false);
  const [docVault, setDocVault] = useState<DocVaultItem[]>([]);
  const [docStorageSummary, setDocStorageSummary] = useState<{ used_bytes: number; quota_bytes: number | null } | null>(null);
  const [docEdit, setDocEdit] = useState<DocEditDraft | null>(null);
  const [docEditSaving, setDocEditSaving] = useState(false);

  const [aiName, setAiName] = useState('Alfred');
  const [toasts, setToasts] = useState<UiToast[]>([]);
  const [taskAssignBusyId, setTaskAssignBusyId] = useState<number | null>(null);
  const [taskCompleteBusyId, setTaskCompleteBusyId] = useState<number | null>(null);
  const [taskReopenBusyId, setTaskReopenBusyId] = useState<number | null>(null);
  const [doneHistoryRefreshBusy, setDoneHistoryRefreshBusy] = useState(false);
  const [doneHistoryMoreBusy, setDoneHistoryMoreBusy] = useState(false);
  const [doneHistoryPagingExhausted, setDoneHistoryPagingExhausted] = useState(true);
  const [taskSummary, setTaskSummary] = useState<TaskSummaryApi | null>(null);
  const [taskSummaryRefreshing, setTaskSummaryRefreshing] = useState(false);
  const doneNextOffsetRef = useRef(INITIAL_DONE_TASKS_LIMIT);
  const docPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const docAttachmentReplaceRef = useRef<HTMLInputElement | null>(null);

  function seedDocsForFamily(f: FamilyProfile): DocVaultItem[] {
    const J = f.prenom || 'Joanne';
    const A = f.partenaire || 'Alexandre';
    const L = f.enfant || 'Léa';
    return [
      { id: 1, icon: 'g:pill', name: `Ordonnance ${L} – Amoxicilline`, cat: '🏥 Santé', date: '12 avr.', exp: '12 juil.', who: L, urgent: false },
      { id: 2, icon: 'g:health', name: `Carnet vaccinations ${L}`, cat: '🏥 Santé', date: '2023', who: L, urgent: false },
      { id: 3, icon: 'g:idcard', name: `Carte Vitale ${J}`, cat: '🏥 Santé', date: '2021', who: J, urgent: false },
      { id: 4, icon: 'g:idcard', name: `Carte Vitale ${A}`, cat: '🏥 Santé', date: '2021', who: A, urgent: false },
      { id: 5, icon: 'g:doc', name: `Attestation scolaire ${L}`, cat: '📚 École', date: 'Sep. 2024', who: L, urgent: false },
      { id: 6, icon: 'g:school', name: 'Coordonnées école + direction', cat: '📚 École', date: 'Permanent', who: L, urgent: false },
      { id: 7, icon: 'g:doc', name: `Acte de naissance ${L}`, cat: '🏛️ Admin', date: '2016', who: L, urgent: false },
      { id: 8, icon: 'g:id', name: `Passeport ${J}`, cat: '🛂 Identité', date: '2020', exp: '2030', who: J, urgent: false },
      { id: 9, icon: 'g:id', name: `Passeport ${A}`, cat: '🛂 Identité', date: '2019', exp: '2029', who: A, urgent: false },
      { id: 10, icon: 'g:home', name: 'Assurance habitation', cat: '🏠 Maison', date: 'Jan. 2024', exp: 'Jan. 2025', who: 'Famille', urgent: true },
      { id: 11, icon: 'g:car', name: 'Assurance voiture', cat: '💰 Finance', date: 'Mar. 2024', exp: 'Mar. 2025', who: A, urgent: false },
      { id: 12, icon: 'g:money', name: 'Avis imposition 2023', cat: '💰 Finance', date: 'Aug. 2024', who: 'Famille', urgent: false },
      { id: 13, icon: 'g:list', name: `Contrat de travail ${J}`, cat: '💰 Finance', date: '2019', who: J, urgent: false },
      { id: 14, icon: 'g:list', name: 'Mutuelle famille', cat: '🏥 Santé', date: 'Jan. 2024', exp: 'Jan. 2025', who: 'Famille', urgent: false },
    ];
  }

  async function refreshTaskSummary(opts?: { trackBusy?: boolean }) {
    if (!token) return;
    const track = opts?.trackBusy ?? false;
    if (track) setTaskSummaryRefreshing(true);
    try {
      setTaskSummary(await getJson<TaskSummaryApi>('/api/v1/tasks/summary', token));
    } catch {
      /* ignore */
    } finally {
      if (track) setTaskSummaryRefreshing(false);
    }
  }

  function pushToast(kind: UiToast['kind'], text: string) {
    const id = newToastId();
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }

  async function reloadCoursesFromServer(accessToken: string) {
    const rows = await fetchGroceryItems(accessToken);
    setCourses(rows.map(mapGroceryToCourse));
  }

  async function addCourseItem(label: string) {
    if (!token || !label.trim()) return;
    const trimmed = label.trim();
    try {
      const row = await createGroceryItem(trimmed, token);
      const mapped = mapGroceryToCourse(row);
      setCourses((prev) => {
        if (prev.some((c) => c.id === mapped.id)) return prev;
        if (prev.some((c) => c.label.toLowerCase() === trimmed.toLowerCase() && !c.done)) return prev;
        return [mapped, ...prev.filter((c) => c.id !== mapped.id)];
      });
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Impossible d’ajouter l’article');
    }
  }

  async function toggleCourseItem(id: number, nextDone: boolean) {
    if (!token) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, done: nextDone, delegated: nextDone ? c.delegated : false } : c,
      ),
    );
    try {
      await patchGroceryItem(id, nextDone ? { done: true } : { done: false, delegated: false }, token);
    } catch {
      void reloadCoursesFromServer(token);
      pushToast('error', 'Synchronisation courses impossible');
    }
  }

  async function removeCourseItem(id: number) {
    if (!token) return;
    setCourses((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteGroceryItem(id, token);
    } catch {
      void reloadCoursesFromServer(token);
      pushToast('error', 'Suppression impossible');
    }
  }

  async function delegateCourseItem(id: number) {
    if (!token) return;
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, delegated: true, done: false } : c)));
    try {
      await patchGroceryItem(id, { delegated: true, done: false }, token);
    } catch {
      void reloadCoursesFromServer(token);
      pushToast('error', 'Délégation impossible');
    }
  }

  async function clearDoneCourseItems() {
    if (!token) return;
    setCourses((prev) => prev.filter((c) => !c.done));
    try {
      await clearDoneGroceryItems(token);
    } catch {
      void reloadCoursesFromServer(token);
      pushToast('error', 'Nettoyage impossible');
    }
  }

  async function reloadFridgeFromServer(accessToken: string) {
    const rows = await fetchFridgeItems(accessToken);
    setFridge(rows.map(mapFridgeToUi));
  }

  async function removeFridgeItem(id: number) {
    if (!token) return;
    setFridge((prev) => prev.filter((f) => f.id !== id));
    try {
      await deleteFridgeItem(id, token);
    } catch {
      void reloadFridgeFromServer(token);
      pushToast('error', 'Retrait du frigo impossible');
    }
  }

  const onExecuteIntentRef = useRef<
    (command: string, interpreted: AgentInterpretResponse) => Promise<AgentExecutionResult>
  >(async () => ({ done: false }));

  const alfred = useAlfredAssistant({
    token,
    overlayActive: overlay === 'assistant' || mainTab === 'alfred',
    aiName,
    alfredMemory,
    setAlfredMemory,
    onExecuteIntent: (command, interpreted) => onExecuteIntentRef.current(command, interpreted),
    onToast: pushToast,
  });

  async function assignTaskMember(taskId: number, next: number | null) {
    if (!token || taskId <= 0) return;
    setTaskAssignBusyId(taskId);
    try {
      await patchJson<TaskItem>(`/api/v1/tasks/${taskId}`, { assigned_member_id: next }, token);
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, assigned_member_id: next } : x)));
      pushToast('success', 'Assignation mise à jour');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Impossible de mettre à jour');
    } finally {
      setTaskAssignBusyId(null);
    }
  }

  async function completeTaskById(taskId: number) {
    if (!token || taskId <= 0) return;
    setTaskCompleteBusyId(taskId);
    try {
      const updated = await postJson<TaskItem>(`/api/v1/tasks/${taskId}/complete`, {}, token);
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, ...updated } : x)));
      void refreshTaskSummary();
      pushToast('success', 'Tâche marquée comme faite');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Impossible de terminer la tâche');
    } finally {
      setTaskCompleteBusyId(null);
    }
  }

  async function reopenTaskById(taskId: number) {
    if (!token || taskId <= 0) return;
    setTaskReopenBusyId(taskId);
    try {
      const updated = await patchJson<TaskItem>(`/api/v1/tasks/${taskId}`, { status: 'open' }, token);
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, ...updated } : x)));
      void refreshTaskSummary();
      pushToast('success', 'Tâche rouverte');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Impossible de rouvrir la tâche');
    } finally {
      setTaskReopenBusyId(null);
    }
  }

  async function refreshDoneTasksFromServer() {
    if (!token) return;
    setDoneHistoryRefreshBusy(true);
    try {
      const rows = await getJson<TaskItem[]>(
        `/api/v1/tasks?status=done&limit=${DONE_HISTORY_FETCH_LIMIT}`,
        token,
      );
      setTasks((prev) => mergeTasksById(prev, rows));
      doneNextOffsetRef.current = rows.length;
      setDoneHistoryPagingExhausted(rows.length < DONE_HISTORY_FETCH_LIMIT);
      void refreshTaskSummary();
      pushToast('success', `${rows.length} tâche(s) terminée(s) récupérée(s) — fusion avec ta liste locale.`);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Synchronisation impossible');
    } finally {
      setDoneHistoryRefreshBusy(false);
    }
  }

  async function loadMoreDoneTasksPage() {
    if (!token || doneHistoryPagingExhausted || doneHistoryMoreBusy) return;
    setDoneHistoryMoreBusy(true);
    try {
      const off = doneNextOffsetRef.current;
      const rows = await getJson<TaskItem[]>(
        `/api/v1/tasks?status=done&limit=${INITIAL_DONE_TASKS_LIMIT}&offset=${off}`,
        token,
      );
      doneNextOffsetRef.current = off + rows.length;
      setTasks((prev) => mergeTasksById(prev, rows));
      if (rows.length < INITIAL_DONE_TASKS_LIMIT) setDoneHistoryPagingExhausted(true);
      pushToast('success', `${rows.length} tâche(s) terminée(s) en plus.`);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setDoneHistoryMoreBusy(false);
    }
  }

  function openDocEdit(d: DocVaultItem) {
    const ic = (d.icon || 'g:doc').slice(0, 16);
    setDocEdit({
      id: d.id,
      icon: ic,
      name: d.name,
      category: d.cat || 'Divers',
      date_label: d.date === '—' ? '' : d.date,
      who: d.who === 'Famille' ? '' : d.who,
      notes: d.notes ?? '',
      expires_date: d.expiresAtIso ? d.expiresAtIso.slice(0, 10) : '',
    });
  }

  async function saveDocEdit() {
    if (!token || !docEdit) return;
    const name = docEdit.name.trim();
    if (!name) {
      pushToast('error', 'Le nom est requis');
      return;
    }
    setDocEditSaving(true);
    try {
      await patchJson<HouseholdDocumentApi>(`/api/v1/documents/${docEdit.id}`, {
        icon: docEdit.icon.trim().slice(0, 16) || 'g:doc',
        name,
        category: docEdit.category.trim() || 'Divers',
        date_label: docEdit.date_label.trim() || null,
        who: docEdit.who.trim() || null,
        notes: docEdit.notes.trim() || null,
        expires_at: docEdit.expires_date
          ? (() => {
              const [yy, mm, dd] = docEdit.expires_date.split('-').map((x) => Number(x));
              return new Date(yy, mm - 1, dd, 12, 0, 0).toISOString();
            })()
          : null,
      }, token);
      pushToast('success', 'Document mis à jour');
      setDocEdit(null);
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setDocEditSaving(false);
    }
  }

  async function createDocFromPhotoFile(file: File) {
    if (!token) return;
    const base =
      file.name
        .replace(/\.[^.]+$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim() || 'Photo';
    const safeName = base.slice(0, 200);
    const kb = Math.max(1, Math.round(file.size / 1024));
    try {
      const created = await postJson<HouseholdDocumentApi>(
        '/api/v1/documents',
        {
          icon: 'g:doc',
          name: safeName,
          category: docCategoryForApi(docCat),
          date_label: new Date().toLocaleDateString('fr-FR'),
          who: familyProfile.prenom,
          urgent: false,
          notes: `Import fichier (${kb} Ko) — pièce jointe sur le serveur.`,
        },
        token
      );
      const fd = new FormData();
      fd.append('file', file);
      await postFormData<HouseholdDocumentApi>(`/api/v1/documents/${created.id}/attachment`, fd, token);
      setDocAddedFlash(true);
      window.setTimeout(() => setDocAddedFlash(false), 2400);
      pushToast('success', 'Fiche créée et fichier enregistré sur le serveur.');
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Impossible d’enregistrer la fiche ou le fichier');
    }
  }

  async function downloadDocAttachment(docId: number) {
    if (!token) return;
    try {
      const { blob, filename } = await downloadAuthed(`/api/v1/documents/${docId}/attachment`, token);
      saveBlobAsFile(blob, filename);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Téléchargement impossible');
    }
  }

  async function uploadAttachmentForDoc(docId: number, file: File) {
    if (!token) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      await postFormData<HouseholdDocumentApi>(`/api/v1/documents/${docId}/attachment`, fd, token);
      pushToast('success', 'Pièce jointe enregistrée sur le serveur');
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Envoi impossible');
    }
  }

  async function removeAttachmentForDoc(docId: number) {
    if (!token) return;
    if (!window.confirm('Supprimer la pièce jointe du serveur ?')) return;
    try {
      await deleteJson<HouseholdDocumentApi>(`/api/v1/documents/${docId}/attachment`, token);
      pushToast('info', 'Pièce jointe supprimée');
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Erreur');
    }
  }

  function openDocEmailDraft() {
    const subject = encodeURIComponent('Archiver un document — MajorDome');
    const body = encodeURIComponent(
      `Bonjour,\n\nDocument à conserver dans le coffre famille MajorDome (Plus → Coffre ou raccourci depuis l’accueil).\n\n— ${familyProfile.prenom}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    pushToast('info', 'Brouillon mail ouvert — ajoute les pièces jointes, puis complète la fiche dans le coffre si besoin.');
  }

  async function notifySystem(title: string, body: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, { body });
        return;
      }
    }
    new Notification(title, { body });
  }

  useEffect(() => {
    const d = new Date();
    setSelectedMealDay(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    setClientTodayLabel(d.toLocaleDateString('fr-FR'));

    const stored = localStorage.getItem('majordome_access_token');
    if (stored) setToken(stored);
    const layoutEmail = localStorage.getItem(LAYOUT_USER_EMAIL_KEY);
    if (layoutEmail) setLayoutUserEmail(layoutEmail);
    if (stored && layoutEmail) setHomeLayout(loadHomeLayoutForUser(layoutEmail));
    const storedAiName = localStorage.getItem('majordome_ai_name');
    const cleanName = storedAiName?.trim() || 'Alfred';
    if (!storedAiName) localStorage.setItem('majordome_ai_name', cleanName);
    setAiName(cleanName);
    alfred.hydrateHistoryFromStorage(cleanName);
    try {
      const famRaw = localStorage.getItem('majordome_family_profile');
      let fam: FamilyProfile = defaultFamily();
      if (famRaw) {
        fam = { ...defaultFamily(), ...JSON.parse(famRaw) };
      }
      setFamilyProfile(fam);
      const ob = localStorage.getItem('majordome_onboarding_done');
      const doneOb = ob === '1' || Boolean(famRaw);
      const wizV2 = layoutEmail ? isWelcomeWizardV2Complete(layoutEmail) : false;
      setOnboardingDone(doneOb || wizV2);

      const memRaw = localStorage.getItem('majordome_alfred_memory');
      if (memRaw) {
        const parsed = JSON.parse(memRaw);
        if (Array.isArray(parsed)) setAlfredMemory(parsed.filter((x: unknown) => typeof x === 'string'));
      }

      const pcontact = localStorage.getItem('majordome_partner_contact');
      if (pcontact) setPartnerContactDraft(pcontact);

      const savedBudget = localStorage.getItem('majordome_budget');
      const savedMeals = localStorage.getItem('majordome_meal_plans');
      const savedMoments = localStorage.getItem('majordome_self_moments');
      if (savedBudget) setBudget(JSON.parse(savedBudget));
      if (savedMeals) setMealPlans(JSON.parse(savedMeals));
      if (savedMoments) setSelfMoments(JSON.parse(savedMoments));
      const savedJournal = localStorage.getItem('majordome_journal');
      const savedCycle = localStorage.getItem('majordome_cycle_day');
      if (savedJournal) setJournal(savedJournal);
      if (savedCycle) setCycleDay(Number(savedCycle));
    } catch {
      // keep defaults
    } finally {
      setClientReady(true);
    }
  }, []);

  useEffect(() => {
    if (token) setLoginSplashDone(true);
  }, [token]);

  useEffect(() => {
    if (!clientReady || !token || !postLoginSetupDone || typeof window === 'undefined') return;
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'alfred') {
      setMainTab('alfred');
      setOverlay('assistant');
    } else if (tab === 'agenda') {
      setMainTab('agenda');
      setOverlay(null);
    } else if (tab === 'modules') {
      setMainTab('modules');
      setOverlay('plus');
    } else if (tab === 'moi') {
      setMainTab('moi');
      setOverlay(null);
    }
    if (tab) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [clientReady, token, postLoginSetupDone]);

  useAppDocumentTitle({ clientReady, token, overlay, mainTab, aiName });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!token) {
      setPostLoginSetupResolved(false);
      setPostLoginSetupDone(false);
      return;
    }
    const em = localStorage.getItem(LAYOUT_USER_EMAIL_KEY);
    if (!em) {
      setPostLoginSetupDone(true);
      setPostLoginSetupResolved(true);
      return;
    }
    setLayoutUserEmail(em);
    setPostLoginSetupDone(isWelcomeWizardV2Complete(em));
    setPostLoginSetupResolved(true);
  }, [token]);

  useEffect(() => {
    localStorage.setItem('majordome_budget', JSON.stringify(budget));
  }, [budget]);
  useEffect(() => {
    localStorage.setItem('majordome_meal_plans', JSON.stringify(mealPlans));
  }, [mealPlans]);
  useEffect(() => {
    localStorage.setItem('majordome_self_moments', JSON.stringify(selfMoments));
  }, [selfMoments]);
  useEffect(() => {
    localStorage.setItem('majordome_journal', journal);
  }, [journal]);
  useEffect(() => {
    localStorage.setItem('majordome_cycle_day', String(cycleDay));
  }, [cycleDay]);
  useEffect(() => {
    try {
      localStorage.setItem('majordome_alfred_memory', JSON.stringify(alfredMemory));
    } catch {
      // ignore
    }
  }, [alfredMemory]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== 'k') return;
      ev.preventDefault();
      if (!token || !onboardingDone || !postLoginSetupDone) return;
      toggleGlobalSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [token, onboardingDone, postLoginSetupDone, toggleGlobalSearch]);

  async function loadData(accessToken: string) {
    setLoading(true);
    setError('');
    try {
      const [eventsRes, tasksPayload, oppsRes, conflictsRes, accountsRes, membersRes, taskSummaryRes, capRes, memoryRes] =
        await Promise.all([
        getJson<EventItem[]>('/api/v1/events', accessToken),
        (async (): Promise<{ merged: TaskItem[]; donePagingExhausted: boolean }> => {
          try {
            const [openRows, doneRows] = await Promise.all([
              getJson<TaskItem[]>('/api/v1/tasks?status=open', accessToken),
              getJson<TaskItem[]>(
                `/api/v1/tasks?status=done&limit=${INITIAL_DONE_TASKS_LIMIT}`,
                accessToken,
              ),
            ]);
            return {
              merged: mergeTasksById(openRows, doneRows),
              donePagingExhausted: doneRows.length < INITIAL_DONE_TASKS_LIMIT,
            };
          } catch {
            const all = await getJson<TaskItem[]>('/api/v1/tasks', accessToken);
            return { merged: all, donePagingExhausted: true };
          }
        })(),
        getJson<OpportunityItem[]>('/api/v1/opportunities', accessToken),
        getJson<{ conflicts: ConflictItem[] }>('/api/v1/events/conflicts', accessToken),
        getJson<ConnectedAccount[]>('/api/v1/accounts', accessToken),
        getJson<HouseholdMemberRow[]>('/api/v1/household/members', accessToken).catch(() => []),
        getJson<TaskSummaryApi>('/api/v1/tasks/summary', accessToken).catch(() => null),
        getJson<{ apple_caldav_available: boolean }>('/api/v1/integrations/capabilities', accessToken).catch(() => null),
        getJson<{ id: number; fact_text: string }[]>('/api/v1/memory/facts', accessToken).catch(() => []),
      ]);
      if (memoryRes.length > 0) {
        const fromServer = memoryRes.map((f) => f.fact_text.trim()).filter(Boolean);
        setAlfredMemory((prev) => {
          const merged = [...prev];
          for (const line of fromServer) {
            if (!merged.includes(line)) merged.push(line);
          }
          return merged.slice(-48);
        });
      }
      const caldavServerOk = capRes?.apple_caldav_available ?? null;
      setAppleCaldavAvailable(caldavServerOk);
      setEvents(eventsRes);
      setTaskSummary(taskSummaryRes ?? null);
      doneNextOffsetRef.current = INITIAL_DONE_TASKS_LIMIT;
      setDoneHistoryPagingExhausted(tasksPayload.donePagingExhausted);
      setTasks(tasksPayload.merged);
      setOpps(oppsRes);
      setConflicts(conflictsRes.conflicts || []);
      setAccounts(accountsRes);
      setHouseholdMembers(membersRes);

      if (caldavServerOk === false) {
        setNewEventProvider((prev) => {
          if (prev !== 'apple_calendar') return prev;
          const g = accountsRes.some((a) => a.provider === 'google_calendar' && a.status === 'connected');
          return g ? 'google_calendar' : 'none';
        });
      }

      let docsRes = await getJson<HouseholdDocumentApi[]>('/api/v1/documents', accessToken);
      if (docsRes.length === 0 && typeof window !== 'undefined') {
        const legacyRaw = localStorage.getItem('majordome_doc_vault');
        if (legacyRaw) {
          try {
            const arr = JSON.parse(legacyRaw) as unknown[];
            if (Array.isArray(arr) && arr.length > 0) {
              let imported = 0;
              for (const item of arr) {
                if (!item || typeof item !== 'object') continue;
                const o = item as Record<string, unknown>;
                const name = typeof o.name === 'string' ? o.name.trim() : '';
                if (!name) continue;
                const icon = typeof o.icon === 'string' ? o.icon : 'g:doc';
                const category =
                  typeof o.cat === 'string' ? o.cat : typeof o.category === 'string' ? o.category : 'Divers';
                const date_label =
                  typeof o.date === 'string'
                    ? o.date
                    : typeof o.date_label === 'string'
                      ? o.date_label
                      : null;
                const who = typeof o.who === 'string' ? o.who : null;
                const urgent = Boolean(o.urgent);
                const notes = typeof o.notes === 'string' ? o.notes : null;
                try {
                  await postJson('/api/v1/documents', { icon, name, category, date_label, who, urgent, notes }, accessToken);
                  imported += 1;
                } catch {
                  // ligne ignorée
                }
              }
              if (imported > 0) {
                localStorage.removeItem('majordome_doc_vault');
                pushToast('success', `${imported} document(s) importé(s) depuis l’ancien coffre local`);
                docsRes = await getJson<HouseholdDocumentApi[]>('/api/v1/documents', accessToken);
              }
            }
          } catch {
            // ignore JSON invalide
          }
        }
      }
      if (docsRes.length === 0) {
        let fam = defaultFamily();
        try {
          const raw = localStorage.getItem('majordome_family_profile');
          if (raw) fam = { ...defaultFamily(), ...JSON.parse(raw) };
        } catch {
          // ignore
        }
        await postJson<{ created: number }>(
          '/api/v1/documents/bootstrap',
          { prenom: fam.prenom, partenaire: fam.partenaire, enfant: fam.enfant },
          accessToken
        );
        docsRes = await getJson<HouseholdDocumentApi[]>('/api/v1/documents', accessToken);
      }
      setDocVault(docsRes.map(mapDocFromApi));
      try {
        const st = await getJson<{ used_bytes: number; quota_bytes: number | null }>(
          '/api/v1/documents/storage-summary',
          accessToken
        );
        setDocStorageSummary(st);
      } catch {
        setDocStorageSummary(null);
      }

      try {
        let famSync = defaultFamily();
        const rawFam = localStorage.getItem('majordome_family_profile');
        if (rawFam) famSync = { ...defaultFamily(), ...JSON.parse(rawFam) };
        await postJson('/api/v1/household/profile/sync-members', {
          primary_name: famSync.prenom,
          partner_name: famSync.partenaire,
          child_name: famSync.enfant,
        }, accessToken);
      } catch {
        /* pas propriétaire ou profil vide : ignoré */
      }

      let groceryRows = await fetchGroceryItems(accessToken).catch(() => []);
      if (groceryRows.length === 0 && typeof window !== 'undefined') {
        const legacyRaw = localStorage.getItem('majordome_courses');
        if (legacyRaw) {
          try {
            const arr = JSON.parse(legacyRaw) as unknown[];
            if (Array.isArray(arr) && arr.length > 0) {
              let imported = 0;
              for (const item of arr) {
                if (!item || typeof item !== 'object') continue;
                const label =
                  typeof (item as { label?: string }).label === 'string'
                    ? (item as { label: string }).label.trim()
                    : '';
                if (!label || (item as { done?: boolean }).done) continue;
                try {
                  await createGroceryItem(label, accessToken);
                  imported += 1;
                } catch {
                  /* ignore */
                }
              }
              if (imported > 0) {
                localStorage.removeItem('majordome_courses');
                pushToast('success', `${imported} article(s) importé(s) vers la liste courses`);
                groceryRows = await fetchGroceryItems(accessToken);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
      setCourses(groceryRows.map(mapGroceryToCourse));

      let fridgeRows = await fetchFridgeItems(accessToken).catch(() => []);
      if (fridgeRows.length === 0 && typeof window !== 'undefined') {
        const legacyRaw = localStorage.getItem('majordome_fridge');
        if (legacyRaw) {
          try {
            const arr = JSON.parse(legacyRaw) as unknown[];
            if (Array.isArray(arr) && arr.length > 0) {
              let imported = 0;
              for (const item of arr) {
                if (!item || typeof item !== 'object') continue;
                const label =
                  typeof (item as { label?: string }).label === 'string'
                    ? (item as { label: string }).label.trim()
                    : '';
                const expires_at =
                  typeof (item as { expires_at?: string }).expires_at === 'string'
                    ? (item as { expires_at: string }).expires_at
                    : '';
                const qty =
                  typeof (item as { qty?: number }).qty === 'number' ? (item as { qty: number }).qty : 1;
                if (!label || !expires_at) continue;
                try {
                  await createFridgeItem({ label, expires_at, qty }, accessToken);
                  imported += 1;
                } catch {
                  /* ignore */
                }
              }
              if (imported > 0) {
                localStorage.removeItem('majordome_fridge');
                pushToast('success', `${imported} produit(s) importé(s) vers le frigo`);
                fridgeRows = await fetchFridgeItems(accessToken);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
      setFridge(fridgeRows.map(mapFridgeToUi));

      let walletCardRows = await fetchWalletCards(accessToken).catch(() => []);
      let couponRows = await fetchCoupons(accessToken).catch(() => []);
      if (
        (walletCardRows.length === 0 || couponRows.length === 0) &&
        typeof window !== 'undefined'
      ) {
        const legacyCardsRaw = localStorage.getItem('majordome_wallet_cards');
        const legacyCouponsRaw = localStorage.getItem('majordome_wallet_coupons');
        let cardsImported = 0;
        let couponsImported = 0;
        if (walletCardRows.length === 0 && legacyCardsRaw) {
          try {
            const arr = JSON.parse(legacyCardsRaw) as unknown[];
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (!item || typeof item !== 'object') continue;
                const brand =
                  typeof (item as { brand?: string }).brand === 'string'
                    ? (item as { brand: string }).brand.trim()
                    : '';
                if (!brand) continue;
                const points =
                  typeof (item as { points?: number }).points === 'number'
                    ? (item as { points: number }).points
                    : 0;
                const color =
                  typeof (item as { color?: string }).color === 'string'
                    ? (item as { color: string }).color
                    : '#2B7A4B';
                try {
                  await createWalletCard({ brand, points, color }, accessToken);
                  cardsImported += 1;
                } catch {
                  /* ignore */
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (couponRows.length === 0 && legacyCouponsRaw) {
          try {
            const arr = JSON.parse(legacyCouponsRaw) as unknown[];
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (!item || typeof item !== 'object') continue;
                const label =
                  typeof (item as { label?: string }).label === 'string'
                    ? (item as { label: string }).label.trim()
                    : '';
                const expires_at =
                  typeof (item as { expires_at?: string }).expires_at === 'string'
                    ? (item as { expires_at: string }).expires_at
                    : '';
                const discount =
                  typeof (item as { discount?: string }).discount === 'string'
                    ? (item as { discount: string }).discount.trim()
                    : '';
                if (!label || !expires_at || !discount) continue;
                try {
                  await createCoupon({ label, expires_at, discount }, accessToken);
                  couponsImported += 1;
                } catch {
                  /* ignore */
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (cardsImported > 0 || couponsImported > 0) {
          if (cardsImported > 0) localStorage.removeItem('majordome_wallet_cards');
          if (couponsImported > 0) localStorage.removeItem('majordome_wallet_coupons');
          const parts: string[] = [];
          if (cardsImported > 0) parts.push(`${cardsImported} carte(s) fidélité`);
          if (couponsImported > 0) parts.push(`${couponsImported} coupon(s)`);
          pushToast('success', `${parts.join(' · ')} importé(s) vers le wallet`);
          walletCardRows = await fetchWalletCards(accessToken).catch(() => walletCardRows);
          couponRows = await fetchCoupons(accessToken).catch(() => couponRows);
        }
      }
      setWalletCards(walletCardRows.map(mapWalletCardToUi));
      setCoupons(couponRows.map(mapCouponToUi));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement';
      setError(msg);
      pushToast('error', msg);
      setDocStorageSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadData(token);
  }, [token]);

  useEffect(() => {
    if (!modalCoffre) setDocEdit(null);
  }, [modalCoffre]);

  type GoogleOAuthStartResponse = { authorization_url: string };

  async function connectGoogleCalendar() {
    if (!token) {
      pushToast('info', 'Connecte-toi d’abord pour lier Google Calendar.');
      return;
    }
    try {
      const res = await postJson<GoogleOAuthStartResponse>('/api/v1/integrations/google/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connexion Google impossible';
      pushToast('error', msg);
    }
  }

  function applyAuthSession(res: LoginResponse) {
    localStorage.setItem('majordome_access_token', res.access_token);
    localStorage.setItem('majordome_refresh_token', res.refresh_token);
    const emLogin = email.trim().toLowerCase();
    if (emLogin) {
      localStorage.setItem(LAYOUT_USER_EMAIL_KEY, emLogin);
      setLayoutUserEmail(emLogin);
      setHomeLayout(loadHomeLayoutForUser(emLogin));
    }
    setToken(res.access_token);
  }

  async function submitAuth() {
    setLoading(true);
    setError('');
    const path = authMode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login';
    const payload = { email, password, full_name: 'Utilisateur MajorDome' };
    try {
      const res = await postJson<LoginResponse>(path, payload);
      applyAuthSession(res);
      setInfo(authMode === 'register' ? 'Compte créé. Bienvenue !' : 'Connexion réussie.');
      pushToast('success', authMode === 'register' ? 'Compte créé' : 'Connexion réussie');
      void notifySystem('MajorDome', 'Bienvenue dans MajorDome.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de connexion';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setLoading(false);
    }
  }

  const clearSession = useCallback(() => {
    alfred.disconnectRealtime();
    localStorage.removeItem('majordome_access_token');
    localStorage.removeItem('majordome_refresh_token');
    localStorage.removeItem(LAYOUT_USER_EMAIL_KEY);
    setLayoutUserEmail('');
    setPostLoginSetupResolved(false);
    setPostLoginSetupDone(false);
    setHomeLayout(mergeHomeLayout(null));
    setMainTab('home');
    setOverlay(null);
    setToken('');
    setEvents([]);
    setTasks([]);
    setTaskAssignBusyId(null);
    setTaskCompleteBusyId(null);
    setTaskReopenBusyId(null);
    setDoneHistoryRefreshBusy(false);
    setDoneHistoryMoreBusy(false);
    setDoneHistoryPagingExhausted(true);
    doneNextOffsetRef.current = INITIAL_DONE_TASKS_LIMIT;
    setTaskSummary(null);
    setHouseholdMembers([]);
    setOpps([]);
    setConflicts([]);
    setDocVault([]);
  }, [alfred]);

  useEffect(() => {
    const onToken = (ev: Event) => {
      const tok = (ev as CustomEvent<{ accessToken?: string }>).detail?.accessToken;
      if (tok) setToken(tok);
    };
    const onLogout = () => {
      clearSession();
      pushToast('info', 'Session expirée — reconnecte-toi.');
    };
    window.addEventListener(AUTH_TOKEN_EVENT, onToken);
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => {
      window.removeEventListener(AUTH_TOKEN_EVENT, onToken);
      window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
    };
  }, [clearSession]);

  function logout() {
    const refresh = localStorage.getItem('majordome_refresh_token');
    if (token) {
      void postJson('/api/v1/auth/logout', { refresh_token: refresh ?? undefined }, token).catch(() => undefined);
    }
    clearSession();
    pushToast('info', 'Déconnexion effectuée');
  }

  async function executeAgentIntent(
    rawCommand: string,
    interpreted: AgentInterpretResponse,
  ): Promise<AgentExecutionResult> {
    if (!token) return { done: false };
    return runAgentIntent({
      token,
      rawCommand,
      interpreted,
      openTasks,
      householdMembers,
      familyProfile,
      primaryMemberId,
      partnerMemberId,
      childMemberId,
      accounts,
      callbacks: {
        onAddCourse: (label) => {
          void addCourseItem(label);
        },
        onTaskCreated: (task) => setTasks((prev) => mergeTasksById(prev, [task as TaskItem])),
        onTaskUpdated: (task) =>
          setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, ...(task as TaskItem) } : x))),
        onEventCreated: (event) =>
          setEvents((prev) => [event as EventItem, ...prev.filter((e) => e.id !== event.id)]),
        onMemoryNote: (note) => setAlfredMemory((prev) => (prev.includes(note) ? prev : [...prev, note])),
        refreshTaskSummary: () => void refreshTaskSummary({ trackBusy: false }),
      },
    });
  }

  onExecuteIntentRef.current = executeAgentIntent;

  async function launchDebordee() {
    if (!token) return;
    setModalDebordee('loading');
    try {
      const res = await postJson<DebordeeApiResponse>(
        '/api/v1/agent/debordee',
        {
          task_titles: openTasks.map((t) => t.title),
          primary_name: familyProfile.prenom,
          partner_name: familyProfile.partenaire,
          child_name: familyProfile.enfant,
        },
        token
      );
      setDebordeeResult(res);
      setModalDebordee('result');
      pushToast('success', 'Alfred a trié ta liste');
    } catch {
      setDebordeeResult({
        critique: openTasks.slice(0, 2).map((t) => t.title),
        deleguer: openTasks.slice(2, 4).map((t) => `${t.title}:${familyProfile.partenaire}`),
        supprimer: openTasks.slice(4).map((t) => t.title),
        message: `Garde l'essentiel, délègue vers ${familyProfile.partenaire}. Respire — on avance.`,
      });
      setModalDebordee('result');
      pushToast('info', 'Mode hors-ligne : tri approximatif');
    }
  }

  async function loadEquitePlan() {
    if (!token || equitePlanLoading || equitePlanText) return;
    setEquitePlanLoading(true);
    try {
      const res = await postJson<AgentInterpretResponse>(
        '/api/v1/agent/interpret',
        {
          command: `Tu es Alfred. Foyer : ${familyProfile.prenom}, ${familyProfile.partenaire}, enfant ${familyProfile.enfant}. Objectif : ${familyProfile.objectif}. Donne en 4 à 6 phrases en français un plan concret de rééquilibrage des tâches domestiques : quoi basculer vers ${familyProfile.partenaire}, quoi confier à ${familyProfile.enfant}, et un objectif chiffré sur 4 semaines. Ton bienveillant, sans JSON.`,
        },
        token
      );
      setEquitePlanText(res.explanation || '');
    } catch {
      setEquitePlanText(
        `Cette semaine, propose à ${familyProfile.partenaire} de prendre les courses du samedi et les RDV médicaux de ${familyProfile.enfant}. ` +
          `Objectif : réduire la part de ${familyProfile.prenom} d’environ 15 % sur un mois.`
      );
    } finally {
      setEquitePlanLoading(false);
    }
  }

  function completeWelcomeWizard(next: HomeLayoutConfig, profile: FamilyProfile) {
    const em =
      layoutUserEmail || (typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_USER_EMAIL_KEY) : null);
    if (em) {
      saveHomeLayoutForUser(em, next);
      markPostLoginPersonalizationComplete(em);
      markWelcomeWizardV2Complete(em);
    }
    setHomeLayout(mergeHomeLayout(next));
    setFamilyProfile(profile);
    try {
      localStorage.setItem('majordome_family_profile', JSON.stringify(profile));
      localStorage.setItem('majordome_onboarding_done', '1');
    } catch {
      /* ignore */
    }
    setOnboardingDone(true);
    setPostLoginSetupDone(true);
    pushToast('success', 'Parcours terminé — bienvenue dans MajorDome');
    const t = localStorage.getItem('majordome_access_token');
    if (t) void loadData(t);
  }

  function skipWelcomeWizard(profile: FamilyProfile) {
    const em =
      layoutUserEmail || (typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_USER_EMAIL_KEY) : null);
    const defaultLayout = buildHomeLayoutFromPostLoginChoices([], 'balanced');
    if (em) {
      saveHomeLayoutForUser(em, defaultLayout);
      markPostLoginPersonalizationComplete(em);
      markWelcomeWizardV2Complete(em);
    }
    setHomeLayout(mergeHomeLayout(defaultLayout));
    setFamilyProfile(profile);
    try {
      localStorage.setItem('majordome_family_profile', JSON.stringify(profile));
      localStorage.setItem('majordome_onboarding_done', '1');
    } catch {
      /* ignore */
    }
    setOnboardingDone(true);
    setPostLoginSetupDone(true);
    pushToast('info', 'Tu pourras tout retrouver dans l’app et dans « Personnaliser l’accueil ».');
    const t = localStorage.getItem('majordome_access_token');
    if (t) void loadData(t);
  }

  async function createEventFromApp() {
    if (!token) return;
    if (!newEventTitle.trim() || !newEventStart || !newEventEnd) {
      setError('Titre, debut et fin sont requis.');
      return;
    }
    setCreatingEvent(true);
    setError('');
    try {
      await postJson(
        '/api/v1/events/create-and-sync',
        {
          title: newEventTitle.trim(),
          starts_at: new Date(newEventStart).toISOString(),
          ends_at: new Date(newEventEnd).toISOString(),
          provider: newEventProvider,
        },
        token
      );
      setInfo('Evenement cree et synchronise.');
      pushToast('success', 'Événement ajouté');
      void notifySystem('Agenda', `Événement créé: ${newEventTitle.trim()}`);
      setNewEventTitle('');
      setNewEventStart('');
      setNewEventEnd('');
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur creation evenement';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setCreatingEvent(false);
    }
  }

  async function deleteEventFromApp(eventId: number) {
    if (!token) return;
    setError('');
    try {
      await deleteJson(`/api/v1/events/${eventId}`, token);
      setInfo('Evenement supprime.');
      pushToast('success', 'Événement supprimé');
      void notifySystem('Agenda', 'Événement supprimé');
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur suppression';
      setError(msg);
      pushToast('error', msg);
    }
  }

  function beginEdit(event: EventItem) {
    const startDate = new Date(event.starts_at);
    const endDate = event.ends_at ? new Date(event.ends_at) : new Date(startDate.getTime() + 60 * 60 * 1000);
    setEditingEventId(event.id);
    setEditTitle(event.title);
    setEditStart(startDate.toISOString().slice(0, 16));
    setEditEnd(endDate.toISOString().slice(0, 16));
    setEditExpectedUpdatedAt(event.updated_at || '');
  }

  async function saveEditEvent() {
    if (!token || editingEventId === null) return;
    if (!editTitle.trim() || !editStart || !editEnd) {
      setError('Titre, debut et fin sont requis.');
      return;
    }
    setError('');
    try {
      await putJson(
        `/api/v1/events/${editingEventId}/update-and-sync`,
        {
          title: editTitle.trim(),
          starts_at: new Date(editStart).toISOString(),
          ends_at: new Date(editEnd).toISOString(),
          expected_updated_at: editExpectedUpdatedAt || undefined,
        },
        token,
      );
      setInfo('Evenement modifie et synchronise.');
      pushToast('success', 'Événement modifié');
      void notifySystem('Agenda', `Événement modifié: ${editTitle.trim()}`);
      setEditingEventId(null);
      await loadData(token);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        const msg = "Conflit détecté : l'événement a été modifié ailleurs. Agenda rechargé.";
        setError(msg);
        pushToast('info', msg);
        await loadData(token);
        return;
      }
      const msg = err.message || 'Erreur modification';
      setError(msg);
      pushToast('error', msg);
    }
  }

  async function addSelfMomentAsTask(label: string) {
    if (!token) return;
    try {
      await postJson('/api/v1/tasks', { title: `Moi - ${label}`, task_type: 'manual_task' }, token);
      setInfo('Moment ajoute a tes taches.');
      pushToast('success', 'Moment ajouté en tâche');
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible d ajouter le moment';
      setError(msg);
      pushToast('error', msg);
    }
  }

  async function importCourrierTaskTitles(titles: string[]) {
    if (!token) {
      pushToast('error', 'Connecte-toi pour importer des tâches.');
      return;
    }
    setCourrierImportBusy(true);
    try {
      for (const title of titles) {
        await postJson('/api/v1/tasks', { title: `Courrier — ${title}`, task_type: 'manual_task' }, token);
      }
      pushToast('success', `${titles.length} tâche(s) créée(s) depuis le courrier`);
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Import impossible');
    } finally {
      setCourrierImportBusy(false);
    }
  }

  const nextEvents = useMemo(() => events.slice(0, 6), [events]);
  const openTasks = useMemo(() => selectOpenTasks(tasks), [tasks]);
  const agendaOpenTasks = useMemo(() => sortAgendaOpenTasks(openTasks), [openTasks]);
  const doneTasks = useMemo(() => selectDoneTasks(tasks), [tasks]);
  const sortedDoneTasks = useMemo(() => sortDoneTasksRecent(doneTasks), [doneTasks]);

  const partnerMemberId = useMemo(
    () => resolveHouseholdMemberId(householdMembers, 'partner_adult', familyProfile.partenaire),
    [householdMembers, familyProfile.partenaire]
  );

  const childMemberId = useMemo(
    () => resolveHouseholdMemberId(householdMembers, 'child', familyProfile.enfant),
    [householdMembers, familyProfile.enfant]
  );

  const primaryMemberId = useMemo(
    () => resolveHouseholdMemberId(householdMembers, 'primary_adult', familyProfile.prenom),
    [householdMembers, familyProfile.prenom]
  );

  const urgentCount = useMemo(() => conflicts.filter((c) => c.severity === 'high').length, [conflicts]);
  const loadPct = computeTaskCompletionPct(openTasks.length, tasks.length);
  const doneCourses = useMemo(() => courses.filter((c) => c.done).length, [courses]);
  const morningPct = Math.round((morningDone.filter(Boolean).length / Math.max(morningDone.length, 1)) * 100);
  const eveningPct = Math.round((eveningDone.filter(Boolean).length / Math.max(eveningDone.length, 1)) * 100);
  const budgetUsedPct = computeBudgetUsedPct(budget);
  const selectedMeal = mealPlans[selectedMealDay] || { lunch: '', dinner: '', missing: [] };
  const weekEvents = useMemo(() => events.slice(0, 8), [events]);
  const selfDoneCount = useMemo(() => selfMoments.filter((m) => m.done).length, [selfMoments]);
  const fridgeSorted = useMemo(() => sortFridgeByExpiry(fridge), [fridge]);
  const fridgeAlerts = useMemo(
    () => selectFridgeAlertsWithinHours(fridge, FRIDGE_ALERT_HOURS_AHEAD),
    [fridge],
  );
  const fridgeExpiredCount = useMemo(
    () => fridge.filter((f) => isExpired(f.expires_at)).length,
    [fridge],
  );
  const { active: activeCoupons, expired: expiredCoupons } = useMemo(
    () => partitionCoupons(coupons),
    [coupons],
  );
  const mentalWeather = useMemo(
    () =>
      computeMentalWeather({
        urgentCount,
        openTasksCount: openTasks.length,
        fridgeExpiredCount,
      }),
    [urgentCount, openTasks.length, fridgeExpiredCount],
  );
  const todayUrgencies = useMemo((): TodayUrgency[] => {
    const items: TodayUrgency[] = [];
    fridge
      .filter((f) => isExpired(f.expires_at))
      .slice(0, 2)
      .forEach((f) => {
        items.push({
          id: `fridge-${f.id}`,
          label: `${f.label} — périmé`,
          actionLabel: 'Frigo',
          tone: 'danger',
          onAction: () => {
            setCoursesTab('frigo');
            setOverlay('courses');
          },
        });
      });
    conflicts
      .filter((c) => c.severity === 'high')
      .slice(0, 2)
      .forEach((c, i) => {
        items.push({
          id: `conflict-${i}`,
          label: `Conflit : ${c.title_a} / ${c.title_b}`,
          actionLabel: 'Agenda',
          tone: 'warning',
          onAction: () => {
            setMainTab('agenda');
            setOverlay(null);
          },
        });
      });
    openTasks.slice(0, 3 - items.length).forEach((t) => {
      if (items.length >= 3) return;
      items.push({
        id: `task-${t.id}`,
        label: t.title,
        actionLabel: 'Voir',
        tone: 'warning',
        onAction: () => {
          setMainTab('home');
          setOverlay(null);
        },
      });
    });
    return items.slice(0, 3);
  }, [fridge, conflicts, openTasks]);
  const hubModuleBadges = useMemo((): Partial<Record<HubKey, string>> => {
    const badges: Partial<Record<HubKey, string>> = {};
    if (fridgeExpiredCount > 0) badges.courses = `${fridgeExpiredCount} DLC`;
    const docUrgent = docVault.filter((d) => d.urgent).length;
    if (docUrgent > 0) badges.documents = `${docUrgent}`;
    return badges;
  }, [fridgeExpiredCount, docVault]);
  const showDebordeeCta = useMemo(
    () => openTasks.length >= 5 || mentalWeather.level === 'heavy',
    [openTasks.length, mentalWeather.level],
  );
  const showMorningMoodCard = useMemo(() => {
    if (homeMood !== null) return false;
    const h = new Date().getHours();
    return h >= 5 && h < 12;
  }, [homeMood]);
  const equity = useMemo(
    () =>
      computeDemoEquityShares(openTasks.length, doneTasks.length, familyProfile, {
        terra: C.terra,
        alex: C.alex,
        mint: C.mint,
      }),
    [openTasks.length, doneTasks.length, familyProfile]
  );

  const equityWeeks = useMemo(
    () => [
      { label: 'Cette semaine', joanne: 68, alex: 22, lea: 10, tasks: { joanne: 34, alex: 11, lea: 5 } },
      { label: 'Semaine passée', joanne: 72, alex: 20, lea: 8, tasks: { joanne: 36, alex: 10, lea: 4 } },
      { label: 'Il y a 2 sem.', joanne: 65, alex: 25, lea: 10, tasks: { joanne: 32, alex: 12, lea: 5 } },
      { label: 'Il y a 3 sem.', joanne: 70, alex: 21, lea: 9, tasks: { joanne: 35, alex: 10, lea: 4 } },
    ],
    []
  );
  const equityCategories = useMemo(
    () => [
      { label: 'Cuisine & Repas', joanne: 85, alex: 10, lea: 5, glyph: 'kitchen' },
      { label: 'Linge', joanne: 90, alex: 5, lea: 5, glyph: 'shirt' },
      { label: `École & ${familyProfile.enfant}`, joanne: 75, alex: 20, lea: 5, glyph: 'school' },
      { label: 'Courses', joanne: 60, alex: 35, lea: 5, glyph: 'cart' },
      { label: 'Ménage', joanne: 70, alex: 20, lea: 10, glyph: 'clean' },
      { label: 'Admin & Finance', joanne: 55, alex: 40, lea: 5, glyph: 'admin' },
      { label: 'Santé famille', joanne: 85, alex: 10, lea: 5, glyph: 'health' },
    ],
    [familyProfile.enfant]
  );
  const equitySuggestions = useMemo(
    () => [
      { task: 'Préparer les repas du mercredi', from: familyProfile.prenom, to: familyProfile.partenaire, save: '~45 min/sem' },
      { task: `Gérer les RDV médicaux de ${familyProfile.enfant}`, from: familyProfile.prenom, to: familyProfile.partenaire, save: '~1h/mois' },
      { task: 'Faire sa chambre', from: familyProfile.prenom, to: familyProfile.enfant, save: '~20 min/sem' },
    ],
    [familyProfile.prenom, familyProfile.partenaire, familyProfile.enfant]
  );

  const globalSearchEntries = useMemo((): SearchPaletteEntry[] => {
    const out: SearchPaletteEntry[] = [];
    for (const t of openTasks) {
      out.push({
        id: `task-open-${t.id}`,
        kind: 'task',
        title: t.title,
        subtitle: t.due_at ? `Échéance ${new Date(t.due_at).toLocaleDateString('fr-FR')}` : 'Tâche ouverte',
        onSelect: () => {
          setMainTab('home');
          setOverlay(null);
        },
      });
    }
    for (const t of sortedDoneTasks.slice(0, 25)) {
      out.push({
        id: `task-done-${t.id}`,
        kind: 'task',
        title: t.title,
        subtitle: 'Tâche terminée',
        onSelect: () => {
          setMainTab('home');
          setOverlay(null);
        },
      });
    }
    for (const ev of events.slice(0, 40)) {
      out.push({
        id: `ev-${ev.id}`,
        kind: 'event',
        title: ev.title,
        subtitle: new Date(ev.starts_at).toLocaleString('fr-FR'),
        onSelect: () => {
          setMainTab('agenda');
          setOverlay(null);
        },
      });
    }
    for (const d of docVault.slice(0, 50)) {
      out.push({
        id: `doc-${d.id}`,
        kind: 'document',
        title: d.name,
        subtitle: `${d.cat} · ${d.who}`,
        onSelect: () => {
          setOverlay('documents');
        },
      });
    }
    return out;
  }, [openTasks, sortedDoneTasks, events, docVault]);

  const alexTasksList = useMemo(() => {
    const glyphs = ['g:bin', 'g:shop', 'g:bag', 'g:wrench', 'g:meal'];
    const fromApi = openTasks.slice(0, 5).map((t, i) => ({
      id: t.id,
      icon: glyphs[i % glyphs.length],
      label: t.title,
      urgency: t.due_at ? `Pour le ${new Date(t.due_at).toLocaleDateString('fr-FR')}` : 'Cette semaine',
      color: C.alex,
      assigned_member_id: t.assigned_member_id,
    }));
    if (fromApi.length >= 5) return fromApi;
    const L = familyProfile.enfant;
    const A = familyProfile.partenaire;
    const J = familyProfile.prenom;
    const defaults = [
      { id: -1, icon: 'g:bin', label: 'Sortir les poubelles ce soir', urgency: "Aujourd'hui", color: C.alex },
      { id: -2, icon: 'g:shop', label: 'Courses du samedi (liste prête)', urgency: 'Samedi', color: C.sage },
      { id: -3, icon: 'g:bag', label: `Déposer ${L} à l'école demain`, urgency: 'Demain', color: C.sun },
      { id: -4, icon: 'g:wrench', label: 'Rappeler le plombier', urgency: 'Cette semaine', color: C.terra },
      { id: -5, icon: 'g:meal', label: 'Vider le lave-vaisselle', urgency: 'Ce soir', color: C.alex },
    ];
    const merged = [...fromApi, ...defaults].slice(0, 5);
    return merged.map((x, i) => ({ ...x, id: fromApi[i]?.id ?? x.id }));
  }, [openTasks, familyProfile]);

  async function notifyPartnerReal() {
    if (!token) {
      pushToast('error', 'Connecte-toi pour envoyer une notification au partenaire.');
      return;
    }
    setPartnerNotifyLoading(true);
    try {
      const items = alexTasksList.map((t) => ({
        task_id: t.id > 0 ? t.id : null,
        title: t.label,
      }));
      const res = await postJson<{
        id: number;
        ack_url: string;
        status: string;
        channels: string[];
        message_preview: string;
        tasks_assigned?: number;
      }>(
        '/api/v1/delegations/partner-notify',
        {
          partner_name: familyProfile.partenaire,
          partner_contact: partnerContactDraft.trim() || undefined,
          items,
        },
        token,
      );
      localStorage.setItem('majordome_partner_contact', partnerContactDraft.trim());
      await loadData(token);
      const ch = res.channels?.length ? res.channels.join(', ') : 'log';
      const n = typeof res.tasks_assigned === 'number' ? res.tasks_assigned : 0;
      const assignHint = n > 0 ? `${n} tâche(s) assignées à ${familyProfile.partenaire}. ` : '';
      pushToast('success', `Envoyé (${ch}). ${assignHint}Lien d’accusé copié.`);
      try {
        await navigator.clipboard.writeText(res.ack_url);
      } catch {
        /* ignore */
      }
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setPartnerNotifyLoading(false);
    }
  }

  function goMainTab(t: MainTab) {
    setMainTab(t);
    if (t === 'alfred') {
      setOverlay('assistant');
      return;
    }
    if (t === 'modules') {
      setOverlay('plus');
      return;
    }
    setOverlay(null);
  }

  function handleBottomTab(tab: AppTabId) {
    if (tab === 'home') goMainTab('home');
    else if (tab === 'alfred') goMainTab('alfred');
    else if (tab === 'modules') goMainTab('modules');
    else goMainTab('moi');
  }

  const bottomTabActive: AppTabId = useMemo(() => {
    if (overlay === 'assistant' || mainTab === 'alfred') return 'alfred';
    if (overlay === 'plus' || mainTab === 'modules') return 'modules';
    if (mainTab === 'moi') return 'moi';
    return 'home';
  }, [overlay, mainTab]);

  function openHubModule(hubKey: HubKey) {
    if (hubKey === 'wallet') {
      setCoursesTab('wallet');
      setOverlay('courses');
      return;
    }
    if (hubKey === 'integrations') {
      setOverlay('integrations');
      return;
    }
    setOverlay(hubKey as OverlayId);
  }

  function renderAppLayer() {
    const layer: MainTab | OverlayId =
      overlay ??
      (mainTab === 'modules' ? 'plus' : mainTab === 'alfred' ? 'assistant' : mainTab);
    const sec = (id: HomeSectionId) => homeLayout.sections[id] !== false;
    const wrapOv = (title: string, body: React.ReactNode) => (
      <OverlayChrome title={title} onBack={() => setOverlay(null)} white={C.white} border={C.border} text={C.text}>
        {body}
      </OverlayChrome>
    );

    if (layer === 'home') {
      return (
        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', minHeight: 0, touchAction: 'pan-y' }}>
          {sec('hero_banner') ? (
            <TodayHome
              C={C}
              clientTodayLabel={clientTodayLabel}
              firstName={familyProfile.prenom}
              weather={mentalWeather}
              urgencies={todayUrgencies}
              eventsToday={nextEvents.length}
              openTasksCount={openTasks.length}
              remindersCount={fridgeAlerts.length}
              hubShortcuts={homeLayout.hubShortcuts}
              moduleBadges={hubModuleBadges}
              onOpenHub={openHubModule}
              onOpenAgenda={() => goMainTab('agenda')}
              onOpenTasks={() => {
                setOverlay(null);
                setMainTab('home');
              }}
              onOpenAlfred={() => goMainTab('alfred')}
              onPersonalize={() => setHomeLayoutEditorOpen(true)}
              showPersonalize={Boolean(token)}
              showDebordee={sec('debordee') && showDebordeeCta}
              onDebordee={() => {
                setDebordeeResult(null);
                setModalDebordee('confirm');
              }}
              showMorningMood={sec('mood') && showMorningMoodCard}
              morningMood={homeMood}
              onMorningMood={(i) => {
                setHomeMood(i);
                pushToast('success', 'Humeur enregistrée');
              }}
              partenaireName={familyProfile.partenaire}
            />
          ) : null}
          <div style={{ padding: '0 16px 24px' }}>
          {sec('stats_pair') ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <GlassCard style={{ padding: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: C.terraXL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <IconCalendar size={20} color={C.terra} strokeWidth={1.65} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.terra }}>{nextEvents.length}</div>
              <div style={{ fontSize: 11 }}>Evenements aujourd hui</div>
            </GlassCard>
            <GlassCard style={{ padding: 12 }}>
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
          {sec('hub_shortcuts_row') && homeLayout.hubShortcuts.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.3, marginBottom: 8 }}>MES MODULES</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {homeLayout.hubShortcuts.map((hid) => {
                  const meta = PLUS_HUB_ITEMS.find((x) => x.id === hid);
                  if (!meta) return null;
                  const Hi = meta.Icon;
                  return (
                    <button
                      key={hid}
                      type="button"
                      onClick={() => openHubModule(hid)}
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
          {sec('coffre_strip') ? (
          <GlassCard
            style={{ padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onClick={() => setOverlay('documents')}
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
              <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>{docVault.length} référence(s)</div>
            </div>
            <span style={{ fontSize: 18, fontWeight: 300, color: C.terra, flexShrink: 0 }} aria-hidden>
              ›
            </span>
          </GlassCard>
          ) : null}
          {sec('equity') ? (
          <GlassCard style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconScale size={16} color={C.text} strokeWidth={1.65} />
                <strong style={{ fontSize: 13 }}>Répartition du foyer</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, color: C.text2 }}>
                  {taskSummary != null ? (
                    <>
                      {taskSummary.open_count} ouv. · {taskSummary.done_count} fait · {tasks.length} chargée(s)
                    </>
                  ) : (
                    <>{tasks.length} taches</>
                  )}
                </span>
                <button
                  type="button"
                  disabled={!token || taskSummaryRefreshing}
                  title="Rafraîchir les compteurs serveur"
                  onClick={() => void refreshTaskSummary({ trackBusy: true })}
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
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>
              {equity[0].pct > 50
                ? `Alerte déséquilibre : ${familyProfile.prenom} porte encore trop la charge.`
                : 'Répartition en progression.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={partnerContactDraft}
                onChange={(e) => setPartnerContactDraft(e.target.value)}
                placeholder={`Mobile (+33…) ou e-mail de ${familyProfile.partenaire} (optionnel)`}
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
                Sans contact : la liste part au journal serveur (logs). Avec Twilio / SMTP configurés côté API : SMS ou e-mail réel + relances automatiques.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setEquitePlanText('');
                  setEquiteTab('semaine');
                  setModalEquite(true);
                }}
                style={{ borderRadius: 10, border: 'none', padding: '8px 10px', background: C.terraXL, color: C.terra, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconScale size={14} color={C.terra} strokeWidth={1.65} />
                Score équité hebdo
              </button>
              <button
                type="button"
                disabled={partnerNotifyLoading}
                onClick={() => void notifyPartnerReal()}
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
                    Notifier {familyProfile.partenaire}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAlexDoneIds([]);
                  setAlexNotified(false);
                  setModalAlex(true);
                }}
                style={{ borderRadius: 10, border: 'none', padding: '8px 10px', background: C.alexL, color: C.alex, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconUserOutline size={14} color={C.alex} strokeWidth={1.65} />
                Espace {familyProfile.partenaire}
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
                Vue {familyProfile.partenaire}
              </Link>
            </div>
            <button
              type="button"
              onClick={() => alfred.setAssistantInput(`Rédige un message WhatsApp à ${familyProfile.partenaire} pour déléguer 2 tâches aujourd'hui`)}
              style={{ marginTop: 8, borderRadius: 10, border: 'none', padding: '8px 10px', background: C.terraXL, color: C.terra, fontSize: 11, fontWeight: 700 }}
            >
              Déléguer en 1 tap (WhatsApp)
            </button>
          </GlassCard>
          ) : null}
          {sec('debordee') && !sec('hero_banner') ? (
          <GlassCard style={{ padding: 14, marginBottom: 14, background: C.redL, border: `1.5px solid ${C.red}55` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconLifebuoy size={18} color={C.red} strokeWidth={1.65} />
              Mode « Je suis débordée »
            </div>
            <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
              Alfred analyse toute ta liste, garde l&apos;urgent pour aujourd&apos;hui, propose du relais vers {familyProfile.partenaire}, et allège le reste.
            </p>
            <button
              type="button"
              onClick={() => {
                setDebordeeResult(null);
                setModalDebordee('confirm');
              }}
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
          {sec('budget') ? (
          <GlassCard style={{ padding: 14, marginBottom: 14 }} onClick={() => goMainTab('moi')}>
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
          {sec('mood') && !sec('hero_banner') ? (
          <GlassCard style={{ padding: 14, marginBottom: 14, background: C.lilacL }}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 8, fontWeight: 700 }}>COMMENT TU TE SENS CE MATIN ?</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {['😴', '😟', '😐', '🙂', '😄'].map((m, i) => (
                <button key={m} type="button" aria-label={`Humeur ${i + 1} sur 5`} onClick={() => setHomeMood(i)} style={{ border: 'none', background: homeMood === i ? C.white : 'transparent', borderRadius: 10, padding: '6px 8px' }}>
                  {m}
                </button>
              ))}
            </div>
          </GlassCard>
          ) : null}
          {sec('alfred_teaser') ? (
          <GlassCard style={{ padding: 14, marginBottom: 14, background: C.terraXL }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra }}>{aiName.toUpperCase()}</div>
            <p style={{ fontSize: 13, margin: '6px 0', color: C.text }}>Conflits détectés : je peux proposer un plan en 1 clic via le bouton {aiName} (centre) ou depuis Plus.</p>
            <button onClick={() => setOverlay('assistant')} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: C.terra, color: '#fff', fontWeight: 700 }}>Ouvrir {aiName}</button>
          </GlassCard>
          ) : null}
          {sec('agenda_snippet') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18 }} onClick={() => goMainTab('agenda')}>
            <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconCalendar size={18} color={C.terra} strokeWidth={1.65} />
              Cette semaine
            </strong>
            <div style={{ marginTop: 8, fontSize: 12, color: C.text2 }}>
              {weekEvents.slice(0, 5).map((e) => (
                <div key={e.id} style={{ marginBottom: 6 }}>{new Date(e.starts_at).toLocaleDateString('fr-FR')} · {e.title}</div>
              ))}
            </div>
          </GlassCard>
          ) : null}

          {sec('tasks_feed') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>Tes taches</strong>
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
                        → {familyProfile.prenom}
                      </Pill>
                    ) : null}
                    {partnerMemberId != null && t.assigned_member_id === partnerMemberId ? (
                      <Pill bg={C.alexXL} color={C.alex}>
                        → {familyProfile.partenaire}
                      </Pill>
                    ) : null}
                    {childMemberId != null && t.assigned_member_id === childMemberId ? (
                      <Pill bg="#FFF8E8" color="#B8860B">
                        → {familyProfile.enfant}
                      </Pill>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: C.text2 }}>{t.due_at ? new Date(t.due_at).toLocaleString('fr-FR') : 'Sans echeance'}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <TaskAssignSelect
                      taskId={t.id}
                      assigned_member_id={t.assigned_member_id}
                      members={householdMembers}
                      token={token}
                      busy={taskAssignBusyId === t.id}
                      onAssign={assignTaskMember}
                      compact
                    />
                    <TaskDoneButton taskId={t.id} token={token} busyDone={taskCompleteBusyId === t.id} onDone={completeTaskById} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          ) : null}

          {sec('self_care') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18, background: C.lilacL, border: `1.5px solid ${C.lilac}40` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.lilac, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconHeartOutline size={17} color={C.lilac} strokeWidth={1.65} />
              Et toi, dans tout ça ?
            </div>
            <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
              Tu n as rien planifie pour toi cette semaine. Tu merites aussi une pause - je peux t aider a trouver un creneau.
            </p>
            <button
              onClick={() => {
                goMainTab('moi');
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
          {sec('priorities') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18 }}>
            <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconTarget size={17} color={C.text} strokeWidth={1.65} />
              Priorites du jour
            </strong>
            <div style={{ marginTop: 8 }}>
              {openTasks.slice(0, 4).map((t) => (
                <div key={t.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span>{t.title}</span>
                  {primaryMemberId != null && t.assigned_member_id === primaryMemberId ? (
                    <Pill bg={C.terraXL} color={C.terra}>
                      → {familyProfile.prenom}
                    </Pill>
                  ) : null}
                  {partnerMemberId != null && t.assigned_member_id === partnerMemberId ? (
                    <Pill bg={C.alexXL} color={C.alex}>
                      → {familyProfile.partenaire}
                    </Pill>
                  ) : null}
                  {childMemberId != null && t.assigned_member_id === childMemberId ? (
                    <Pill bg="#FFF8E8" color="#B8860B">
                      → {familyProfile.enfant}
                    </Pill>
                  ) : null}
                  <TaskAssignSelect
                    taskId={t.id}
                    assigned_member_id={t.assigned_member_id}
                    members={householdMembers}
                    token={token}
                    busy={taskAssignBusyId === t.id}
                    onAssign={assignTaskMember}
                    compact
                  />
                  <TaskDoneButton taskId={t.id} token={token} busyDone={taskCompleteBusyId === t.id} onDone={completeTaskById} />
                </div>
              ))}
              {openTasks.length === 0 ? <div style={{ fontSize: 12, color: C.text2 }}>Aucune priorite en attente.</div> : null}
            </div>
          </GlassCard>
          ) : null}
          {sec('recent_done') ? (
          <RecentDoneTasksCard
            sortedDone={sortedDoneTasks}
            token={token}
            reopenBusyId={taskReopenBusyId}
            onReopen={reopenTaskById}
            onRefreshDoneFromServer={refreshDoneTasksFromServer}
            refreshDoneBusy={doneHistoryRefreshBusy}
            onLoadMoreDonePage={loadMoreDoneTasksPage}
            loadMoreDoneBusy={doneHistoryMoreBusy}
            donePagingExhausted={doneHistoryPagingExhausted}
            serverDoneTotal={taskSummary?.done_count ?? null}
          />
          ) : null}
          {sec('opportunities') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18 }}>
            <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconGift size={17} color={C.text} strokeWidth={1.65} />
              Opportunites utiles
            </strong>
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
          {sec('child_tracking') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18 }}>
            <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconChild size={17} color={C.text} strokeWidth={1.65} />
              {familyProfile.enfant} — Suivi enfant
            </strong>
            <div style={{ marginTop: 8, fontSize: 12, color: C.text2 }}>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconHealthCross size={14} color={C.sage} strokeWidth={1.65} />
                Traitement en cours: Doliprane si fièvre
              </div>
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCalendar size={14} color={C.terra} strokeWidth={1.65} />
                Prochain RDV: {weekEvents[0] ? new Date(weekEvents[0].starts_at).toLocaleDateString('fr-FR') : 'A planifier'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconSchoolBag size={14} color={C.sun} strokeWidth={1.65} />
                Devoirs/liaison: vérifier cahier ce soir
              </div>
            </div>
          </GlassCard>
          ) : null}
          {sec('relief_checklist') ? (
          <GlassCard style={{ padding: 14, marginBottom: 18 }}>
            <strong style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconBrainOutline size={17} color={C.text} strokeWidth={1.65} />
              Ce qui manque pour soulager 100%
            </strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: C.text2 }}>
              <li>Connecter Pronote/Skolengo (À venir)</li>
              <li>Activer Doctolib prise de RDV 1 tap (À venir)</li>
              <li>Automatiser notifications partenaire WhatsApp natif (À venir)</li>
              <li>Bridge vocal Alexa / Google Home / Siri (À venir)</li>
            </ul>
          </GlassCard>
          ) : null}
          </div>
        </div>
      );
    }

    if (layer === 'agenda') {
      const googleConnected = accounts.some((a) => a.provider === 'google_calendar' && a.status === 'connected');
      const appleConnected = accounts.some((a) => a.provider === 'apple_calendar' && a.status === 'connected');
      const appleSyncPossible = appleConnected && appleCaldavAvailable !== false;
      return (
        <div style={{ padding: '14px 18px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', minHeight: 0, touchAction: 'pan-y' }}>
          <h2 style={{ margin: '0 0 10px', color: C.text }}>Agenda familial</h2>
          <GlassCard style={{ padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Ajouter depuis l application</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
                Titre
                <input id="event-title" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Ex. RDV pédiatre" style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
                Début
                <input id="event-start" value={newEventStart} onChange={(e) => setNewEventStart(e.target.value)} type="datetime-local" style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
                Fin
                <input id="event-end" value={newEventEnd} onChange={(e) => setNewEventEnd(e.target.value)} type="datetime-local" style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }} />
              </label>
              {appleConnected && appleCaldavAvailable === false ? (
                <div style={{ fontSize: 11, color: C.sun, lineHeight: 1.4, padding: '6px 8px', borderRadius: 10, background: '#FFF8E6', border: `1px solid ${C.border}` }}>
                  Apple : synchronisation indisponible sur ce serveur — événements seulement dans l’app (voir Paramètres → Connexions).
                </div>
              ) : null}
              <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
                Synchroniser avec
                <select id="event-provider" value={newEventProvider} onChange={(e) => setNewEventProvider(e.target.value as 'none' | 'google_calendar' | 'apple_calendar')} style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }}>
                  <option value="google_calendar" disabled={!googleConnected}>Google Calendar</option>
                  <option value="apple_calendar" disabled={!appleSyncPossible}>Apple Calendar</option>
                  <option value="none">Application seulement</option>
                </select>
              </label>
              <button onClick={createEventFromApp} disabled={creatingEvent} style={{ borderRadius: 10, border: 'none', background: C.terra, color: '#fff', padding: 8, fontWeight: 700 }}>
                {creatingEvent ? 'Creation...' : 'Creer evenement'}
              </button>
            </div>
          </GlassCard>
          <GlassCard style={{ padding: 12, marginBottom: 10, background: C.sageL }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconMeal size={16} color={C.sage} strokeWidth={1.65} />
              Plan repas (jour)
            </div>
            <input
              type="date"
              value={selectedMealDay}
              onChange={(e) => setSelectedMealDay(e.target.value)}
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 6 }}
            />
            <input
              placeholder="Repas midi"
              value={selectedMeal.lunch}
              onChange={(e) =>
                setMealPlans((m) => ({ ...m, [selectedMealDay]: { ...selectedMeal, lunch: e.target.value } }))
              }
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 6 }}
            />
            <input
              placeholder="Repas soir"
              value={selectedMeal.dinner}
              onChange={(e) =>
                setMealPlans((m) => ({ ...m, [selectedMealDay]: { ...selectedMeal, dinner: e.target.value } }))
              }
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 6 }}
            />
            <input
              placeholder="Ingredients manquants (virgules)"
              value={selectedMeal.missing.join(', ')}
              onChange={(e) =>
                setMealPlans((m) => ({
                  ...m,
                  [selectedMealDay]: {
                    ...selectedMeal,
                    missing: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                  },
                }))
              }
              style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, width: '100%', marginBottom: 8 }}
            />
            <button
              onClick={() => {
                const missingToAdd = selectedMeal.missing.filter((it) => !courses.some((c) => c.label.toLowerCase() === it.toLowerCase()));
                if (missingToAdd.length === 0) {
                  setInfo('Aucun ingredient nouveau a ajouter.');
                  return;
                }
                for (const it of missingToAdd) void addCourseItem(it);
                setInfo('Ingredients ajoutes a Courses.');
              }}
              style={{ borderRadius: 10, border: 'none', background: C.sage, color: '#fff', padding: 8, fontWeight: 700, width: '100%' }}
            >
              Generer courses depuis repas
            </button>
          </GlassCard>
          <GlassCard style={{ padding: 12, marginBottom: 10, background: C.terraXL }}>
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span>{t.title}</span>
                    {primaryMemberId != null && t.assigned_member_id === primaryMemberId ? (
                      <Pill bg={C.terraXL} color={C.terra}>
                        → {familyProfile.prenom}
                      </Pill>
                    ) : null}
                    {partnerMemberId != null && t.assigned_member_id === partnerMemberId ? (
                      <Pill bg={C.alexXL} color={C.alex}>
                        → {familyProfile.partenaire}
                      </Pill>
                    ) : null}
                    {childMemberId != null && t.assigned_member_id === childMemberId ? (
                      <Pill bg="#FFF8E8" color="#B8860B">
                        → {familyProfile.enfant}
                      </Pill>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>{t.due_at ? new Date(t.due_at).toLocaleString('fr-FR') : 'Sans échéance'}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <TaskAssignSelect
                      taskId={t.id}
                      assigned_member_id={t.assigned_member_id}
                      members={householdMembers}
                      token={token}
                      busy={taskAssignBusyId === t.id}
                      onAssign={assignTaskMember}
                      compact
                    />
                    <TaskDoneButton taskId={t.id} token={token} busyDone={taskCompleteBusyId === t.id} onDone={completeTaskById} />
                  </div>
                </div>
              ))
            )}
          </GlassCard>
          <RecentDoneTasksCard
            sortedDone={sortedDoneTasks}
            token={token}
            reopenBusyId={taskReopenBusyId}
            onReopen={reopenTaskById}
            compact
            onRefreshDoneFromServer={refreshDoneTasksFromServer}
            refreshDoneBusy={doneHistoryRefreshBusy}
            onLoadMoreDonePage={loadMoreDoneTasksPage}
            loadMoreDoneBusy={doneHistoryMoreBusy}
            donePagingExhausted={doneHistoryPagingExhausted}
            serverDoneTotal={taskSummary?.done_count ?? null}
          />
          {urgentCount > 0 ? (
            <div style={{ background: C.redL, padding: 10, borderRadius: 12, color: C.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconAlertOutline size={18} color={C.red} strokeWidth={1.65} />
              {urgentCount} conflit(s) detecte(s)
            </div>
          ) : null}
          {nextEvents.map((e) => (
            <GlassCard key={e.id} style={{ padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.title}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{new Date(e.starts_at).toLocaleString('fr-FR')}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button onClick={() => beginEdit(e)} style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, fontSize: 11, padding: '4px 8px' }}>
                  Modifier
                </button>
                <button onClick={() => deleteEventFromApp(e.id)} style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, fontSize: 11, padding: '4px 8px' }}>
                  Annuler
                </button>
              </div>
            </GlassCard>
          ))}
          {editingEventId !== null ? (
            <GlassCard style={{ padding: 12, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Modifier l evenement</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Titre evenement" style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }} />
                <input value={editStart} onChange={(e) => setEditStart(e.target.value)} type="datetime-local" style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }} />
                <input value={editEnd} onChange={(e) => setEditEnd(e.target.value)} type="datetime-local" style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: 8 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveEditEvent} style={{ borderRadius: 10, border: 'none', background: C.terra, color: '#fff', padding: 8, fontWeight: 700 }}>Enregistrer</button>
                  <button onClick={() => setEditingEventId(null)} style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', color: C.text2, padding: 8 }}>Annuler</button>
                </div>
              </div>
            </GlassCard>
          ) : null}
        </div>
      );
    }

    if (layer === 'courses') {
      return wrapOv(
        'Courses & Frigo',
        <CoursesPanel
          C={C}
          coursesTab={coursesTab}
          setCoursesTab={setCoursesTab}
          courses={courses}
          newCourse={newCourse}
          setNewCourse={setNewCourse}
          doneCourses={doneCourses}
          fridgeSorted={fridgeSorted}
          fridgeAlertsCount={fridgeAlerts.length}
          fridgeExpiredCount={fridgeExpiredCount}
          activeCoupons={activeCoupons}
          expiredCoupons={expiredCoupons}
          walletCards={walletCards}
          partnerName={familyProfile.partenaire}
          onAddCourse={() => {
            if (!newCourse.trim()) return;
            void addCourseItem(newCourse.trim());
            setNewCourse('');
            pushToast('success', 'Article ajouté à la liste');
          }}
          onToggleCourse={(id, nextDone) => void toggleCourseItem(id, nextDone)}
          onRemoveCourse={(id) => void removeCourseItem(id)}
          onDelegateCourse={(id) => void delegateCourseItem(id)}
          onClearDoneCourses={() => void clearDoneCourseItems()}
          onRemoveFridgeItem={(id) => void removeFridgeItem(id)}
          pushToast={pushToast}
        />,
      );
    }

    if (layer === 'maison') {
      return wrapOv(
        'Maison',
        <div style={{ padding: '14px 18px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', minHeight: 0, touchAction: 'pan-y' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <IconHouseCare size={26} color={C.terra} strokeWidth={1.65} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
                Domotique, extérieur et routines du foyer — tout ce qui concerne le logement (pas les courses).
              </p>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.6, margin: '0 0 8px' }}>DOMOTIQUE & ÉQUIPEMENTS</div>
          <GlassCard style={{ padding: 14, marginBottom: 12, background: C.alexL, border: `1.5px solid ${C.alex}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <IconSmartHome size={22} color={C.alex} strokeWidth={1.65} />
              <strong style={{ fontSize: 13, color: C.alex }}>Maison connectée</strong>
            </div>
            <p style={{ fontSize: 12, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              Ici vivront les connexions vers tes équipements : éclairage, chauffage, volets, alarme, prises, Matter / Home Assistant, etc. Ce n&apos;est pas encore branché au backend : on définit l&apos;emplacement dans l&apos;app pour que la famille s&apos;y retrouve.
            </p>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['Éclairage', 'Chauffage', 'Volets', 'Alarme', 'Prises', 'Scénarios'] as const).map((label) => (
                <Pill key={label} bg={C.white} color={C.alex}>
                  {label}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                alfred.setAssistantInput(
                  `Pour la domotique du foyer : propose un plan simple (priorités + sécurité) pour ${familyProfile.prenom}, sans installer de matériel.`,
                );
                setOverlay('assistant');
              }}
              style={{
                marginTop: 12,
                width: '100%',
                borderRadius: 12,
                border: `1px solid ${C.alex}`,
                padding: '10px 12px',
                background: C.white,
                color: C.alex,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              En parler avec {aiName}
            </button>
          </GlassCard>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.6, margin: '14px 0 8px' }}>JARDIN & EXTÉRIEUR</div>
          <GlassCard style={{ padding: 14, marginBottom: 12, background: C.sageL, border: `1.5px solid ${C.sage}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <IconLeaf size={22} color={C.sage} strokeWidth={1.65} />
              <strong style={{ fontSize: 13, color: C.sage }}>Extérieur</strong>
            </div>
            <p style={{ fontSize: 12, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              Arrosage, tonte, compost : zone dédiée pour remplir l&apos;écran « vide » actuel. Prochaine étape : lier des rappels météo et un calendrier d&apos;entretien.
            </p>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill bg={C.white} color={C.sage}>
                Arrosage
              </Pill>
              <Pill bg={C.white} color={C.sage}>
                Plants saison
              </Pill>
              <Pill bg={C.white} color={C.sage}>
                Outils
              </Pill>
            </div>
          </GlassCard>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, letterSpacing: 0.6, margin: '14px 0 8px' }}>ROUTINES DU FOYER</div>
          <GlassCard style={{ padding: 12, marginBottom: 10, background: C.terraXL }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Matin · {morningPct}%</div>
            <div style={{ height: 8, background: C.surface3, borderRadius: 8, marginTop: 6 }}>
              <div style={{ width: `${morningPct}%`, height: '100%', background: C.terra, borderRadius: 8 }} />
            </div>
          </GlassCard>
          {['Aérer', 'Machine', `Cartable ${familyProfile.enfant}`].map((label, idx) => (
            <GlassCard key={label} style={{ padding: 12, marginBottom: 8, background: morningDone[idx] ? C.greenL : C.white }}>
              <button onClick={() => setMorningDone((v) => v.map((x, i) => (i === idx ? !x : x)))} style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, display: 'flex', justifyContent: 'center' }}>{morningDone[idx] ? <IconCheckSmall size={16} color={C.green} /> : <IconCircleOutline size={16} color={C.text3} />}</span>
                <span>{label}</span>
              </button>
            </GlassCard>
          ))}
          <GlassCard style={{ padding: 12, marginTop: 12, marginBottom: 10, background: C.sageL }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Soir · {eveningPct}%</div>
            <div style={{ height: 8, background: C.surface3, borderRadius: 8, marginTop: 6 }}>
              <div style={{ width: `${eveningPct}%`, height: '100%', background: C.sage, borderRadius: 8 }} />
            </div>
          </GlassCard>
          {['Ranger salon', 'Préparer affaires', 'Lave-vaisselle'].map((label, idx) => (
            <GlassCard key={label} style={{ padding: 12, marginBottom: 8, background: eveningDone[idx] ? C.greenL : C.white }}>
              <button onClick={() => setEveningDone((v) => v.map((x, i) => (i === idx ? !x : x)))} style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, display: 'flex', justifyContent: 'center' }}>{eveningDone[idx] ? <IconCheckSmall size={16} color={C.green} /> : <IconCircleOutline size={16} color={C.text3} />}</span>
                <span>{label}</span>
              </button>
            </GlassCard>
          ))}
        </div>,
      );
    }

    if (layer === 'documents') {
      return wrapOv(
        'Coffre famille',
        <div style={{ padding: '14px 18px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', minHeight: 0, touchAction: 'pan-y' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: C.sageL, border: `1px solid ${C.sage}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconFolderVault size={28} color={C.sage} strokeWidth={1.65} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                Stockage des références foyer (contrats, santé, identité). Ce n&apos;est pas Google Drive : tout reste dans MajorDome ; connexion CalDAV / Drive pourrait être ajoutée côté API plus tard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalCoffre(true)}
            style={{ marginBottom: 12, width: '100%', borderRadius: 14, border: 'none', padding: '12px 14px', background: C.terra, color: '#fff', fontSize: 13, fontWeight: 800 }}
          >
            Ouvrir le coffre complet ({docVault.length})
          </button>
          {!token ? <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px' }}>Connecte-toi pour synchroniser les documents du foyer.</p> : null}
          {docVault.slice(0, 12).map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: `1px solid ${C.border}`,
                padding: '10px 0',
              }}
            >
              <DocGlyphBubble icon={d.icon} />
              <button
                type="button"
                onClick={() => {
                  setModalCoffre(true);
                  openDocEdit(d);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minWidth: 0,
                  border: 'none',
                  padding: 0,
                  background: 'transparent',
                  cursor: token ? 'pointer' : 'default',
                  textAlign: 'left',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <Pill bg={C.surface} color={C.sage}>
                  {docCategoryLabel(d.cat)}
                </Pill>
              </button>
              {d.attachmentSizeBytes && token ? (
                <button
                  type="button"
                  aria-label="Télécharger la pièce jointe"
                  title="Télécharger"
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadDocAttachment(d.id);
                  }}
                  style={{
                    flexShrink: 0,
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    border: `1px solid ${C.sage}`,
                    background: C.white,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconPaperclip size={18} color={C.sage} strokeWidth={1.65} />
                </button>
              ) : null}
            </div>
          ))}
          {token && docStorageSummary ? (
            <p style={{ fontSize: 11, color: C.text3, marginTop: 14, textAlign: 'center' }}>
              {formatDocStorageShort(docStorageSummary.used_bytes, docStorageSummary.quota_bytes)}
            </p>
          ) : null}
        </div>,
      );
    }

    if (layer === 'moi') {
      return (
        <div style={{ padding: '14px 18px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', minHeight: 0, touchAction: 'pan-y' }}>
          <GlassCard style={{ padding: 14, marginBottom: 12, background: C.surface }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 8 }}>Compte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="/settings" style={{ fontSize: 13, fontWeight: 700, color: C.terra, textDecoration: 'none' }}>
                Paramètres et connexions
              </a>
              <button type="button" onClick={logout} style={{ alignSelf: 'flex-start', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Déconnexion
              </button>
            </div>
          </GlassCard>
          <h2 style={{ margin: '0 0 10px', color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconHeartOutline size={22} color={C.lilac} strokeWidth={1.65} />
            Moi d&apos;abord
          </h2>
          <GlassCard style={{ padding: 12, marginBottom: 10, background: C.lilacL }}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>Humeur du jour</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              {(
                [
                  { emoji: '😴', label: 'Épuisée' },
                  { emoji: '😟', label: 'Stressée' },
                  { emoji: '😐', label: 'Ok' },
                  { emoji: '🙂', label: 'Bien' },
                  { emoji: '😄', label: 'Super' },
                ] as const
              ).map((m, i) => (
                <button
                  key={m.emoji}
                  type="button"
                  aria-label={m.label}
                  onClick={() => {
                    setMoiMood(i);
                    pushToast('success', 'Humeur enregistrée ✓');
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
          <GlassCard style={{ padding: 12, marginBottom: 10 }}>
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
              onChange={(e) => setSleep(Number(e.target.value))}
              aria-valuemin={3}
              aria-valuemax={11}
              aria-valuenow={sleep}
              style={{ width: '100%' }}
            />
          </GlassCard>
          <CollapsibleSection title="Mon cycle" C={C}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>Jour J{cycleDay} de ton cycle</div>
            <input
              type="range"
              min={1}
              max={28}
              step={1}
              value={cycleDay}
              onChange={(e) => setCycleDay(Number(e.target.value))}
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
          <CollapsibleSection title="Mon journal" C={C}>
            <textarea
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              aria-label="Micro-journal du jour"
              placeholder="Ce qui t'a fait du bien aujourd'hui…"
              style={{ width: '100%', minHeight: 70, borderRadius: 10, border: `1px solid ${C.border}`, padding: 8, resize: 'none', fontSize: 14 }}
            />
          </CollapsibleSection>
          <GlassCard style={{ padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconHeartOutline size={15} color={C.lilac} strokeWidth={1.65} />
              Moments pour toi ({selfDoneCount}/{selfMoments.length})
            </div>
            {selfMoments.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <button
                  type="button"
                  aria-label={m.done ? 'Marquer non fait' : 'Marquer fait'}
                  onClick={() => setSelfMoments((prev) => prev.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 8px', background: m.done ? C.greenL : C.white, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }}
                >
                  {m.done ? <IconCheckSmall size={13} color={C.green} /> : <IconCircleOutline size={13} color={C.text3} />}
                </button>
                <span style={{ flex: 1, fontSize: 12, color: m.done ? C.green : C.text }}>{m.label}</span>
                <button
                  type="button"
                  onClick={() => addSelfMomentAsTask(m.label)}
                  style={{ border: 'none', borderRadius: 8, padding: '8px 10px', background: C.terraXL, color: C.terra, fontSize: 11, fontWeight: 700, minHeight: 44 }}
                >
                  + Tâche
                </button>
              </div>
            ))}
          </GlassCard>
          <GlassCard style={{ padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconWallet size={15} color={C.text} strokeWidth={1.65} />
                Budget du mois
              </div>
              <button
                type="button"
                onClick={() => {
                  if (budgetEditing) {
                    pushToast('success', 'Budget enregistré ✓');
                  }
                  setBudgetEditing((v) => !v);
                }}
                style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 10px', background: C.white, fontSize: 11, fontWeight: 700, color: C.terra, cursor: 'pointer' }}
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
                          value={b.spent}
                          onChange={(e) =>
                            setBudget((prev) => prev.map((x) => (x.id === b.id ? { ...x, spent: Number(e.target.value || 0) } : x)))
                          }
                          style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}`, padding: 6, marginTop: 2 }}
                        />
                      </label>
                      <label style={{ fontSize: 10, color: C.text2 }}>
                        Budget
                        <input
                          type="number"
                          value={b.budget}
                          onChange={(e) =>
                            setBudget((prev) => prev.map((x) => (x.id === b.id ? { ...x, budget: Number(e.target.value || 0) } : x)))
                          }
                          style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}`, padding: 6, marginTop: 2 }}
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
          <GlassCard style={{ padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconChart size={15} color={C.text} strokeWidth={1.65} />
              Stats bien-être hebdo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>Humeur moyenne: {['😴', '😟', '😐', '🙂', '😄'][moiMood]}</div>
              <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>Sommeil moyen: {sleep.toFixed(1)}h</div>
              <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>Moments faits: {selfDoneCount}</div>
              <div style={{ background: C.surface, borderRadius: 10, padding: 8, fontSize: 11 }}>Cycle: J{cycleDay}</div>
            </div>
          </GlassCard>
          <GlassCard style={{ padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Suggestion {aiName}</div>
            <div style={{ fontSize: 12, color: C.text2 }}>
              Tu as {openTasks.length} tache(s) ouverte(s). Prends 20 min pour toi avant 20h, puis je te relance.
            </div>
          </GlassCard>
        </div>
      );
    }

    if (layer === 'famille') {
      return wrapOv(
        'Famille & équité',
        <div style={{ padding: '14px 18px', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
          <GlassCard style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 8 }}>Répartition visible</div>
            <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
              {equity.map((e) => (
                <div key={e.name} style={{ flex: Math.max(e.pct, 1), background: e.color }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {equity.map((e) => (
                <Pill key={e.name} bg={`${e.color}20`} color={e.color}>
                  {e.name} {e.pct}%
                </Pill>
              ))}
            </div>
            <input
              type="text"
              value={partnerContactDraft}
              onChange={(e) => setPartnerContactDraft(e.target.value)}
              placeholder={`Mobile ou e-mail de ${familyProfile.partenaire} (optionnel)`}
              autoComplete="tel email"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                fontSize: 12,
                background: C.surface,
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setEquitePlanText('');
                  setEquiteTab('semaine');
                  setModalEquite(true);
                }}
                style={{
                  borderRadius: 10,
                  border: 'none',
                  padding: '8px 10px',
                  background: C.terraXL,
                  color: C.terra,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Score équité hebdo
              </button>
              <button
                type="button"
                disabled={partnerNotifyLoading}
                onClick={() => void notifyPartnerReal()}
                style={{
                  borderRadius: 10,
                  border: 'none',
                  padding: '8px 10px',
                  background: C.alex,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: partnerNotifyLoading ? 0.65 : 1,
                }}
              >
                {partnerNotifyLoading ? 'Envoi…' : `Notifier ${familyProfile.partenaire}`}
              </button>
              <button type="button" onClick={() => goMainTab('moi')} style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: '8px 10px', background: C.white, fontSize: 11, fontWeight: 700, color: C.text2 }}>
                Zone « Moi »
              </button>
            </div>
          </GlassCard>
          <p style={{ fontSize: 11, color: C.text3, lineHeight: 1.45, margin: 0 }}>
            La carte complète charge mentale reste sur l&apos;accueil ; ici, raccourcis depuis le hub Plus.
          </p>
        </div>,
      );
    }

    if (layer === 'recettes') {
      return wrapOv(
        'Recettes',
        <RecettesPanel
          C={C}
          onAddIngredients={(labels) => {
            const lower = new Set(courses.map((c) => c.label.toLowerCase()));
            const unique = labels.filter((l) => !lower.has(l.toLowerCase()));
            if (unique.length === 0) {
              pushToast('info', 'Déjà présents dans la liste courses.');
              return;
            }
            for (const label of unique) void addCourseItem(label);
            pushToast('success', `${unique.length} ingrédient(s) ajouté(s) à la liste`);
          }}
        />,
      );
    }

    if (layer === 'routines') {
      return wrapOv('Routines', <RoutinesPanel C={C} userName={familyProfile.prenom} />);
    }

    if (layer === 'courrier') {
      return wrapOv(
        'Courrier IA',
        <CourrierPanel C={C} token={token} busy={courrierImportBusy} onImportTasks={importCourrierTaskTitles} />,
      );
    }

    if (layer === 'albums') {
      return wrapOv('Souvenirs', <AlbumsPanel C={C} />);
    }

    if (layer === 'anniversaires') {
      return wrapOv('Anniversaires', <AnniversairesPanel C={C} />);
    }

    if (layer === 'poubelles') {
      return wrapOv('Poubelles & collecte', <PoubellesPanel C={C} />);
    }

    if (layer === 'messages') {
      return wrapOv(
        'Famille temps réel',
        <FamilleTempsReelPanel C={C} partenaire={familyProfile.partenaire} enfant={familyProfile.enfant} />,
      );
    }

    if (layer === 'notifs') {
      return wrapOv('Notifications', <NotifsStubPanel C={C} />);
    }

    if (layer === 'integrations') {
      const googleConnected = accounts.some((a) => a.provider === 'google_calendar' && a.status === 'connected');
      return wrapOv(
        'Intégrations tierces',
        <div>
          <GlassCard style={{ padding: 12, marginBottom: 10, background: C.terraXL }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Google Calendar</div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: C.text2 }}>
              {googleConnected ? 'Connecté — tes événements se synchronisent.' : 'Connecte ton agenda pour remplir automatiquement ton planning.'}
            </p>
            <button
              type="button"
              onClick={() => void connectGoogleCalendar()}
              style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: C.terra, color: '#fff', fontWeight: 700, fontSize: 12 }}
            >
              {googleConnected ? 'Reconnecter Google' : 'Connecter Google Calendar'}
            </button>
          </GlassCard>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
            Raccourcis web et messages Alfred pour les autres services.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" onClick={() => window.open('https://www.doctolib.fr/', '_blank')} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}>Doctolib (web)</button>
            <button type="button" onClick={() => window.open('https://www.pronote.com/', '_blank')} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}>Pronote / ENT (web)</button>
            <button type="button" onClick={() => window.open('https://www.picnic.app/fr/', '_blank')} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}>Picnic / Instacart</button>
            <button
              type="button"
              onClick={() => alfred.setAssistantInput(`Prépare un message WhatsApp pour ${familyProfile.partenaire} pour répartir les tâches de ce soir`)}
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}
            >
              Msg WhatsApp (Alfred)
            </button>
            <button type="button" onClick={() => alfred.setAssistantInput('Crée une routine vocale Alexa et Google Home pour rappel tâches')} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}>Alexa/Home/Siri</button>
            <button type="button" onClick={() => { window.location.href = '/settings'; }} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.terraXL, color: C.terra, fontSize: 11, fontWeight: 700 }}>Configurer connexions</button>
          </div>
        </div>,
      );
    }

    if (layer === 'plus') {
      return (
        <PlusHub
          C={C}
          userFirstName={familyProfile.prenom || undefined}
          alfredNoteCount={alfredMemory.length}
          onOpen={(id) => {
            if (id === 'wallet') {
              setCoursesTab('wallet');
              setOverlay('courses');
              return;
            }
            if (id === 'integrations') {
              setOverlay('integrations');
              return;
            }
            setOverlay(id as OverlayId);
          }}
        />
      );
    }

    if (layer === 'assistant') {
      return (
        <AlfredChatPanel
          C={C}
          aiName={aiName}
          firstName={familyProfile.prenom}
          partenaire={familyProfile.partenaire}
          assistantHistory={alfred.assistantHistory}
          assistantTyping={alfred.assistantTyping}
          assistantInput={alfred.assistantInput}
          setAssistantInput={alfred.setAssistantInput}
          inputRef={alfred.alfredInputRef}
          chatScrollRef={alfred.chatScrollRef}
          endRef={alfred.endRef}
          realtimeAudioElRef={alfred.realtimeAudioElRef}
          openAiRealtimeOn={alfred.openAiRealtimeOn}
          realtimeVoiceOk={alfred.realtimeVoiceOk}
          openAiRealtimeBusy={alfred.openAiRealtimeBusy}
          alfredMemoryCount={alfredMemory.length}
          voiceSupported={alfred.voiceSupported}
          isListening={alfred.isListening}
          autoSpeak={alfred.autoSpeak}
          setAutoSpeak={alfred.setAutoSpeak}
          onBack={() => {
            setOverlay(null);
            setMainTab('home');
          }}
          onClearMemory={() => void alfred.clearAlfredMemoryAll()}
          onSend={() => void alfred.sendAssistant()}
          onToggleVoice={alfred.toggleVoiceListening}
          onToggleRealtime={() => void alfred.toggleOpenAiRealtimeVoice()}
          onSuggestion={(text) => void alfred.sendAssistant(text)}
          onConfirmPending={(cmd, intent, proposal) => void alfred.confirmAlfredAction(cmd, intent, proposal)}
          onAction={(actionId) => {
            if (actionId === 'courses') {
              setCoursesTab('liste');
              setOverlay('courses');
              return;
            }
            if (actionId === 'tasks') {
              setOverlay(null);
              setMainTab('home');
              return;
            }
            if (actionId === 'agenda') {
              setOverlay(null);
              setMainTab('agenda');
              return;
            }
            if (actionId === 'famille') {
              setOverlay('famille');
            }
          }}
        />
      );
    }

    return <div />;
  }

  return (
    <>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}html,body{overscroll-behavior-y:none;}::-webkit-scrollbar{display:none;}`}</style>
      <div className="app-outer" style={{ position: 'relative' }}>
        <a
          href="/"
          className="app-logo-fixed"
          style={{
            position: 'fixed',
            top: 'max(14px, env(safe-area-inset-top))',
            left: 'max(14px, env(safe-area-inset-left))',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            lineHeight: 1,
          }}
          aria-label="MAJORDOME — accueil"
        >
          <MajordomeWordmark maxHeight={36} />
        </a>
        <div className="app-device" style={{ background: C.bg }}>
          <div style={{ position: 'relative' }}>
            <StatusBar
              onOpenSearch={
                token && onboardingDone && postLoginSetupDone ? () => setGlobalSearchOpen(true) : undefined
              }
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 'max(0px, env(safe-area-inset-top, 0px))',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 110,
                height: 30,
                background: '#D4C8C2',
                borderBottomLeftRadius: 18,
                borderBottomRightRadius: 18,
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          </div>

          {!clientReady ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AppLoader label="Chargement de l'application…" />
            </div>
          ) : !token ? (
            <LoginAuthScreen
              C={C}
              authMode={authMode}
              setAuthMode={setAuthMode}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              error={error}
              setError={setError}
              info={info}
              setInfo={setInfo}
              loading={loading}
              onSubmit={submitAuth}
              loginSplashDone={loginSplashDone}
              onSplashDone={() => setLoginSplashDone(true)}
            />
          ) : !postLoginSetupResolved ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
              <AppLoader label="Préparation de ton espace…" />
            </div>
          ) : !postLoginSetupDone ? (
            <WelcomeSetupWizard
              C={C}
              userEmail={layoutUserEmail || email.trim() || '…'}
              initialProfile={familyProfile}
              onComplete={completeWelcomeWizard}
              onSkipAll={skipWelcomeWizard}
              onLogout={logout}
              Wordmark={MajordomeWordmark}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
              <div
                style={{
                  flexShrink: 0,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: C.white,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <MajordomeWordmark maxHeight={26} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
                {renderAppLayer()}
              </div>
              {modalDebordee !== 'closed' ? (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <button type="button" aria-label="Fermer" onClick={() => setModalDebordee('closed')} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer' }} />
                  <div style={{ position: 'relative', width: '100%', maxHeight: '82%', background: C.white, borderRadius: '22px 22px 0 0', padding: '20px 18px 28px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />
                    {modalDebordee === 'confirm' ? (
                      <>
                        <div style={{ textAlign: 'center', marginBottom: 18 }}>
                          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                            <IconLifebuoy size={44} color={C.red} strokeWidth={1.55} />
                          </div>
                          <h3 style={{ fontSize: 19, fontWeight: 800, color: C.red, margin: '0 0 8px' }}>Mode « Je suis débordée »</h3>
                          <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
                            Alfred analyse ta liste complète : garde le <strong>critique</strong> pour aujourd&apos;hui, propose du relais vers {familyProfile.partenaire}, et allège le reste.
                          </p>
                        </div>
                        <div style={{ background: C.redL, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 0.4, marginBottom: 6 }}>TA LISTE ({openTasks.length} tâches)</div>
                          {openTasks.slice(0, 8).map((u, i) => (
                            <div
                              key={u.id}
                              style={{
                                fontSize: 12,
                                color: C.text,
                                padding: '4px 0',
                                borderBottom: i < Math.min(7, openTasks.length - 1) ? `1px solid ${C.red}22` : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}
                            >
                              <span>• {u.title}</span>
                              {primaryMemberId != null && u.assigned_member_id === primaryMemberId ? (
                                <Pill bg={C.terraXL} color={C.terra}>
                                  → {familyProfile.prenom}
                                </Pill>
                              ) : null}
                              {partnerMemberId != null && u.assigned_member_id === partnerMemberId ? (
                                <Pill bg={C.alexXL} color={C.alex}>
                                  → {familyProfile.partenaire}
                                </Pill>
                              ) : null}
                              {childMemberId != null && u.assigned_member_id === childMemberId ? (
                                <Pill bg="#FFF8E8" color="#B8860B">
                                  → {familyProfile.enfant}
                                </Pill>
                              ) : null}
                              <TaskAssignSelect
                                taskId={u.id}
                                assigned_member_id={u.assigned_member_id}
                                members={householdMembers}
                                token={token}
                                busy={taskAssignBusyId === u.id}
                                onAssign={assignTaskMember}
                                compact
                              />
                              <TaskDoneButton taskId={u.id} token={token} busyDone={taskCompleteBusyId === u.id} onDone={completeTaskById} />
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => void launchDebordee()} style={{ width: '100%', padding: 14, fontSize: 14, fontWeight: 800, border: 'none', borderRadius: 14, background: C.red, color: '#fff' }}>
                          Lancer le triage Alfred
                        </button>
                        <button type="button" onClick={() => setModalDebordee('closed')} style={{ width: '100%', marginTop: 10, padding: 12, border: 'none', background: 'transparent', color: C.text3, fontSize: 13 }}>
                          Annuler
                        </button>
                      </>
                    ) : null}
                    {modalDebordee === 'loading' ? (
                      <div style={{ textAlign: 'center', padding: '36px 0' }}>
                        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
                          <IconBrainOutline size={44} color={C.text} strokeWidth={1.45} />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>Alfred analyse ta liste…</div>
                        <div style={{ fontSize: 13, color: C.text2 }}>Urgences, délégations, ce qui peut attendre.</div>
                      </div>
                    ) : null}
                    {modalDebordee === 'result' && debordeeResult ? (
                      <>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                            <IconSparkleAI size={34} color={C.terra} strokeWidth={1.55} />
                          </div>
                          <div style={{ fontSize: 14, color: C.terra, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.45 }}>&quot;{debordeeResult.message}&quot;</div>
                        </div>
                        {debordeeResult.critique.length > 0 ? (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 0.4, marginBottom: 6 }}>CRITIQUE — aujourd&apos;hui</div>
                            {debordeeResult.critique.map((t, i) => (
                              <div key={i} style={{ padding: '10px 12px', borderRadius: 12, background: C.redL, border: `1.5px solid ${C.red}33`, marginBottom: 6, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <span style={{ flexShrink: 0, marginTop: 2 }}>
                                  <IconBoltSoft size={16} color={C.red} strokeWidth={1.55} />
                                </span>
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {debordeeResult.deleguer.length > 0 ? (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.alex, letterSpacing: 0.4, marginBottom: 6 }}>DÉLÉGUÉ — à suivre</div>
                            {debordeeResult.deleguer.map((t, i) => {
                              const [task, who] = t.split(':');
                              return (
                                <div key={i} style={{ padding: '10px 12px', borderRadius: 12, background: C.alexL, border: `1.5px solid ${C.alex}33`, marginBottom: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                  <span>{task.trim()}</span>
                                  <Pill color={C.alex} bg={C.alexXL}>→ {who?.trim() || familyProfile.partenaire}</Pill>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        {debordeeResult.supprimer.length > 0 ? (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: 0.4, marginBottom: 6 }}>REPORTÉ — pas urgent</div>
                            {debordeeResult.supprimer.map((t, i) => (
                              <div key={i} style={{ padding: '8px 12px', borderRadius: 12, background: C.surface2, marginBottom: 6, fontSize: 13, color: C.text3, textDecoration: 'line-through' }}>{t}</div>
                            ))}
                          </div>
                        ) : null}
                        <button type="button" onClick={() => setModalDebordee('closed')} style={{ width: '100%', padding: 13, fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 14, background: C.terra, color: '#fff' }}>
                          Parfait, je gère ça
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {modalAlex ? (
                <div style={{ position: 'absolute', inset: 0, zIndex: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <button type="button" aria-label="Fermer" onClick={() => setModalAlex(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} />
                  <div style={{ position: 'relative', width: '100%', maxHeight: '90%', background: C.white, borderRadius: '22px 22px 0 0', overflowY: 'auto' }}>
                    <div style={{ background: `linear-gradient(135deg, ${C.alex}, #3A5A9C)`, padding: '18px 18px 20px', borderRadius: '22px 22px 0 0' }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.35)', margin: '0 auto 14px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 50, height: 50, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconUserOutline size={28} color="#fff" strokeWidth={1.65} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>VUE PARTENAIRE</div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Bonjour {familyProfile.partenaire}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{familyProfile.prenom} a préparé ta liste</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>Tâches du jour</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{Math.round((alexDoneIds.length / Math.max(alexTasksList.length, 1)) * 100)}%</span>
                        </div>
                        <div style={{ height: 7, background: 'rgba(255,255,255,0.2)', borderRadius: 7, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((alexDoneIds.length / Math.max(alexTasksList.length, 1)) * 100)}%`, height: '100%', background: '#fff', borderRadius: 7 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '16px 18px 28px' }}>
                      {!alexNotified ? (
                        <div style={{ background: C.alexL, borderRadius: 14, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: C.alex, lineHeight: 1.5 }}>
                          « {familyProfile.prenom} a besoin de toi aujourd&apos;hui. Voici 5 choses qui feraient vraiment la différence. »
                        </div>
                      ) : null}
                      {alexTasksList.map((t) => {
                        const done = alexDoneIds.includes(t.id);
                        const toggleAlex = () =>
                          setAlexDoneIds((d) => (d.includes(t.id) ? d.filter((x) => x !== t.id) : [...d, t.id]));
                        const aid = 'assigned_member_id' in t ? (t as { assigned_member_id?: number | null }).assigned_member_id : undefined;
                        return (
                          <div
                            key={t.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                              padding: '10px 10px',
                              borderRadius: 14,
                              border: `1.5px solid ${done ? C.green + '55' : C.border}`,
                              background: done ? C.greenL : C.surface,
                              marginBottom: 8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={toggleAlex}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flex: 1,
                                minWidth: 0,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                padding: 0,
                              }}
                            >
                              <span style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <InlineDocGlyph icon={t.icon} size={22} color={C.alex} />
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: done ? C.green : C.text,
                                      textDecoration: done ? 'line-through' : 'none',
                                    }}
                                  >
                                    {t.label}
                                  </span>
                                  {primaryMemberId != null && aid === primaryMemberId ? (
                                    <Pill bg={C.terraXL} color={C.terra}>
                                      {familyProfile.prenom}
                                    </Pill>
                                  ) : null}
                                  {partnerMemberId != null && aid === partnerMemberId ? (
                                    <Pill bg={C.alexXL} color={C.alex}>
                                      Pour toi
                                    </Pill>
                                  ) : null}
                                  {childMemberId != null && aid === childMemberId ? (
                                    <Pill bg="#FFF8E8" color="#B8860B">
                                      {familyProfile.enfant}
                                    </Pill>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: 10, color: done ? C.green : t.color, fontWeight: 600, marginTop: 2 }}>{t.urgency}</div>
                              </div>
                            </button>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}
                            >
                              <TaskAssignSelect
                                taskId={t.id}
                                assigned_member_id={aid}
                                members={householdMembers}
                                token={token}
                                busy={taskAssignBusyId === t.id}
                                onAssign={assignTaskMember}
                                compact
                              />
                              <TaskDoneButton taskId={t.id} token={token} busyDone={taskCompleteBusyId === t.id} onDone={completeTaskById} />
                            </div>
                            <button
                              type="button"
                              aria-label={done ? 'Annuler fait' : 'Marquer fait'}
                              onClick={toggleAlex}
                              style={{
                                width: 22,
                                height: 22,
                                flexShrink: 0,
                                borderRadius: 11,
                                border: `2px solid ${done ? C.green : C.text3}`,
                                background: done ? C.green : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              {done ? <IconCheckSmall size={11} color="#fff" strokeWidth={2.5} /> : null}
                            </button>
                          </div>
                        );
                      })}
                      {alexDoneIds.length > 0 && !alexNotified ? (
                        <button
                          type="button"
                          onClick={async () => {
                            setAlexNotified(true);
                            pushToast('success', `${familyProfile.prenom} a été notifiée`);
                            await notifySystem('MajorDome', `${familyProfile.partenaire} : ${alexDoneIds.length} tâche(s) cochée(s).`);
                          }}
                          style={{ width: '100%', marginTop: 6, padding: 13, borderRadius: 14, border: 'none', background: C.green, color: '#fff', fontSize: 13, fontWeight: 800 }}
                        >
                          Signaler à {familyProfile.prenom} : {alexDoneIds.length} tâche(s) faite(s)
                        </button>
                      ) : null}
                      {alexNotified ? (
                        <div style={{ background: C.greenL, borderRadius: 14, padding: '12px 14px', textAlign: 'center', marginTop: 8 }}>
                          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                            <IconPartyOutline size={28} color={C.green} strokeWidth={1.55} />
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{familyProfile.prenom} a été notifiée</div>
                          <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>Merci {familyProfile.partenaire}</div>
                        </div>
                      ) : null}
                      <button type="button" onClick={() => setModalAlex(false)} style={{ width: '100%', marginTop: 12, padding: 10, border: 'none', background: 'transparent', color: C.text3, fontSize: 13 }}>
                        ← Retour
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {modalCoffre ? (
                <div style={{ position: 'absolute', inset: 0, zIndex: 46, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <button type="button" aria-label="Fermer" onClick={() => setModalCoffre(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} />
                  <div style={{ position: 'relative', width: '100%', maxHeight: '88%', background: C.white, borderRadius: '22px 22px 0 0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 12px' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>Coffre famille</h3>
                          <p style={{ fontSize: 11, color: C.text2, margin: 0 }}>{docVault.length} documents</p>
                          {token && docStorageSummary ? (
                            <p style={{ fontSize: 10, color: C.text2, margin: '6px 0 0', lineHeight: 1.35 }}>
                              {formatDocStorageShort(docStorageSummary.used_bytes, docStorageSummary.quota_bytes)}
                            </p>
                          ) : null}
                          {!token ? <p style={{ fontSize: 10, color: C.terra, margin: '6px 0 0' }}>Connecte-toi pour synchroniser le coffre sur le serveur.</p> : null}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', flexShrink: 0 }}>
                          <button
                            type="button"
                            disabled={!token || loading}
                            onClick={() => token && void loadData(token)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 12,
                              border: `1px solid ${C.border}`,
                              background: C.white,
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.text2,
                              opacity: !token ? 0.5 : 1,
                            }}
                          >
                            Rafraîchir
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!token) return;
                              try {
                                await postJson<HouseholdDocumentApi>(
                                  '/api/v1/documents',
                                  {
                                    icon: 'g:clip',
                                    name: `Ajout ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
                                    category: docCategoryForApi(docCat),
                                    date_label: new Date().toLocaleDateString('fr-FR'),
                                    who: familyProfile.prenom,
                                    urgent: false,
                                  },
                                  token
                                );
                                setDocAddedFlash(true);
                                window.setTimeout(() => setDocAddedFlash(false), 2400);
                                pushToast('success', 'Document enregistré (base sécurisée par foyer)');
                                await loadData(token);
                              } catch (e) {
                                pushToast('error', e instanceof Error ? e.message : 'Impossible d’ajouter');
                              }
                            }}
                            style={{ padding: '6px 12px', borderRadius: 12, background: C.terraXL, color: C.terra, border: 'none', fontSize: 11, fontWeight: 700 }}
                          >
                            + Ajouter
                          </button>
                        </div>
                      </div>
                      {docVault.filter((d) => d.urgent).length > 0 ? (
                        <div style={{ background: C.redL, borderRadius: 12, padding: '10px 12px', marginBottom: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <IconAlertOutline size={18} color={C.red} strokeWidth={1.65} />
                            Documents à renouveler
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontWeight: 500, lineHeight: 1.5 }}>
                            {docVault
                              .filter((d) => d.urgent)
                              .map((d) => (
                                <li key={d.id}>
                                  {d.name}
                                  {d.exp ? ` — échéance ${d.exp}` : ''}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                      {docAddedFlash ? (
                        <div style={{ background: C.greenL, borderRadius: 12, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: C.green, fontWeight: 600 }}>Référence enregistrée — tu pourras ajouter une pièce jointe ensuite.</div>
                      ) : null}
                      <div style={{ background: C.surface, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <IconSearch size={18} color={C.text3} strokeWidth={1.65} />
                        <input value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="Rechercher…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4 }}>
                        {DOC_CATEGORY_FILTER_IDS.map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setDocCat(c)}
                            style={{
                              flexShrink: 0,
                              padding: '5px 10px',
                              borderRadius: 20,
                              border: `1.5px solid ${docCat === c ? C.terra : C.border}`,
                              background: docCat === c ? C.terra : C.white,
                              color: docCat === c ? '#fff' : C.text2,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px 24px' }}>
                      {docVault
                        .filter((d) => docMatchesCategoryFilter(docCat, d) && (docSearch === '' || d.name.toLowerCase().includes(docSearch.toLowerCase())))
                        .map((d) => {
                          const editing = docEdit?.id === d.id;
                          const catSelectOptions = [...new Set([...DOC_COFFRE_CATEGORIES, docEdit?.category || 'Divers'])];
                          return (
                            <div
                              key={d.id}
                              style={{
                                borderRadius: 14,
                                border: `1.5px solid ${editing ? C.terra : d.urgent ? `${C.red}33` : C.border}`,
                                marginBottom: 8,
                                background: editing ? C.white : d.urgent ? C.redL : C.surface,
                                overflow: 'hidden',
                              }}
                            >
                              {editing && docEdit ? (
                                <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                                  <div style={{ fontSize: 11, fontWeight: 800, color: C.text }}>Modifier</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                                      <InlineDocGlyph icon={docEdit.icon.trim() || 'g:doc'} size={26} color={C.terra} />
                                    </span>
                                    <input
                                      value={docEdit.icon}
                                      onChange={(e) => setDocEdit((p) => (p ? { ...p, icon: e.target.value.slice(0, 16) } : null))}
                                      placeholder="Code picto (ex. g:doc)"
                                      maxLength={16}
                                      aria-label="Icône du document"
                                      style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                                    />
                                  </div>
                                  <DocGlyphPicker value={docEdit.icon} onPick={(v) => setDocEdit((p) => (p ? { ...p, icon: v } : null))} terra={C.terra} border={C.border} terraXL={C.terraXL} />
                                  <input
                                    value={docEdit.name}
                                    onChange={(e) => setDocEdit((p) => (p ? { ...p, name: e.target.value } : null))}
                                    placeholder="Nom du document"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                                  />
                                  <select
                                    value={docEdit.category}
                                    onChange={(e) => setDocEdit((p) => (p ? { ...p, category: e.target.value } : null))}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, background: C.white }}
                                  >
                                    {catSelectOptions.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={docEdit.date_label}
                                    onChange={(e) => setDocEdit((p) => (p ? { ...p, date_label: e.target.value } : null))}
                                    placeholder="Date (texte libre, ex. Jan. 2024)"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                                  />
                                  <label style={{ fontSize: 10, color: C.text2 }}>
                                    Échéance (optionnel)
                                    <input
                                      type="date"
                                      value={docEdit.expires_date}
                                      onChange={(e) => setDocEdit((p) => (p ? { ...p, expires_date: e.target.value } : null))}
                                      style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                                    />
                                  </label>
                                  <input
                                    value={docEdit.who}
                                    onChange={(e) => setDocEdit((p) => (p ? { ...p, who: e.target.value } : null))}
                                    placeholder="Qui (vide = Famille)"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }}
                                  />
                                  <textarea
                                    value={docEdit.notes}
                                    onChange={(e) => setDocEdit((p) => (p ? { ...p, notes: e.target.value } : null))}
                                    placeholder="Notes internes"
                                    rows={3}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                                  />
                                  <input
                                    ref={docAttachmentReplaceRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = '';
                                      if (f && docEdit && token) void uploadAttachmentForDoc(docEdit.id, f);
                                    }}
                                  />
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.text2 }}>Pièce jointe (serveur)</div>
                                  {(() => {
                                    const pj = docVault.find((x) => x.id === docEdit.id);
                                    const has = pj?.attachmentSizeBytes != null && pj.attachmentSizeBytes > 0;
                                    return has ? (
                                      <div style={{ fontSize: 11, color: C.text, padding: '10px 12px', borderRadius: 12, background: C.surface2, border: `1px solid ${C.border}` }}>
                                        <div style={{ fontWeight: 700 }}>{pj?.attachmentOriginalName || 'Fichier'}</div>
                                        <div style={{ fontSize: 10, color: C.text2 }}>{Math.max(1, Math.round((pj?.attachmentSizeBytes || 0) / 1024))} Ko</div>
                                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                                          <button
                                            type="button"
                                            disabled={!token}
                                            onClick={() => void downloadDocAttachment(docEdit.id)}
                                            style={{
                                              padding: '6px 10px',
                                              borderRadius: 10,
                                              border: `1px solid ${C.sage}`,
                                              background: C.sageL,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              color: C.sage,
                                            }}
                                          >
                                            Télécharger
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!token}
                                            onClick={() => docAttachmentReplaceRef.current?.click()}
                                            style={{
                                              padding: '6px 10px',
                                              borderRadius: 10,
                                              border: `1px solid ${C.border}`,
                                              background: C.white,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              color: C.text2,
                                            }}
                                          >
                                            Remplacer
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!token}
                                            onClick={() => void removeAttachmentForDoc(docEdit.id)}
                                            style={{
                                              padding: '6px 10px',
                                              borderRadius: 10,
                                              border: 'none',
                                              background: C.redL,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              color: C.red,
                                            }}
                                          >
                                            Supprimer PJ
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={!token}
                                        onClick={() => docAttachmentReplaceRef.current?.click()}
                                        style={{
                                          padding: '10px 12px',
                                          borderRadius: 12,
                                          border: `1px dashed ${C.border}`,
                                          background: C.white,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: C.text2,
                                          textAlign: 'center',
                                        }}
                                      >
                                        + Ajouter fichier (image ou PDF)
                                      </button>
                                    );
                                  })()}
                                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <button
                                      type="button"
                                      disabled={docEditSaving}
                                      onClick={() => setDocEdit(null)}
                                      style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: `1px solid ${C.border}`,
                                        background: C.white,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: C.text2,
                                      }}
                                    >
                                      Annuler
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!token || docEditSaving}
                                      onClick={() => void saveDocEdit()}
                                      style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: C.terra,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: '#fff',
                                      }}
                                    >
                                      {docEditSaving ? '…' : 'Enregistrer'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px' }}>
                                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.terraXL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <InlineDocGlyph icon={d.icon} size={22} color={C.terra} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                                    <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>
                                      {d.who} · {d.date}
                                      {d.exp ? ` → exp. ${d.exp}` : ''}
                                    </div>
                                    {d.notes?.trim() ? <div style={{ fontSize: 10, color: C.text3, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.notes.trim()}</div> : null}
                                    {d.attachmentSizeBytes ? (
                                      <button
                                        type="button"
                                        disabled={!token}
                                        onClick={() => void downloadDocAttachment(d.id)}
                                        style={{
                                          marginTop: 6,
                                          padding: '5px 10px',
                                          borderRadius: 10,
                                          border: `1px solid ${C.sage}`,
                                          background: C.sageL,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: C.sage,
                                          cursor: token ? 'pointer' : 'default',
                                        }}
                                      >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                          <IconPaperclip size={13} color={C.sage} strokeWidth={1.75} />
                                          Fichier ({Math.max(1, Math.round(d.attachmentSizeBytes / 1024))} Ko)
                                        </span>
                                      </button>
                                    ) : null}
                                  </div>
                                  {d.urgent ? (
                                    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-label="Urgent">
                                      <IconAlertOutline size={18} color={C.red} strokeWidth={1.65} />
                                    </span>
                                  ) : null}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      disabled={!token}
                                      onClick={() => openDocEdit(d)}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 8,
                                        border: `1px solid ${C.terra}`,
                                        background: C.terraXL,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: C.terra,
                                      }}
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!token}
                                      onClick={async () => {
                                        if (!token) return;
                                        try {
                                          await patchJson<HouseholdDocumentApi>(`/api/v1/documents/${d.id}`, { urgent: !d.urgent }, token);
                                          await loadData(token);
                                        } catch (e) {
                                          pushToast('error', e instanceof Error ? e.message : 'Erreur');
                                        }
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 8,
                                        border: `1px solid ${C.border}`,
                                        background: C.white,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: C.text2,
                                      }}
                                    >
                                      {d.urgent ? 'Pas urgent' : 'Urgent'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!token}
                                      onClick={async () => {
                                        if (!token) return;
                                        if (!window.confirm(`Supprimer « ${d.name} » du coffre ?`)) return;
                                        try {
                                          await deleteJson(`/api/v1/documents/${d.id}`, token);
                                          pushToast('info', 'Document supprimé');
                                          await loadData(token);
                                        } catch (e) {
                                          pushToast('error', e instanceof Error ? e.message : 'Erreur');
                                        }
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: C.redL,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: C.red,
                                      }}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.text2, marginBottom: 6 }}>AJOUTER DEPUIS</div>
                        <input
                          ref={docPhotoInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void createDocFromPhotoFile(f);
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            disabled={!token}
                            onClick={() => {
                              if (!token) return;
                              docPhotoInputRef.current?.click();
                            }}
                            style={{
                              flex: 1,
                              padding: 10,
                              borderRadius: 12,
                              border: `1.5px solid ${C.border}`,
                              background: C.white,
                              fontSize: 11,
                              fontWeight: 600,
                              color: token ? C.text : C.text3,
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <IconCamera size={14} color={C.text} strokeWidth={1.65} />
                              Photo
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={openDocEmailDraft}
                            style={{
                              flex: 1,
                              padding: 10,
                              borderRadius: 12,
                              border: `1.5px solid ${C.border}`,
                              background: C.white,
                              fontSize: 11,
                              fontWeight: 600,
                              color: C.text2,
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <IconMail size={14} color={C.text2} strokeWidth={1.65} />
                              Email
                            </span>
                          </button>
                        </div>
                        <p style={{ fontSize: 9, color: C.text3, margin: '8px 0 0', lineHeight: 1.35 }}>
                          Image ou PDF : la fiche est créée puis le fichier est enregistré sur le serveur (stockage isolé par foyer, volume Docker majordome_uploads). La taille max est définie côté API (MAJORDOME_ATTACHMENT_MAX_MB).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {modalEquite ? (
                <div style={{ position: 'absolute', inset: 0, zIndex: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <button
                    type="button"
                    aria-label="Fermer"
                    onClick={() => {
                      setModalEquite(false);
                      setEquitePlanText('');
                    }}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }}
                  />
                  <div style={{ position: 'relative', width: '100%', maxHeight: '92%', background: C.white, borderRadius: '22px 22px 0 0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 10px' }} />
                      <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>Score équité</h3>
                      <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px' }}>Rapport hebdomadaire (aperçu)</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(
                          [
                            ['semaine', 'Semaine'],
                            ['categories', 'Domaines'],
                            ['plan', 'Plan'],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            type="button"
                            key={id}
                            onClick={() => {
                              setEquiteTab(id);
                              if (id === 'plan') void loadEquitePlan();
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 4px',
                              borderRadius: 12,
                              border: `1.5px solid ${equiteTab === id ? C.terra : C.border}`,
                              background: equiteTab === id ? C.terra : 'transparent',
                              color: equiteTab === id ? '#fff' : C.text2,
                              fontSize: 9.5,
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 28px' }}>
                      {equiteTab === 'semaine' ? (
                        <>
                          {(() => {
                            const w = equityWeeks[0];
                            return (
                              <div style={{ background: C.redL, borderRadius: 16, padding: 14, marginBottom: 12, border: `1.5px solid ${C.red}33` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 8 }}>DÉSÉQUILIBRE DÉTECTÉ</div>
                                <div style={{ display: 'flex', gap: 3, height: 14, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                                  <div style={{ flex: w.joanne, background: C.terra }} />
                                  <div style={{ flex: w.alex, background: C.alex }} />
                                  <div style={{ flex: w.lea, background: C.mint }} />
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                  {[
                                    { n: familyProfile.prenom, p: w.joanne, t: w.tasks.joanne, c: C.terra },
                                    { n: familyProfile.partenaire, p: w.alex, t: w.tasks.alex, c: C.alex },
                                    { n: familyProfile.enfant, p: w.lea, t: w.tasks.lea, c: C.mint },
                                  ].map((x) => (
                                    <div key={x.n} style={{ flex: 1, textAlign: 'center' }}>
                                      <div style={{ fontSize: 18, fontWeight: 800, color: x.c }}>{x.p}%</div>
                                      <div style={{ fontSize: 10, color: C.text2, fontWeight: 600 }}>{x.n}</div>
                                      <div style={{ fontSize: 9, color: C.text3 }}>{x.t} tâches</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          <GlassCard style={{ padding: 14, marginBottom: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Évolution 4 semaines</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {equityWeeks.map((w, i) => (
                                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                                  <div style={{ height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: 4 }}>
                                    <div style={{ width: '100%', height: `${(w.joanne / 100) * 56}px`, background: `${C.terra}99`, borderRadius: '4px 4px 0 0' }} />
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? C.terra : C.text3 }}>{w.joanne}%</div>
                                  <div style={{ fontSize: 8, color: C.text3, lineHeight: 1.3 }}>{i === 0 ? 'Ce sem.' : i === 1 ? 'Sem. -1' : `-${i} sem.`}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 11, color: C.text2, fontStyle: 'italic' }}>
                              {familyProfile.prenom} porte en moyenne environ <strong style={{ color: C.terra }}>69 %</strong> de la charge visible — l&apos;objectif équitable tourne autour de 33 % chacun.
                            </div>
                          </GlassCard>
                        </>
                      ) : null}
                      {equiteTab === 'categories' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {equityCategories.map((cat, i) => (
                            <GlassCard key={i} style={{ padding: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <EquityGlyphIcon glyph={cat.glyph} size={15} color={C.text} />
                                    {cat.label}
                                  </span>
                                </span>
                                {cat.joanne > 80 ? <Pill color={C.red} bg={C.redL}>{familyProfile.prenom}</Pill> : null}
                              </div>
                              <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 8, overflow: 'hidden' }}>
                                <div style={{ flex: cat.joanne, background: C.terra }} />
                                <div style={{ flex: cat.alex, background: C.alex }} />
                                <div style={{ flex: cat.lea, background: C.mint }} />
                              </div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: C.text3 }}>
                                <span>
                                  <strong style={{ color: C.terra }}>{cat.joanne}%</strong> {familyProfile.prenom}
                                </span>
                                <span>
                                  <strong style={{ color: C.alex }}>{cat.alex}%</strong> {familyProfile.partenaire}
                                </span>
                                <span>
                                  <strong style={{ color: C.mint }}>{cat.lea}%</strong> {familyProfile.enfant}
                                </span>
                              </div>
                            </GlassCard>
                          ))}
                        </div>
                      ) : null}
                      {equiteTab === 'plan' ? (
                        <>
                          <div style={{ background: C.sageL, borderRadius: 14, padding: 14, marginBottom: 12, border: `1.5px solid ${C.sage}33` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, marginBottom: 6 }}>PLAN ALFRED</div>
                            {equitePlanLoading ? <div style={{ fontSize: 13, color: C.text2 }}>Alfred rédige ton plan…</div> : <p style={{ fontSize: 13, color: C.text, lineHeight: 1.55, margin: 0 }}>{equitePlanText}</p>}
                          </div>
                          {equitySuggestions.map((s, i) => (
                            <GlassCard key={i} style={{ padding: 14, marginBottom: 8, borderColor: C.alex + '44' }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.task}</div>
                              <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>
                                {s.from} → <strong style={{ color: C.alex }}>{s.to}</strong> · <span style={{ color: C.green }}>{s.save}</span>
                              </div>
                              <button type="button" onClick={() => alfred.setAssistantInput(`Message pour ${s.to} : peux-tu prendre la tâche « ${s.task} » ?`)} style={{ marginTop: 8, width: '100%', padding: 8, borderRadius: 10, border: 'none', background: C.alex, color: '#fff', fontSize: 11, fontWeight: 700 }}>
                                Proposer via Alfred
                              </button>
                            </GlassCard>
                          ))}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {token && onboardingDone && postLoginSetupDone ? (
            <BottomTabBar active={bottomTabActive} aiName={aiName} C={C} onSelect={handleBottomTab} />
          ) : null}
          {error || info ? null : null}
          {toasts.length > 0 ? (
            <div style={{ position: 'absolute', left: 24, right: 24, top: 54, display: 'grid', gap: 8, pointerEvents: 'none', zIndex: 30 }}>
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className="ui-toast-in"
                  style={{
                    borderRadius: 16,
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.96)',
                    border: `1px solid ${t.kind === 'success' ? C.green : t.kind === 'error' ? C.red : C.terra}55`,
                    color: t.kind === 'success' ? C.green : t.kind === 'error' ? C.red : C.terra,
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {t.text}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <GlobalSearchPalette
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        entries={globalSearchEntries}
        C={C}
      />
      <HomeLayoutEditor
        open={homeLayoutEditorOpen}
        onClose={() => setHomeLayoutEditorOpen(false)}
        initial={homeLayout}
        onSave={(next) => {
          const em = typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_USER_EMAIL_KEY) : null;
          if (em) saveHomeLayoutForUser(em, next);
          setHomeLayout(mergeHomeLayout(next));
        }}
        C={C}
      />
    </>
  );
}
