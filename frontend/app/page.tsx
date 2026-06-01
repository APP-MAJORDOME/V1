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
  tryRefreshAccessToken,
} from '../lib/api';
import { clearStoredAuthTokens, getStoredAccessToken, persistAccessToken } from '../lib/authTokens';
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
  computeHouseholdEquityShares,
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
  IconUserHeart,
  IconSparkleAI,
  IconPaperclip,
  IconSearch,
  IconRefresh,
  IconWallet,
  IconCoupon,
  IconMoon,
  IconPenLine,
  IconChart,
  IconMeal,
  IconGift,
  IconChild,
  IconHealthCross,
  IconMic,
  IconSpeaker,
  IconSchoolBag,
  IconPeopleOutline,
  IconTarget,
  IconHeartOutline,
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
import { BrandLoadingPicto, MajordomeMark, MajordomeWordmark } from '../components/BrandLogo';
import { LoginAuthScreen } from '../components/LoginAuthScreen';
import { MoiTabPanel } from '../components/MoiTabPanel';
import { AgendaTabPanel } from '../components/AgendaTabPanel';
import { HomeTabPanel } from '../components/HomeTabPanel';
import { MaisonTabPanel } from '../components/MaisonTabPanel';
import { DocumentsTabPanel } from '../components/DocumentsTabPanel';
import { FamilleTabPanel } from '../components/FamilleTabPanel';
import { AppShellModals } from '../components/AppShellModals';
import { type DebordeeResult } from '../components/DebordeeModal';
import { formatDocStorageShort, docCategoryForApi } from '../lib/documentsUi';
import { filterOutTestTasks, isTestTaskTitle } from '../lib/taskHygiene';
import { formatDateFr, formatDateTimeFr } from '../lib/formatClientDate';
import { RecentDoneTasksCard, TaskAssignSelect, TaskDoneButton } from '../components/taskUi';
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
import {
  DEFAULT_BUDGET_ENVELOPES,
  fetchBudgetEnvelopes,
  mapBudgetToUi,
  syncBudgetEnvelopes,
  type BudgetItem,
} from '../lib/budget';
import {
  fetchMealPlans,
  mapMealPlansToRecord,
  upsertMealPlan,
  type MealPlan,
} from '../lib/meals';
import {
  DEFAULT_SELF_MOMENTS,
  fetchMoiWellness,
  putMoiWellness,
  type SelfMoment,
} from '../lib/moiWellness';
import { GlobalSearchPalette, type SearchPaletteEntry } from '../components/GlobalSearchPalette';
import { MAJORDOME_PALETTE, resolveAppLayer, type MainTab, type OverlayId } from '../lib/appNavigation';
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
type DebordeeApiResponse = DebordeeResult;
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

type FridgeItem = { id: number; label: string; expires_at: string; qty: number };
type UiToast = { id: string; kind: 'success' | 'error' | 'info'; text: string };

const C = MAJORDOME_PALETTE;

function GlassCard({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, ...style }}>{children}</div>;
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: '3px 8px' }}>{children}</span>;
}

function AppBrandMark({ height = 24 }: { height?: number }) {
  return <MajordomeMark size={Math.round(height * 2.2)} />;
}

function StatusBar({
  onOpenSearch,
  headerBg,
}: {
  onOpenSearch?: () => void;
  headerBg?: string;
}) {
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
        background: headerBg ?? C.bg,
        transition: 'background 0.35s ease',
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
  const [budget, setBudget] = useState<BudgetItem[]>(DEFAULT_BUDGET_ENVELOPES);
  /** Vide au premier rendu (SSR = client), puis rempli dans useEffect — évite jour UTC ≠ jour local. */
  const [selectedMealDay, setSelectedMealDay] = useState('');
  /** Libellé date du jour uniquement côté client (évite hydratation #425 dans le hero). */
  const [clientTodayLabel, setClientTodayLabel] = useState('');
  const [clientHour, setClientHour] = useState<number | null>(null);
  const [mealPlans, setMealPlans] = useState<Record<string, MealPlan>>({});
  const [selfMoments, setSelfMoments] = useState<SelfMoment[]>(DEFAULT_SELF_MOMENTS);
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
  const mealsHydratedRef = useRef(false);
  const mealsDirtyRef = useRef(false);
  const moiHydratedRef = useRef(false);
  /** true si l'utilisateur a modifié Moi — évite que loadData() écrase le journal en cours. */
  const moiDirtyRef = useRef(false);
  const [journalSaveStatus, setJournalSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

  async function quickAddDocument() {
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
  }

  async function toggleDocUrgent(d: DocVaultItem) {
    if (!token) return;
    try {
      await patchJson<HouseholdDocumentApi>(`/api/v1/documents/${d.id}`, { urgent: !d.urgent }, token);
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function deleteDocumentFromVault(d: DocVaultItem) {
    if (!token) return;
    if (!window.confirm(`Supprimer « ${d.name} » du coffre ?`)) return;
    try {
      await deleteJson(`/api/v1/documents/${d.id}`, token);
      pushToast('info', 'Document supprimé');
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
    setClientHour(d.getHours());

    void (async () => {
      let access = getStoredAccessToken();
      if (!access) {
        access = await tryRefreshAccessToken();
      }
      if (access) setToken(access);
    })();
    const layoutEmail = localStorage.getItem(LAYOUT_USER_EMAIL_KEY);
    if (layoutEmail) setLayoutUserEmail(layoutEmail);
    if (layoutEmail) setHomeLayout(loadHomeLayoutForUser(layoutEmail));
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
    moiHydratedRef.current = false;
    moiDirtyRef.current = false;
    setJournalSaveStatus('idle');
  }, [token]);

  const persistMoiWellness = useCallback(
    async (showToast = false) => {
      if (!token) {
        if (showToast) pushToast('error', 'Connecte-toi pour enregistrer ton journal.');
        return;
      }
      setJournalSaveStatus('saving');
      try {
        const res = await putMoiWellness(
          {
            journal,
            cycle_day: cycleDay,
            moments: selfMoments,
            sleep_hours: sleep,
            moi_mood: moiMood,
            home_mood: homeMood,
          },
          token,
        );
        moiDirtyRef.current = false;
        setJournal(res.journal);
        setCycleDay(res.cycle_day);
        setSleep(res.sleep_hours);
        setMoiMood(res.moi_mood);
        setHomeMood(res.home_mood);
        if (res.moments.length > 0) setSelfMoments(res.moments);
        try {
          localStorage.setItem('majordome_journal', res.journal);
        } catch {
          /* ignore */
        }
        setJournalSaveStatus('saved');
        if (showToast) pushToast('success', 'Journal enregistré');
        window.setTimeout(() => {
          setJournalSaveStatus((s) => (s === 'saved' ? 'idle' : s));
        }, 2500);
      } catch {
        try {
          localStorage.setItem('majordome_journal', journal);
        } catch {
          /* ignore */
        }
        setJournalSaveStatus('error');
        if (showToast) {
          pushToast('error', "Impossible d'enregistrer sur le serveur — copie locale conservée sur cet appareil.");
        }
      }
    },
    [journal, cycleDay, selfMoments, sleep, moiMood, homeMood, token],
  );

  useEffect(() => {
    if (!token || !moiHydratedRef.current || !moiDirtyRef.current) return;
    const t = window.setTimeout(() => {
      void persistMoiWellness(false);
    }, 600);
    return () => window.clearTimeout(t);
  }, [journal, cycleDay, selfMoments, sleep, moiMood, homeMood, token, persistMoiWellness]);

  const onJournalChange = useCallback((text: string) => {
    moiDirtyRef.current = true;
    setJournal(text);
    try {
      localStorage.setItem('majordome_journal', text);
    } catch {
      /* ignore */
    }
  }, []);

  const onCycleDayChange = useCallback((day: number) => {
    moiDirtyRef.current = true;
    setCycleDay(day);
  }, []);

  const onSleepChange = useCallback((hours: number) => {
    moiDirtyRef.current = true;
    setSleep(hours);
  }, []);

  const onMoiMoodChange = useCallback((index: number) => {
    moiDirtyRef.current = true;
    setMoiMood(index);
  }, []);

  const onHomeMoodChange = useCallback((index: number) => {
    moiDirtyRef.current = true;
    setHomeMood(index);
  }, []);

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
            const testOpen = openRows.filter((t) => isTestTaskTitle(t.title));
            for (const t of testOpen) {
              void postJson<TaskItem>(`/api/v1/tasks/${t.id}/complete`, {}, accessToken).catch(() => {});
            }
            const cleanOpen = filterOutTestTasks(openRows);
            const cleanDone = filterOutTestTasks(doneRows);
            return {
              merged: mergeTasksById(cleanOpen, cleanDone),
              donePagingExhausted: cleanDone.length < INITIAL_DONE_TASKS_LIMIT,
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

      let budgetRows = await fetchBudgetEnvelopes(accessToken).catch(() => []);
      if (budgetRows.length === 0 && typeof window !== 'undefined') {
        const legacyRaw = localStorage.getItem('majordome_budget');
        let seed: BudgetItem[] = DEFAULT_BUDGET_ENVELOPES;
        if (legacyRaw) {
          try {
            const arr = JSON.parse(legacyRaw) as unknown[];
            if (Array.isArray(arr) && arr.length > 0) {
              const imported: BudgetItem[] = [];
              for (const item of arr) {
                if (!item || typeof item !== 'object') continue;
                const id =
                  typeof (item as { id?: string }).id === 'string'
                    ? (item as { id: string }).id.trim()
                    : '';
                const label =
                  typeof (item as { label?: string }).label === 'string'
                    ? (item as { label: string }).label.trim()
                    : '';
                if (!id || !label) continue;
                imported.push({
                  id,
                  label,
                  spent:
                    typeof (item as { spent?: number }).spent === 'number'
                      ? (item as { spent: number }).spent
                      : 0,
                  budget:
                    typeof (item as { budget?: number }).budget === 'number'
                      ? (item as { budget: number }).budget
                      : 0,
                  color:
                    typeof (item as { color?: string }).color === 'string'
                      ? (item as { color: string }).color
                      : '#6BA898',
                });
              }
              if (imported.length > 0) seed = imported;
            }
          } catch {
            /* ignore */
          }
        }
        try {
          await syncBudgetEnvelopes(seed, accessToken);
          if (legacyRaw) localStorage.removeItem('majordome_budget');
          pushToast('success', 'Budget synchronisé avec le foyer');
          budgetRows = await fetchBudgetEnvelopes(accessToken);
        } catch {
          /* ignore */
        }
      }
      if (!budgetEditing) {
        setBudget(budgetRows.length > 0 ? budgetRows.map(mapBudgetToUi) : DEFAULT_BUDGET_ENVELOPES);
      }

      let mealRows = await fetchMealPlans(accessToken).catch(() => []);
      if (mealRows.length === 0 && typeof window !== 'undefined') {
        const legacyRaw = localStorage.getItem('majordome_meal_plans');
        if (legacyRaw) {
          try {
            const parsed = JSON.parse(legacyRaw) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object') {
              let imported = 0;
              for (const [dayKey, rawPlan] of Object.entries(parsed)) {
                if (!rawPlan || typeof rawPlan !== 'object') continue;
                const lunch =
                  typeof (rawPlan as { lunch?: string }).lunch === 'string'
                    ? (rawPlan as { lunch: string }).lunch
                    : '';
                const dinner =
                  typeof (rawPlan as { dinner?: string }).dinner === 'string'
                    ? (rawPlan as { dinner: string }).dinner
                    : '';
                const missingRaw = (rawPlan as { missing?: unknown }).missing;
                const missing = Array.isArray(missingRaw)
                  ? missingRaw.map((x) => String(x).trim()).filter(Boolean)
                  : [];
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
                try {
                  await upsertMealPlan(dayKey, { lunch, dinner, missing }, accessToken);
                  imported += 1;
                } catch {
                  /* ignore */
                }
              }
              if (imported > 0) {
                localStorage.removeItem('majordome_meal_plans');
                pushToast('success', `${imported} plan(s) repas importé(s)`);
                mealRows = await fetchMealPlans(accessToken);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (!mealsDirtyRef.current) {
        setMealPlans(mapMealPlansToRecord(mealRows));
      }
      mealsHydratedRef.current = true;

      let wellness = await fetchMoiWellness(accessToken).catch(() => null);
      if (typeof window !== 'undefined') {
        const legacyJournal = localStorage.getItem('majordome_journal');
        const legacyCycle = localStorage.getItem('majordome_cycle_day');
        const legacyMoments = localStorage.getItem('majordome_self_moments');
        if (legacyJournal || legacyCycle || legacyMoments) {
          let moments = wellness?.moments ?? DEFAULT_SELF_MOMENTS;
          if (legacyMoments) {
            try {
              const parsed = JSON.parse(legacyMoments) as unknown[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                const imported: SelfMoment[] = [];
                for (const item of parsed) {
                  if (!item || typeof item !== 'object') continue;
                  const id =
                    typeof (item as { id?: string }).id === 'string'
                      ? (item as { id: string }).id.trim()
                      : '';
                  const label =
                    typeof (item as { label?: string }).label === 'string'
                      ? (item as { label: string }).label.trim()
                      : '';
                  if (!id || !label) continue;
                  imported.push({
                    id,
                    label,
                    done: Boolean((item as { done?: boolean }).done),
                  });
                }
                if (imported.length > 0) moments = imported;
              }
            } catch {
              /* ignore */
            }
          }
          try {
            wellness = await putMoiWellness(
              {
                journal: legacyJournal ?? wellness?.journal ?? '',
                cycle_day: legacyCycle
                  ? Math.min(28, Math.max(1, Number(legacyCycle) || 18))
                  : wellness?.cycle_day ?? 18,
                moments,
                sleep_hours: wellness?.sleep_hours ?? 7,
                moi_mood: wellness?.moi_mood ?? 3,
                home_mood: wellness?.home_mood ?? null,
              },
              accessToken,
            );
            if (legacyJournal) localStorage.removeItem('majordome_journal');
            if (legacyCycle) localStorage.removeItem('majordome_cycle_day');
            if (legacyMoments) localStorage.removeItem('majordome_self_moments');
            pushToast('success', 'Espace Moi synchronisé avec le foyer');
          } catch {
            /* ignore */
          }
        }
      }
      if (!moiDirtyRef.current) {
        const localJournal =
          typeof window !== 'undefined' ? localStorage.getItem('majordome_journal') : null;
        const serverJournal = wellness?.journal?.trim() ?? '';
        const mergedJournal = serverJournal || localJournal || '';
        if (wellness) {
          setJournal(mergedJournal);
          setCycleDay(wellness.cycle_day);
          setSelfMoments(wellness.moments.length > 0 ? wellness.moments : DEFAULT_SELF_MOMENTS);
          setSleep(wellness.sleep_hours ?? 7);
          setMoiMood(wellness.moi_mood ?? 3);
          setHomeMood(wellness.home_mood ?? null);
          if (mergedJournal && !serverJournal) {
            moiDirtyRef.current = true;
          }
        } else if (mergedJournal) {
          setJournal(mergedJournal);
          moiDirtyRef.current = true;
        }
      }
      moiHydratedRef.current = true;
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
    mealsHydratedRef.current = false;
    mealsDirtyRef.current = false;
  }, [token]);

  useEffect(() => {
    if (!token || !mealsHydratedRef.current || !selectedMealDay || !mealsDirtyRef.current) return;
    const plan = mealPlans[selectedMealDay];
    if (!plan) return;
    const t = window.setTimeout(() => {
      void upsertMealPlan(selectedMealDay, plan, token)
        .then(() => {
          mealsDirtyRef.current = false;
        })
        .catch(() => {});
    }, 700);
    return () => window.clearTimeout(t);
  }, [mealPlans, selectedMealDay, token]);

  async function saveBudgetToServer() {
    if (!token) return;
    try {
      await syncBudgetEnvelopes(budget, token);
      setBudgetEditing(false);
      pushToast('success', 'Budget enregistré ✓');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Synchronisation budget impossible';
      pushToast('error', msg);
    }
  }

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
    persistAccessToken(res.access_token);
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
    clearStoredAuthTokens();
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
    if (token) {
      void postJson('/api/v1/auth/logout', {}, token).catch(() => undefined);
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
    const t = getStoredAccessToken();
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
    const t = getStoredAccessToken();
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
      setInfo('Moment ajouté à tes tâches.');
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
    if (homeMood !== null || clientHour === null) return false;
    return clientHour >= 5 && clientHour < 12;
  }, [homeMood, clientHour]);
  const equity = useMemo(
    () =>
      computeHouseholdEquityShares(
        [...openTasks, ...doneTasks],
        {
          primary: primaryMemberId,
          partner: partnerMemberId,
          child: childMemberId,
        },
        familyProfile,
        { terra: C.terra, alex: C.alex, mint: C.mint },
      ),
    [openTasks, doneTasks, primaryMemberId, partnerMemberId, childMemberId, familyProfile],
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
        subtitle: t.due_at ? `Échéance ${formatDateFr(t.due_at, clientReady)}` : 'Tâche ouverte',
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
        subtitle: formatDateTimeFr(ev.starts_at, clientReady),
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
  }, [openTasks, sortedDoneTasks, events, docVault, clientReady]);

  const alexTasksList = useMemo(() => {
    const glyphs = ['g:bin', 'g:shop', 'g:bag', 'g:wrench', 'g:meal'];
    const fromApi = openTasks.slice(0, 5).map((t, i) => ({
      id: t.id,
      icon: glyphs[i % glyphs.length],
      label: t.title,
      urgency: t.due_at ? `Pour le ${formatDateFr(t.due_at, clientReady)}` : 'Cette semaine',
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
  }, [openTasks, familyProfile, clientReady]);

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
    const layer = resolveAppLayer(overlay, mainTab);
    const sec = (id: HomeSectionId) => homeLayout.sections[id] !== false;
    const wrapOv = (title: string, body: React.ReactNode) => (
      <OverlayChrome title={title} onBack={() => setOverlay(null)} white={C.white} border={C.border} text={C.text}>
        {body}
      </OverlayChrome>
    );

    if (layer === 'home') {
      const sec = (id: HomeSectionId) => homeLayout.sections[id] !== false;
      return (
        <HomeTabPanel
          C={C}
          token={token}
          aiName={aiName}
          isSectionVisible={sec}
          clientTodayLabel={clientTodayLabel}
          family={{
            prenom: familyProfile.prenom,
            partenaire: familyProfile.partenaire,
            enfant: familyProfile.enfant,
          }}
          mentalWeather={mentalWeather}
          todayUrgencies={todayUrgencies}
          nextEventsCount={nextEvents.length}
          openTasks={openTasks}
          tasksCount={tasks.length}
          taskSummary={taskSummary}
          taskSummaryRefreshing={taskSummaryRefreshing}
          fridgeAlertsCount={fridgeAlerts.length}
          hubShortcuts={homeLayout.hubShortcuts}
          hubModuleBadges={hubModuleBadges}
          showDebordeeCta={showDebordeeCta}
          showMorningMoodCard={showMorningMoodCard}
          homeMood={homeMood}
          budget={budget}
          budgetUsedPct={budgetUsedPct}
          equity={equity}
          partnerContactDraft={partnerContactDraft}
          partnerNotifyLoading={partnerNotifyLoading}
          weekEvents={weekEvents}
          opps={opps}
          sortedDoneTasks={sortedDoneTasks}
          taskAssignBusyId={taskAssignBusyId}
          taskCompleteBusyId={taskCompleteBusyId}
          taskReopenBusyId={taskReopenBusyId}
          doneHistoryRefreshBusy={doneHistoryRefreshBusy}
          doneHistoryMoreBusy={doneHistoryMoreBusy}
          doneHistoryPagingExhausted={doneHistoryPagingExhausted}
          docVaultCount={docVault.length}
          primaryMemberId={primaryMemberId}
          partnerMemberId={partnerMemberId}
          childMemberId={childMemberId}
          householdMembers={householdMembers}
          onOpenHub={openHubModule}
          onOpenAgenda={() => goMainTab('agenda')}
          onOpenTasksHome={() => {
            setOverlay(null);
            setMainTab('home');
          }}
          onOpenAlfred={() => goMainTab('alfred')}
          onPersonalizeLayout={() => setHomeLayoutEditorOpen(true)}
          onDebordee={() => {
            setDebordeeResult(null);
            setModalDebordee('confirm');
          }}
          onMorningMood={(i) => {
            onHomeMoodChange(i);
            pushToast('success', 'Humeur enregistrée');
          }}
          onHomeMoodSelect={onHomeMoodChange}
          onRefreshTaskSummary={() => void refreshTaskSummary({ trackBusy: true })}
          onPartnerContactChange={setPartnerContactDraft}
          onNotifyPartner={() => void notifyPartnerReal()}
          onOpenEquiteModal={() => {
            setEquitePlanText('');
            setEquiteTab('semaine');
            setModalEquite(true);
          }}
          onOpenAlexModal={() => {
            setAlexDoneIds([]);
            setAlexNotified(false);
            setModalAlex(true);
          }}
          onAlfredDelegatePrompt={() =>
            alfred.setAssistantInput(
              `Rédige un message WhatsApp à ${familyProfile.partenaire} pour déléguer 2 tâches aujourd'hui`,
            )
          }
          onGoMoi={() => goMainTab('moi')}
          onOpenDocuments={() => setOverlay('documents')}
          onOpenAssistant={() => setOverlay('assistant')}
          onAssignTask={assignTaskMember}
          onCompleteTask={completeTaskById}
          onReopenTask={reopenTaskById}
          onRefreshDoneFromServer={refreshDoneTasksFromServer}
          onLoadMoreDonePage={loadMoreDoneTasksPage}
        />
      );
    }

    if (layer === 'agenda') {
      return (
        <AgendaTabPanel
          C={C}
          token={token}
          accounts={accounts}
          appleCaldavAvailable={appleCaldavAvailable}
          newEventTitle={newEventTitle}
          onNewEventTitleChange={setNewEventTitle}
          newEventStart={newEventStart}
          onNewEventStartChange={setNewEventStart}
          newEventEnd={newEventEnd}
          onNewEventEndChange={setNewEventEnd}
          newEventProvider={newEventProvider}
          onNewEventProviderChange={setNewEventProvider}
          creatingEvent={creatingEvent}
          onCreateEvent={createEventFromApp}
          selectedMealDay={selectedMealDay}
          onSelectedMealDayChange={setSelectedMealDay}
          selectedMeal={selectedMeal}
          onMealLunchChange={(v) => {
            mealsDirtyRef.current = true;
            setMealPlans((m) => ({ ...m, [selectedMealDay]: { ...selectedMeal, lunch: v } }));
          }}
          onMealDinnerChange={(v) => {
            mealsDirtyRef.current = true;
            setMealPlans((m) => ({ ...m, [selectedMealDay]: { ...selectedMeal, dinner: v } }));
          }}
          onMealMissingChange={(raw) => {
            mealsDirtyRef.current = true;
            setMealPlans((m) => ({
              ...m,
              [selectedMealDay]: {
                ...selectedMeal,
                missing: raw.split(',').map((x) => x.trim()).filter(Boolean),
              },
            }));
          }}
          onGenerateCoursesFromMeal={() => {
            const missingToAdd = selectedMeal.missing.filter(
              (it) => !courses.some((c) => c.label.toLowerCase() === it.toLowerCase()),
            );
            if (missingToAdd.length === 0) {
              setInfo('Aucun ingredient nouveau a ajouter.');
              return;
            }
            for (const it of missingToAdd) void addCourseItem(it);
            setInfo('Ingredients ajoutes a Courses.');
          }}
          agendaOpenTasks={agendaOpenTasks}
          taskSummary={taskSummary}
          familyNames={{
            prenom: familyProfile.prenom,
            partenaire: familyProfile.partenaire,
            enfant: familyProfile.enfant,
          }}
          primaryMemberId={primaryMemberId}
          partnerMemberId={partnerMemberId}
          childMemberId={childMemberId}
          householdMembers={householdMembers}
          taskAssignBusyId={taskAssignBusyId}
          taskCompleteBusyId={taskCompleteBusyId}
          onAssignTask={assignTaskMember}
          onCompleteTask={completeTaskById}
          sortedDoneTasks={sortedDoneTasks}
          taskReopenBusyId={taskReopenBusyId}
          onReopenTask={reopenTaskById}
          onRefreshDoneFromServer={refreshDoneTasksFromServer}
          doneHistoryRefreshBusy={doneHistoryRefreshBusy}
          onLoadMoreDonePage={loadMoreDoneTasksPage}
          doneHistoryMoreBusy={doneHistoryMoreBusy}
          doneHistoryPagingExhausted={doneHistoryPagingExhausted}
          urgentCount={urgentCount}
          nextEvents={nextEvents}
          editingEventId={editingEventId}
          editTitle={editTitle}
          onEditTitleChange={setEditTitle}
          editStart={editStart}
          onEditStartChange={setEditStart}
          editEnd={editEnd}
          onEditEndChange={setEditEnd}
          onBeginEditEvent={beginEdit}
          onDeleteEvent={deleteEventFromApp}
          onSaveEditEvent={saveEditEvent}
          onCancelEditEvent={() => setEditingEventId(null)}
        />
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
        <MaisonTabPanel
          C={C}
          aiName={aiName}
          enfantName={familyProfile.enfant}
          morningDone={morningDone}
          onToggleMorning={(idx) => setMorningDone((v) => v.map((x, i) => (i === idx ? !x : x)))}
          eveningDone={eveningDone}
          onToggleEvening={(idx) => setEveningDone((v) => v.map((x, i) => (i === idx ? !x : x)))}
          onOpenAssistant={() => {
            alfred.setAssistantInput(
              `Pour la domotique du foyer : propose un plan simple (priorités + sécurité) pour ${familyProfile.prenom}, sans installer de matériel.`,
            );
            setOverlay('assistant');
          }}
        />,
      );
    }

    if (layer === 'documents') {
      return wrapOv(
        'Coffre famille',
        <DocumentsTabPanel
          C={C}
          token={token}
          docVault={docVault}
          docStorageSummary={docStorageSummary}
          onOpenVault={() => setModalCoffre(true)}
          onOpenDoc={(docId) => {
            const doc = docVault.find((d) => d.id === docId);
            if (doc) openDocEdit(doc);
          }}
          onDownloadAttachment={downloadDocAttachment}
        />,
      );
    }

    if (layer === 'moi') {
      return (
        <MoiTabPanel
          C={C}
          aiName={aiName}
          openTaskCount={openTasks.length}
          moiMood={moiMood}
          onMoiMoodChange={onMoiMoodChange}
          sleep={sleep}
          onSleepChange={onSleepChange}
          cycleDay={cycleDay}
          onCycleDayChange={onCycleDayChange}
          journal={journal}
          onJournalChange={onJournalChange}
          journalSaveStatus={journalSaveStatus}
          onJournalBlur={() => void persistMoiWellness(false)}
          onJournalSave={() => void persistMoiWellness(true)}
          selfMoments={selfMoments}
          onToggleSelfMoment={(id) => {
            moiDirtyRef.current = true;
            setSelfMoments((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
          }}
          selfDoneCount={selfDoneCount}
          onAddSelfMomentAsTask={addSelfMomentAsTask}
          budget={budget}
          onBudgetChange={setBudget}
          budgetEditing={budgetEditing}
          onBudgetEditingToggle={() => setBudgetEditing((v) => !v)}
          onSaveBudget={saveBudgetToServer}
          onLogout={logout}
          onToast={pushToast}
        />
      );
    }

    if (layer === 'famille') {
      return wrapOv(
        'Famille & équité',
        <FamilleTabPanel
          C={C}
          equity={equity}
          partenaireName={familyProfile.partenaire}
          partnerContactDraft={partnerContactDraft}
          onPartnerContactChange={setPartnerContactDraft}
          partnerNotifyLoading={partnerNotifyLoading}
          onOpenEquiteModal={() => {
            setEquitePlanText('');
            setEquiteTab('semaine');
            setModalEquite(true);
          }}
          onNotifyPartner={() => void notifyPartnerReal()}
          onGoMoi={() => goMainTab('moi')}
        />,
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
          suggestionContext={{
            openTasksCount: openTasks.length,
            eventsTodayCount: nextEvents.length,
            fridgeAlertsCount: fridgeAlerts.length,
            mentalHeavy: mentalWeather.level === 'heavy',
          }}
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
      <a href="#main" className="skip-link">
        Aller au contenu principal
      </a>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}html,body{overscroll-behavior-y:none;}::-webkit-scrollbar{display:none;}`}</style>
      <div className="app-outer">
        <div className="app-device" style={{ background: C.bg }}>
          <div style={{ position: 'relative' }}>
            <StatusBar
              headerBg={mainTab === 'home' && token ? mentalWeather.bg : undefined}
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
              <BrandLoadingPicto />
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
              <BrandLoadingPicto />
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
            <main id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
                {renderAppLayer()}
              </div>
              <AppShellModals
                C={C}
                modalDebordee={modalDebordee}
                openTasks={openTasks}
                debordeeResult={debordeeResult}
                family={{
                  prenom: familyProfile.prenom,
                  partenaire: familyProfile.partenaire,
                  enfant: familyProfile.enfant,
                }}
                primaryMemberId={primaryMemberId}
                partnerMemberId={partnerMemberId}
                childMemberId={childMemberId}
                householdMembers={householdMembers}
                token={token}
                taskAssignBusyId={taskAssignBusyId}
                taskCompleteBusyId={taskCompleteBusyId}
                onCloseDebordee={() => setModalDebordee('closed')}
                onLaunchDebordee={() => void launchDebordee()}
                onAssignTask={assignTaskMember}
                onCompleteTask={completeTaskById}
                modalAlex={modalAlex}
                alexTasksList={alexTasksList}
                alexDoneIds={alexDoneIds}
                alexNotified={alexNotified}
                onCloseAlex={() => setModalAlex(false)}
                onToggleAlexDone={(taskId) =>
                  setAlexDoneIds((d) => (d.includes(taskId) ? d.filter((x) => x !== taskId) : [...d, taskId]))
                }
                onNotifyPrimary={async () => {
                  setAlexNotified(true);
                  pushToast('success', `${familyProfile.prenom} a été notifiée`);
                  await notifySystem('MajorDome', `${familyProfile.partenaire} : ${alexDoneIds.length} tâche(s) cochée(s).`);
                }}
                modalCoffre={modalCoffre}
                loading={loading}
                docVault={docVault}
                docStorageSummary={docStorageSummary}
                docCat={docCat}
                onDocCatChange={setDocCat}
                docSearch={docSearch}
                onDocSearchChange={setDocSearch}
                docAddedFlash={docAddedFlash}
                docEdit={docEdit}
                onDocEditChange={setDocEdit}
                docEditSaving={docEditSaving}
                docAttachmentReplaceRef={docAttachmentReplaceRef}
                docPhotoInputRef={docPhotoInputRef}
                onCloseCoffre={() => setModalCoffre(false)}
                onRefreshCoffre={() => token && void loadData(token)}
                onQuickAddDoc={() => void quickAddDocument()}
                onOpenDocEdit={openDocEdit}
                onSaveDocEdit={() => void saveDocEdit()}
                onDownloadAttachment={downloadDocAttachment}
                onUploadAttachment={uploadAttachmentForDoc}
                onRemoveAttachment={removeAttachmentForDoc}
                onToggleDocUrgent={(d) => void toggleDocUrgent(d)}
                onDeleteDoc={(d) => void deleteDocumentFromVault(d)}
                onCreateDocFromPhoto={(f) => void createDocFromPhotoFile(f)}
                onOpenDocEmailDraft={openDocEmailDraft}
                modalEquite={modalEquite}
                equiteTab={equiteTab}
                onEquiteTabChange={(id) => {
                  setEquiteTab(id);
                  if (id === 'plan') void loadEquitePlan();
                }}
                equityWeeks={equityWeeks}
                equityCategories={equityCategories}
                equitySuggestions={equitySuggestions}
                equitePlanText={equitePlanText}
                equitePlanLoading={equitePlanLoading}
                onCloseEquite={() => {
                  setModalEquite(false);
                  setEquitePlanText('');
                }}
                onAlfredPrompt={(text) => alfred.setAssistantInput(text)}
              />
            </main>
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
