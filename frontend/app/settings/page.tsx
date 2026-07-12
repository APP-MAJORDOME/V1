'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteJson, getJson, postFormData, postJson, tryRefreshAccessToken } from '../../lib/api';
import { DEFAULT_ASSISTANT_NAME, resolveAssistantName } from '../../lib/assistantName';
import type { IntegrationCapabilities } from '../../lib/integrationCapabilities';
import { VaultEncryptionBadge } from '../../components/VaultEncryptionBadge';
import {
  COOKIE_AUTH_SESSION,
  clearStoredAuthTokens,
  getStoredAccessToken,
  persistAccessToken,
} from '../../lib/authTokens';
import { newToastId } from '../../lib/clientId';
import { TOAST_DURATION_MS } from '../../lib/constants';
import { LAYOUT_USER_EMAIL_KEY } from '../../lib/homeLayout';
import { maskEmail } from '../../lib/maskEmail';
import { useHouseholdSubscription } from '../../components/PaywallSoft';
import {
  type OAuthStartResponse,
  readOAuthCallbackNotice,
  stripUrlSearchKeys,
  integrationErrorMessage,
} from '../../lib/calendarIntegrations';
import { t } from '../../lib/i18n';

type ConnectedAccount = { id: number; provider: string; status: string; last_sync_at?: string | null };
type IntegrationStatus = { provider: string; configured: boolean; connected: boolean; status: string };
type RefreshTokenResponse = { access_token: string };
type DoctolibSummary = { count: number; status: string; events: Array<{ id: number; title: string; starts_at: string }> };
type UiToast = { id: string; kind: 'success' | 'error' | 'info'; text: string };
type MemoryFactRow = { id: number; fact_text: string };
type AccountDeletionStatus = { deletion_requested_at: string | null; grace_ends_at: string | null };
type VaultSecretRow = {
  id: number;
  label: string;
  service_key: string;
  username: string | null;
  has_password: boolean;
  login_url: string | null;
  notes: string;
};

const C = {
  bg: '#FEF9F5',
  white: '#FFFFFF',
  surface: '#FFF5F0',
  surface2: '#F5EDE8',
  surface3: '#EDE3DE',
  terra: '#D96B52',
  terraXL: '#FDEAE5',
  lilac: '#B49BD1',
  lilacL: '#F0EBFA',
  text: '#2C1F1A',
  text2: '#9A8882',
  text3: '#C8BAB5',
  border: '#EDE3DE',
  green: '#5BAA8A',
  greenL: '#E8F6EF',
  red: '#E05C5C',
  redL: '#FDEAEA',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'connexions' | 'compte' | 'securite'>('connexions');
  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [serverCaps, setServerCaps] = useState<IntegrationCapabilities | null>(null);
  const [doctolibSummary, setDoctolibSummary] = useState<DoctolibSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const [accountEmail, setAccountEmail] = useState('');
  const [appleId, setAppleId] = useState('');
  const [appleAppPassword, setAppleAppPassword] = useState('');
  const [appleCalendarUrl, setAppleCalendarUrl] = useState('');
  const [haBaseUrl, setHaBaseUrl] = useState('');
  const [haAccessToken, setHaAccessToken] = useState('');
  const [aiName, setAiName] = useState(DEFAULT_ASSISTANT_NAME);
  const [memoryFacts, setMemoryFacts] = useState<MemoryFactRow[]>([]);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memorySaving, setMemorySaving] = useState(false);
  const [vaultSecrets, setVaultSecrets] = useState<VaultSecretRow[]>([]);
  const [vaultEncryptionAtRest, setVaultEncryptionAtRest] = useState(false);
  const [vaultLabel, setVaultLabel] = useState('');
  const [vaultService, setVaultService] = useState('carrefour');
  const [vaultUsername, setVaultUsername] = useState('');
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultUrl, setVaultUrl] = useState('');
  const [vaultNotes, setVaultNotes] = useState('');
  const [vaultSaving, setVaultSaving] = useState(false);
  const [vaultRevealed, setVaultRevealed] = useState<{ id: number; password: string } | null>(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState<
    { id: number; name: string; category: string; attachment_original_name?: string | null }[]
  >([]);
  const [knowledgeUploadBusy, setKnowledgeUploadBusy] = useState(false);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncingMicrosoft, setSyncingMicrosoft] = useState(false);
  const [syncingApple, setSyncingApple] = useState(false);
  const [syncingHome, setSyncingHome] = useState(false);
  const [telegramLink, setTelegramLink] = useState<{
    code: string;
    deep_link: string | null;
    bot_username: string | null;
  } | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<{
    configured: boolean;
    connected: boolean;
    telegram_username?: string | null;
  } | null>(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<{
    code: string;
    deep_link: string | null;
  } | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    configured: boolean;
    connected: boolean;
    profile_name?: string | null;
  } | null>(null);
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<AccountDeletionStatus | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [toasts, setToasts] = useState<UiToast[]>([]);
  const {
    status: billingStatus,
    busy: billingBusy,
    startCheckout,
    openPortal,
  } = useHouseholdSubscription(token || null);

  function pushToast(kind: UiToast['kind'], text: string) {
    const id = newToastId();
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }

  async function loadKnowledgeDocs(accessToken?: string) {
    const auth = accessToken || token;
    if (!auth) return;
    try {
      const rows = await getJson<
        { id: number; name: string; category: string; attachment_original_name?: string | null }[]
      >('/api/v1/documents', auth);
      setKnowledgeDocs(Array.isArray(rows) ? rows.slice(0, 8) : []);
    } catch {
      setKnowledgeDocs([]);
    }
  }

  async function uploadKnowledgeDocument(file: File) {
    if (!token) return;
    setKnowledgeUploadBusy(true);
    try {
      const base =
        file.name
          .replace(/\.[^.]+$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim() || 'Document';
      const created = await postJson<{ id: number }>(
        '/api/v1/documents',
        {
          icon: '📄',
          name: base.slice(0, 200),
          category: 'Divers',
          date_label: new Date().toLocaleDateString('fr-FR'),
          urgent: false,
          notes: 'Importé depuis Réglages → Alfred base de connaissances.',
        },
        token,
      );
      const fd = new FormData();
      fd.append('file', file);
      await postFormData(`/api/v1/documents/${created.id}/attachment`, fd, token);
      pushToast('success', `« ${base} » ajouté au coffre — Alfred peut s’y appuyer.`);
      await loadKnowledgeDocs(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Import document impossible');
    } finally {
      setKnowledgeUploadBusy(false);
    }
  }

  async function loadDeletionStatus(accessToken?: string) {
    const auth = accessToken || token;
    if (!auth) return;
    try {
      const res = await getJson<AccountDeletionStatus>('/api/v1/account/deletion-status', auth);
      setDeletionStatus(res);
    } catch {
      setDeletionStatus(null);
    }
  }

  async function loadVaultSecrets(accessToken?: string) {
    const auth = accessToken || token;
    if (!auth) return;
    if (!serverCaps?.vault_secrets_enabled) {
      setVaultSecrets([]);
      setVaultEncryptionAtRest(false);
      return;
    }
    try {
      const res = await getJson<{ secrets: VaultSecretRow[]; encryption_at_rest: boolean }>(
        '/api/v1/vault/secrets',
        auth,
      );
      setVaultSecrets(res.secrets || []);
      setVaultEncryptionAtRest(Boolean(res.encryption_at_rest));
    } catch {
      setVaultSecrets([]);
      setVaultEncryptionAtRest(false);
    }
  }

  async function loadData(accessToken: string) {
    setLoading(true);
    setError('');
    try {
      const [accountsRes, integrationsRes, doctolibRes, memoryRes, capsRes, telegramRes, whatsappRes] =
        await Promise.all([
          getJson<ConnectedAccount[]>('/api/v1/accounts', accessToken),
          getJson<IntegrationStatus[]>('/api/v1/integrations/status', accessToken),
          getJson<DoctolibSummary>('/api/v1/events/doctolib/summary', accessToken),
          getJson<MemoryFactRow[]>('/api/v1/memory/facts', accessToken).catch(() => []),
          getJson<IntegrationCapabilities>('/api/v1/integrations/capabilities', accessToken).catch(() => null),
          getJson<{ configured: boolean; connected: boolean; telegram_username?: string | null }>(
            '/api/v1/integrations/telegram/status',
            accessToken,
          ).catch(() => null),
          getJson<{ configured: boolean; connected: boolean; profile_name?: string | null }>(
            '/api/v1/integrations/whatsapp/status',
            accessToken,
          ).catch(() => null),
        ]);
      setAccounts(accountsRes);
      setIntegrations(integrationsRes);
      setServerCaps(capsRes);
      setTelegramStatus(telegramRes);
      setWhatsappStatus(whatsappRes);
      setDoctolibSummary(doctolibRes);
      setMemoryFacts(memoryRes);
      await loadDeletionStatus(accessToken);
      if (capsRes?.vault_secrets_enabled) {
        await loadVaultSecrets(accessToken);
      }
      await loadKnowledgeDocs(accessToken);

      try {
        const emptyFam = { prenom: '', partenaire: '', enfant: '' };
        let famSync = emptyFam;
        const rawFam = localStorage.getItem('majordome_family_profile');
        if (rawFam) famSync = { ...emptyFam, ...JSON.parse(rawFam) };
        await postJson('/api/v1/household/profile/sync-members', {
          primary_name: famSync.prenom || '',
          partner_name: famSync.partenaire || '',
          child_name: famSync.enfant || '',
        }, accessToken);
      } catch {
        /* ignoré */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      let access = getStoredAccessToken();
      if (!access) access = await tryRefreshAccessToken();
      if (!access) return;
      persistAccessToken(typeof access === 'string' && access !== COOKIE_AUTH_SESSION ? access : '');
      setToken(COOKIE_AUTH_SESSION);
      setRefreshToken('cookie');
      const em = localStorage.getItem(LAYOUT_USER_EMAIL_KEY);
      if (em) setAccountEmail(em);
      loadData(access);
    })();
    const storedAiName = localStorage.getItem('majordome_ai_name');
    const cleanName = resolveAssistantName(storedAiName);
    localStorage.setItem('majordome_ai_name', cleanName);
    setAiName(cleanName);
    if (typeof window !== 'undefined') {
      const { notice, keysToStrip } = readOAuthCallbackNotice(window.location.search);
      if (notice) {
        pushToast(notice.kind, notice.message);
        stripUrlSearchKeys(keysToStrip);
        setActiveTab('connexions');
      }
    }
  }, []);

  const googleAccount = useMemo(() => accounts.find((a) => a.provider === 'google_calendar') || null, [accounts]);
  const microsoftAccount = useMemo(() => accounts.find((a) => a.provider === 'microsoft_calendar') || null, [accounts]);
  const appleAccount = useMemo(() => accounts.find((a) => a.provider === 'apple_calendar') || null, [accounts]);
  const homeAccount = useMemo(() => accounts.find((a) => a.provider === 'home_assistant') || null, [accounts]);
  const googleIntegration = useMemo(() => integrations.find((i) => i.provider === 'google_calendar') || null, [integrations]);
  const microsoftIntegration = useMemo(() => integrations.find((i) => i.provider === 'microsoft_calendar') || null, [integrations]);
  const appleIntegration = useMemo(() => integrations.find((i) => i.provider === 'apple_calendar') || null, [integrations]);
  const llmIntegration = useMemo(() => integrations.find((i) => i.provider === 'openai_llm') ?? null, [integrations]);
  const telegramIntegration = useMemo(() => integrations.find((i) => i.provider === 'telegram') ?? null, [integrations]);
  const whatsappIntegration = useMemo(() => integrations.find((i) => i.provider === 'whatsapp') ?? null, [integrations]);
  const microsoftOAuthReady =
    serverCaps?.microsoft_oauth_configured ?? Boolean(microsoftIntegration?.configured);
  const googleOAuthReady = serverCaps?.google_oauth_configured ?? Boolean(googleIntegration?.configured);
  const alfredLlmReady = serverCaps?.llm_configured ?? Boolean(llmIntegration?.configured);
  const alfredVoiceReady = serverCaps?.realtime_configured ?? false;
  const driveAutomationReady = Boolean(serverCaps?.drive_automation_enabled);
  const vaultSecretsEnabled = Boolean(serverCaps?.vault_secrets_enabled);
  const telegramConfigured =
    serverCaps?.telegram_configured ?? Boolean(telegramIntegration?.configured ?? telegramStatus?.configured);
  const telegramConnected = Boolean(telegramStatus?.connected ?? telegramIntegration?.connected);
  const whatsappConfigured =
    serverCaps?.whatsapp_configured ?? Boolean(whatsappIntegration?.configured ?? whatsappStatus?.configured);
  const whatsappConnected = Boolean(whatsappStatus?.connected ?? whatsappIntegration?.connected);
  const agendaConnectedCount = [googleAccount, microsoftAccount, appleAccount, homeAccount].filter(Boolean).length;
  const readyServicesCount = agendaConnectedCount + (alfredLlmReady ? 1 : 0);

  async function connectGoogle() {
    if (!token) return;
    try {
      const res = await postJson<OAuthStartResponse>('/api/v1/integrations/google/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      const msg = integrationErrorMessage(e, 'Connexion Google impossible');
      setError(msg);
      pushToast('error', msg);
    }
  }

  async function connectMicrosoft() {
    if (!token) return;
    try {
      const res = await postJson<OAuthStartResponse>('/api/v1/integrations/microsoft/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      const msg = integrationErrorMessage(e, 'Connexion Microsoft impossible');
      setError(msg);
      pushToast('error', msg);
    }
  }

  async function syncMicrosoftNow() {
    if (!token || !microsoftAccount) return;
    setSyncingMicrosoft(true);
    try {
      const res = await postJson<{ status: string }>(`/api/v1/accounts/${microsoftAccount.id}/sync`, {}, token);
      setInfo(`Microsoft: ${res.status}`);
      pushToast('success', `Outlook: ${res.status}`);
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur sync Microsoft';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSyncingMicrosoft(false);
    }
  }

  async function syncGoogleNow() {
    if (!token || !googleAccount) return;
    setSyncingGoogle(true);
    try {
      const res = await postJson<{ status: string }>(`/api/v1/accounts/${googleAccount.id}/sync`, {}, token);
      setInfo(`Google: ${res.status}`);
      pushToast('success', `Google: ${res.status}`);
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur sync Google';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function connectApple() {
    if (!token) return;
    if (!appleId || !appleAppPassword) return setError('Apple ID et mot de passe app requis.');
    setSyncingApple(true);
    try {
      await postJson('/api/v1/integrations/apple/connect', { apple_id: appleId, app_password: appleAppPassword, calendar_url: appleCalendarUrl || undefined }, token);
      setInfo('Apple connecte.');
      pushToast('success', 'Apple connecté');
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur connexion Apple';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSyncingApple(false);
    }
  }

  async function syncAppleNow() {
    if (!token || !appleAccount) return;
    setSyncingApple(true);
    try {
      const res = await postJson<{ status: string }>(`/api/v1/accounts/${appleAccount.id}/sync`, {}, token);
      setInfo(`Apple: ${res.status}`);
      pushToast('success', `Apple: ${res.status}`);
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur sync Apple';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSyncingApple(false);
    }
  }

  async function runHaDiagnostic() {
    if (!token) return;
    setSyncingHome(true);
    try {
      const diag = await getJson<{ status: string; message: string }>(
        '/api/v1/home/providers/home_assistant/diagnostic',
        token,
      );
      pushToast(diag.status === 'ok' ? 'success' : 'info', diag.message || 'Diagnostic HA');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Diagnostic HA impossible');
    } finally {
      setSyncingHome(false);
    }
  }

  async function connectHome() {
    if (!token) return;
    if (!haBaseUrl || !haAccessToken) return setError('URL et token Home Assistant requis.');
    setSyncingHome(true);
    try {
      const res = await postJson<{
        status: string;
        diagnostic?: { status: string; message: string };
      }>(
        '/api/v1/integrations/home-assistant/connect',
        { base_url: haBaseUrl, access_token: haAccessToken },
        token,
      );
      setHaAccessToken('');
      pushToast(
        res.diagnostic?.status === 'ok' ? 'success' : 'info',
        res.diagnostic?.message ||
          'Home Assistant connecté — Alfred et Google Home / Legrand utilisent HA automatiquement.',
      );
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur connexion Home Assistant';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSyncingHome(false);
    }
  }

  async function generateTelegramLink() {
    if (!token) return;
    setTelegramBusy(true);
    setTelegramLink(null);
    try {
      const res = await postJson<{
        code: string;
        deep_link: string | null;
        bot_username: string | null;
        expires_in: number;
      }>('/api/v1/integrations/telegram/link-code', {}, token);
      setTelegramLink({
        code: res.code,
        deep_link: res.deep_link,
        bot_username: res.bot_username,
      });
      pushToast('info', 'Code généré — ouvre Telegram dans les 10 minutes.');
    } catch (e) {
      const msg = integrationErrorMessage(e, 'Telegram indisponible (token bot serveur manquant ?)');
      setError(msg);
      pushToast('error', msg);
    } finally {
      setTelegramBusy(false);
    }
  }

  async function disconnectTelegram() {
    if (!token) return;
    setTelegramBusy(true);
    try {
      await deleteJson('/api/v1/integrations/telegram/disconnect', token);
      setTelegramLink(null);
      pushToast('success', 'Telegram déconnecté');
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Déconnexion Telegram impossible');
    } finally {
      setTelegramBusy(false);
    }
  }

  async function generateWhatsappLink() {
    if (!token) return;
    setWhatsappBusy(true);
    setWhatsappLink(null);
    try {
      const res = await postJson<{
        code: string;
        deep_link: string | null;
      }>('/api/v1/integrations/whatsapp/link-code', {}, token);
      setWhatsappLink({
        code: res.code,
        deep_link: res.deep_link,
      });
      pushToast('info', 'Code généré — ouvre WhatsApp dans les 10 minutes.');
    } catch (e) {
      const msg = integrationErrorMessage(e, 'WhatsApp indisponible (credentials Meta manquants ?)');
      pushToast('error', msg);
    } finally {
      setWhatsappBusy(false);
    }
  }

  async function disconnectWhatsapp() {
    if (!token) return;
    setWhatsappBusy(true);
    try {
      await deleteJson('/api/v1/integrations/whatsapp/disconnect', token);
      setWhatsappLink(null);
      pushToast('success', 'WhatsApp déconnecté');
      await loadData(token);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Déconnexion WhatsApp impossible');
    } finally {
      setWhatsappBusy(false);
    }
  }

  async function refreshSessionNow() {
    setRefreshingSession(true);
    try {
      const access = await tryRefreshAccessToken();
      if (!access) return setError('Impossible de renouveler la session.');
      setToken(access);
      setRefreshToken('cookie');
      const res = { access_token: access };
      setInfo('Session renouvelee.');
      pushToast('success', 'Session renouvelée');
      await loadData(res.access_token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible de renouveler';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setRefreshingSession(false);
    }
  }

  async function logoutEverywhere() {
    if (!token) return;
    setLoggingOut(true);
    try {
      await postJson('/api/v1/auth/logout', {}, token);
    } catch {
      // ignore
    } finally {
      clearStoredAuthTokens();
      setToken('');
      setRefreshToken('');
      setAccounts([]);
      setIntegrations([]);
      setMemoryFacts([]);
      setInfo('Session supprimee.');
      pushToast('info', 'Session supprimée');
      setLoggingOut(false);
    }
  }

  function saveAiName() {
    const cleanName = aiName.trim() || DEFAULT_ASSISTANT_NAME;
    localStorage.setItem('majordome_ai_name', cleanName);
    setAiName(cleanName);
    setInfo(`Nom de l IA enregistre: ${cleanName}`);
    pushToast('success', `Nom IA enregistré: ${cleanName}`);
  }

  async function exportAccountData() {
    if (!token) return;
    setExportBusy(true);
    pushToast('info', t('gdpr.export_started'));
    try {
      const res = await getJson<{ export: Record<string, unknown> }>('/api/v1/account/export', token);
      const blob = new Blob([JSON.stringify(res.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `majordome-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      pushToast('success', 'Export téléchargé');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExportBusy(false);
    }
  }

  async function requestAccountDeletion() {
    if (!token) return;
    if (!window.confirm(t('gdpr.delete_confirm'))) return;
    setDeleteBusy(true);
    try {
      const res = await postJson<AccountDeletionStatus>('/api/v1/account/request-deletion', {}, token);
      setDeletionStatus(res);
      pushToast('info', t('gdpr.delete_scheduled'));
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Demande impossible');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function cancelAccountDeletion() {
    if (!token) return;
    setDeleteBusy(true);
    try {
      const res = await postJson<AccountDeletionStatus>('/api/v1/account/cancel-deletion', {}, token);
      setDeletionStatus(res);
      pushToast('success', 'Suppression annulée');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Annulation impossible');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function addMemoryFact() {
    const t = memoryDraft.trim();
    if (!token || t.length < 3) return;
    setMemorySaving(true);
    try {
      const row = await postJson<MemoryFactRow>('/api/v1/memory/facts', { fact_text: t }, token);
      setMemoryFacts((prev) => [row, ...prev]);
      setMemoryDraft('');
      pushToast('success', 'Mémoire enregistrée pour le foyer');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Erreur');
    } finally {
      setMemorySaving(false);
    }
  }

  async function removeMemoryFact(id: number) {
    if (!token) return;
    try {
      await deleteJson(`/api/v1/memory/facts/${id}`, token);
      setMemoryFacts((prev) => prev.filter((x) => x.id !== id));
      pushToast('info', 'Fait retiré');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function addVaultSecret() {
    if (!token || !vaultLabel.trim()) return;
    setVaultSaving(true);
    setVaultRevealed(null);
    try {
      await postJson(
        '/api/v1/vault/secrets',
        {
          label: vaultLabel.trim(),
          service_key: vaultService,
          username: vaultUsername.trim() || null,
          password: vaultPassword || null,
          login_url: vaultUrl.trim() || null,
          notes: vaultNotes.trim(),
        },
        token,
      );
      setVaultLabel('');
      setVaultPassword('');
      setVaultNotes('');
      await loadVaultSecrets();
      pushToast('success', 'Identifiant enregistré dans le trousseau');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setVaultSaving(false);
    }
  }

  async function revealVaultSecret(id: number) {
    if (!token) return;
    try {
      const res = await postJson<{ id: number; password: string }>(`/api/v1/vault/secrets/${id}/reveal`, {}, token);
      setVaultRevealed({ id: res.id, password: res.password });
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Révélation impossible');
    }
  }

  async function removeVaultSecret(id: number) {
    if (!token) return;
    try {
      await deleteJson(`/api/v1/vault/secrets/${id}`, token);
      if (vaultRevealed?.id === id) setVaultRevealed(null);
      await loadVaultSecrets();
      pushToast('info', 'Secret supprimé');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Suppression impossible');
    }
  }

  async function prepareVaultDrive(serviceKey: string) {
    if (!token) return;
    try {
      const prep = await postJson<{
        status: string;
        message?: string;
        open_url?: string | null;
        store?: string;
        logged_in?: boolean;
      }>(`/api/v1/vault/drive/${encodeURIComponent(serviceKey)}/prepare`, {}, token);
      if (prep.status === 'ready' && prep.open_url) {
        window.open(prep.open_url, '_blank', 'noopener,noreferrer');
        pushToast(
          'success',
          prep.logged_in
            ? prep.message || `Drive ${prep.store || ''} — connexion auto OK`
            : prep.message || `Drive ${prep.store || ''} ouvert`,
        );
        return;
      }
      pushToast('info', prep.message || 'Complète le trousseau pour ce Drive.');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Préparation Drive impossible');
    }
  }

  async function fillVaultDriveCart(serviceKey: string) {
    if (!token) return;
    try {
      const res = await postJson<{
        status: string;
        message?: string;
        items_added?: number;
        open_url?: string | null;
      }>(`/api/v1/vault/drive/${encodeURIComponent(serviceKey)}/fill-cart`, {}, token);
      if (res.open_url) {
        window.open(res.open_url, '_blank', 'noopener,noreferrer');
      }
      pushToast(
        res.status === 'completed' || res.status === 'partial' ? 'success' : 'info',
        res.message || 'Remplissage panier terminé',
      );
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Remplissage panier impossible');
    }
  }

  async function automateVaultDriveLogin(serviceKey: string) {
    if (!token) return;
    try {
      const res = await postJson<{
        status: string;
        logged_in?: boolean;
        message?: string;
        open_url?: string | null;
      }>(`/api/v1/vault/drive/${encodeURIComponent(serviceKey)}/automate-login`, {}, token);
      if (res.logged_in && res.open_url) {
        window.open(res.open_url, '_blank', 'noopener,noreferrer');
      }
      pushToast(res.logged_in ? 'success' : 'info', res.message || 'Connexion Drive auto terminée');
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Connexion auto Drive impossible');
    }
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: C.bg }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 14px 120px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: C.text2, fontWeight: 800, letterSpacing: 0.4 }}>PARAMÈTRES</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginTop: 4, lineHeight: 1.15 }}>Compte & connexions</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <a href="/" style={{ color: C.terra, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>← Retour</a>
              <span style={{ fontSize: 11, padding: '6px 10px', borderRadius: 999, background: token ? '#E8F6EF' : C.surface2, color: token ? C.green : C.text3, border: `1px solid ${C.border}` }}>
                {token ? 'Session active' : 'Session inactive'}
              </span>
            </div>
          </header>

          <div style={{ background: C.white, borderRadius: 18, padding: 12, marginBottom: 10, border: `1px solid ${C.border}` }}>
            <strong style={{ color: C.text }}>Tes connexions</strong>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 10, background: microsoftAccount ? C.greenL : C.surface2, color: microsoftAccount ? C.green : C.text3, padding: '4px 8px', borderRadius: 14 }}>
                Outlook {microsoftAccount ? '✓' : microsoftOAuthReady ? '—' : 'Bientôt'}
              </span>
              <span style={{ fontSize: 10, background: googleAccount ? C.greenL : C.surface2, color: googleAccount ? C.green : C.text3, padding: '4px 8px', borderRadius: 14 }}>
                Google {googleAccount ? '✓' : googleOAuthReady ? '—' : 'Bientôt'}
              </span>
              <span style={{ fontSize: 10, background: alfredLlmReady ? C.greenL : C.surface2, color: alfredLlmReady ? C.green : C.text3, padding: '4px 8px', borderRadius: 14 }}>
                {aiName} {alfredLlmReady ? '✓' : '—'}
              </span>
              <span style={{ fontSize: 10, background: telegramConnected ? C.greenL : C.surface2, color: telegramConnected ? C.green : C.text3, padding: '4px 8px', borderRadius: 14 }}>
                Telegram {telegramConnected ? '✓' : telegramConfigured ? '—' : 'Bientôt'}
              </span>
              <span style={{ fontSize: 10, background: whatsappConnected ? C.greenL : C.surface2, color: whatsappConnected ? C.green : C.text3, padding: '4px 8px', borderRadius: 14 }}>
                WhatsApp {whatsappConnected ? '✓' : whatsappConfigured ? '—' : 'Bientôt'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {(['connexions', 'compte', 'securite'] as const).map((tab) => {
              const on = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    border: `1.5px solid ${on ? C.terra : C.border}`,
                    borderRadius: 999,
                    padding: '10px 8px',
                    background: on ? C.terra : C.white,
                    color: on ? '#fff' : C.text2,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  {tab === 'connexions' ? 'Connexions' : tab === 'compte' ? 'Compte' : 'Sécurité'}
                </button>
              );
            })}
          </div>

            {activeTab === 'connexions' ? (
              <>
                <Card title="Outlook / Microsoft 365">
                  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    {microsoftAccount ? 'Connecté ✓' : microsoftOAuthReady ? 'Non connecté' : 'Bientôt disponible'}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={connectMicrosoft} disabled={!microsoftOAuthReady}>
                      Connecter Outlook
                    </Btn>
                    <Btn light onClick={syncMicrosoftNow} disabled={!microsoftAccount || syncingMicrosoft}>
                      {syncingMicrosoft ? 'Synchronisation…' : 'Synchroniser'}
                    </Btn>
                  </div>
                </Card>

                <Card title="Google Calendar">
                  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    {googleAccount
                      ? 'Connecté ✓ — lecture + écriture. Reconnecte une fois si tu étais en lecture seule.'
                      : googleOAuthReady
                        ? 'Non connecté — sync et création d’événements.'
                        : 'Bientôt disponible'}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={connectGoogle} disabled={!googleOAuthReady}>
                      {googleAccount ? 'Reconnecter Google' : 'Connecter Google Calendar'}
                    </Btn>
                    <Btn light onClick={syncGoogleNow} disabled={!googleAccount || syncingGoogle}>
                      {syncingGoogle ? 'Synchronisation…' : 'Synchroniser'}
                    </Btn>
                  </div>
                </Card>

                <Card title="Doctolib (via agenda)">
                  <p style={{ fontSize: 12, color: C.text2, margin: 0 }}>
                    {doctolibSummary?.count || 0} rendez-vous détecté(s) dans ton agenda.
                  </p>
                </Card>

                <Card title="Apple Calendar">
                  {appleIntegration && !appleIntegration.configured ? (
                    <p style={{ fontSize: 12, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
                      Bientôt disponible sur ton espace.
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
                      Connecte ton calendrier Apple avec un mot de passe d&apos;application.
                    </p>
                  )}
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Input
                      value={appleId}
                      onChange={setAppleId}
                      placeholder="Apple ID (ex: a***@icloud.com)"
                      type="email"
                      ariaLabel="Identifiant Apple pour le calendrier"
                    />
                    <Input value={appleAppPassword} onChange={setAppleAppPassword} placeholder="Mot de passe app" type="password" ariaLabel="Mot de passe d'application Apple" />
                    <Input value={appleCalendarUrl} onChange={setAppleCalendarUrl} placeholder="URL calendrier (optionnel)" ariaLabel="URL du calendrier Apple, optionnel" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Btn onClick={connectApple} disabled={syncingApple || appleIntegration?.configured === false}>
                      {syncingApple ? 'Connexion…' : 'Connecter'}
                    </Btn>
                    <Btn
                      light
                      onClick={syncAppleNow}
                      disabled={!appleAccount || syncingApple || appleIntegration?.configured === false}
                    >
                      {syncingApple ? 'Synchronisation…' : 'Synchroniser'}
                    </Btn>
                  </div>
                </Card>

                <Card title="Home Assistant">
                  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
                    Pour piloter ta maison connectée (éclairage, volets, alarme…).
                  </p>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Input value={haBaseUrl} onChange={setHaBaseUrl} placeholder="URL Home Assistant" ariaLabel="URL de Home Assistant" />
                    <Input value={haAccessToken} onChange={setHaAccessToken} placeholder="Jeton d'accès" type="password" ariaLabel="Jeton d'accès Home Assistant" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <Btn onClick={() => void connectHome()} disabled={syncingHome}>
                      {syncingHome ? 'Connexion…' : 'Connecter'}
                    </Btn>
                    <Btn light onClick={() => void runHaDiagnostic()} disabled={syncingHome || !homeAccount}>
                      Tester la connexion
                    </Btn>
                    <span style={{ fontSize: 12, color: homeAccount ? C.green : C.text3, alignSelf: 'center' }}>
                      {homeAccount ? 'Connecté ✓' : 'Non connecté'}
                    </span>
                  </div>
                </Card>

                <Card title="Telegram — Alfred">
                  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    {telegramConnected
                      ? `Connecté${telegramStatus?.telegram_username ? ` (@${telegramStatus.telegram_username})` : ''} — envoie un message au bot pour parler à ${aiName}.`
                      : telegramConfigured
                        ? 'Lie ton chat Telegram pour commander le foyer depuis ton téléphone.'
                        : 'Bientôt disponible — le bot Telegram n’est pas encore configuré sur le serveur.'}
                  </p>
                  {telegramConfigured ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {!telegramConnected ? (
                        <Btn onClick={() => void generateTelegramLink()} disabled={telegramBusy}>
                          {telegramBusy ? '…' : 'Générer un code de liaison'}
                        </Btn>
                      ) : (
                        <Btn light onClick={() => void disconnectTelegram()} disabled={telegramBusy}>
                          Déconnecter
                        </Btn>
                      )}
                      {telegramLink ? (
                        <div style={{ width: '100%', marginTop: 8, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                          <div>
                            Code : <strong style={{ color: C.text, letterSpacing: 1 }}>{telegramLink.code}</strong>
                          </div>
                          {telegramLink.deep_link ? (
                            <a
                              href={telegramLink.deep_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: C.terra, fontWeight: 700 }}
                            >
                              Ouvrir Telegram →
                            </a>
                          ) : null}
                          <div style={{ fontSize: 11, marginTop: 4 }}>
                            Ou envoie <strong>/start {telegramLink.code}</strong>
                            {telegramLink.bot_username ? ` à @${telegramLink.bot_username}` : ''}.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Card>

                <Card title="WhatsApp — Alfred">
                  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    {whatsappConnected
                      ? `Connecté${whatsappStatus?.profile_name ? ` (${whatsappStatus.profile_name})` : ''} — envoie un message WhatsApp pour parler à ${aiName}.`
                      : whatsappConfigured
                        ? 'Lie ton WhatsApp pour commander le foyer depuis ton téléphone.'
                        : 'Bientôt disponible — WhatsApp Business (Meta) n’est pas encore configuré sur le serveur.'}
                  </p>
                  {whatsappConfigured ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {!whatsappConnected ? (
                        <Btn onClick={() => void generateWhatsappLink()} disabled={whatsappBusy}>
                          {whatsappBusy ? '…' : 'Générer un code de liaison'}
                        </Btn>
                      ) : (
                        <Btn light onClick={() => void disconnectWhatsapp()} disabled={whatsappBusy}>
                          Déconnecter
                        </Btn>
                      )}
                      {whatsappLink ? (
                        <div style={{ width: '100%', marginTop: 8, fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                          <div>
                            Code : <strong style={{ color: C.text, letterSpacing: 1 }}>{whatsappLink.code}</strong>
                          </div>
                          {whatsappLink.deep_link ? (
                            <a
                              href={whatsappLink.deep_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: C.terra, fontWeight: 700 }}
                            >
                              Ouvrir WhatsApp →
                            </a>
                          ) : null}
                          <div style={{ fontSize: 11, marginTop: 4 }}>
                            Envoie ce code en message au numéro Majordome (valide 10 min).
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Card>

                <Card title={`${aiName} — assistant`}>
                  <p style={{ fontSize: 12, color: C.text2, margin: 0 }}>
                    {llmIntegration?.connected
                      ? `${aiName} est actif pour ton foyer.`
                      : `${aiName} sera bientôt disponible sur ton espace.`}
                  </p>
                </Card>
              </>
            ) : null}

            {activeTab === 'compte' ? (
              <>
                <Card title="Premium Foyer">
                  <p style={{ fontSize: 12, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    {billingStatus?.premium
                      ? `Actif (${billingStatus.tier}) — captures Alfred illimitées.`
                      : `Gratuit · ${billingStatus?.captures_remaining ?? '—'} / ${billingStatus?.captures_limit ?? 15} captures ce mois. Premium : ${billingStatus?.price_label || '6,90 €/mois'}.`}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {billingStatus?.premium && billingStatus.can_manage ? (
                      <Btn light onClick={() => void openPortal().catch((e) => pushToast('error', e instanceof Error ? e.message : 'Portail indisponible'))} disabled={billingBusy}>
                        {billingBusy ? '…' : 'Gérer l’abonnement'}
                      </Btn>
                    ) : (
                      <Btn
                        onClick={() => {
                          if (billingStatus?.stripe_configured) {
                            void startCheckout().catch((e) =>
                              pushToast('error', e instanceof Error ? e.message : 'Paiement indisponible'),
                            );
                          } else {
                            pushToast('info', 'Paiement bientôt — contacte privacy@majordom.eu pour l’offre fondatrice.');
                          }
                        }}
                        disabled={billingBusy || Boolean(billingStatus?.premium)}
                      >
                        {billingBusy ? 'Redirection…' : 'Passer en Premium'}
                      </Btn>
                    )}
                  </div>
                </Card>
                <Card title="État du compte">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Revoir les 10 écrans de découverte (fonctionnalités + personnalisation) ou les valider en aperçu
                    avant mise à jour.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    <a
                      href="/onboarding-preview"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        color: C.terra,
                        fontWeight: 700,
                        fontSize: 12,
                        textDecoration: 'none',
                      }}
                    >
                      Aperçu du parcours (liste + écrans)
                    </a>
                    <a
                      href="/?replay_onboarding=1"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: C.terraXL,
                        color: C.terra,
                        fontWeight: 700,
                        fontSize: 12,
                        textDecoration: 'none',
                      }}
                    >
                      Relancer le parcours dans l’app
                    </a>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.text2 }}>
                    <li>Session : active</li>
                    <li>
                      E-mail de connexion :{' '}
                      <strong style={{ color: C.text }}>{accountEmail ? maskEmail(accountEmail) : '—'}</strong>
                    </li>
                    <li>Google : {googleAccount ? 'connecté' : 'non connecté'}</li>
                    <li>Apple : {appleAccount ? 'connecté' : 'non connecté'}</li>
                  </ul>
                  <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 11, color: C.text2 }}>Nom de l IA</label>
                    <Input value={aiName} onChange={setAiName} placeholder="Nom de l'IA (ex: Alfred)" ariaLabel="Nom de l'assistant IA" />
                    <div>
                      <Btn onClick={saveAiName}>Enregistrer</Btn>
                    </div>
                  </div>
                </Card>

                <Card title="Mémoire foyer (Alfred)">
                <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px' }}>
                  Faits persistants envoyés à Alfred (commandes vocales / texte et mode débordée). Partagés avec ton foyer.
                </p>
                <textarea
                  value={memoryDraft}
                  onChange={(e) => setMemoryDraft(e.target.value)}
                  placeholder="Ex.: Léa a de la fièvre depuis hier — RDV pédiatre lundi."
                  aria-label="Nouveau fait à mémoriser pour Alfred"
                  style={{ width: '100%', minHeight: 76, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, resize: 'vertical' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Btn onClick={() => void addMemoryFact()} disabled={memorySaving || memoryDraft.trim().length < 3}>
                    {memorySaving ? '...' : 'Ajouter'}
                  </Btn>
                </div>
                <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                  {memoryFacts.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        fontSize: 12,
                        color: C.text2,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={{ flex: 1, lineHeight: 1.45 }}>{m.fact_text}</span>
                      <button
                        type="button"
                        onClick={() => void removeMemoryFact(m.id)}
                        style={{ border: 'none', background: 'transparent', color: C.red, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
                </Card>

                <Card title="Base de connaissances Alfred">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px', lineHeight: 1.5 }}>
                    Importe un PDF ou une photo ici : Alfred les lit via le coffre famille (questions foyer) et via le
                    bouton 📎 dans le chat Alfred.
                  </p>
                  <label
                    style={{
                      display: 'inline-block',
                      fontSize: 12,
                      fontWeight: 800,
                      color: C.terra,
                      cursor: knowledgeUploadBusy ? 'not-allowed' : 'pointer',
                      opacity: knowledgeUploadBusy ? 0.5 : 1,
                    }}
                  >
                    {knowledgeUploadBusy ? 'Import…' : '+ Ajouter PDF / image'}
                    <input
                      type="file"
                      accept=".pdf,image/*,.doc,.docx,.txt"
                      style={{ display: 'none' }}
                      disabled={knowledgeUploadBusy || !token}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void uploadKnowledgeDocument(f);
                      }}
                    />
                  </label>
                  {knowledgeDocs.length > 0 ? (
                    <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                      {knowledgeDocs.map((d) => (
                        <li
                          key={d.id}
                          style={{
                            fontSize: 11,
                            color: C.text2,
                            border: `1px solid ${C.border}`,
                            borderRadius: 10,
                            padding: '6px 8px',
                          }}
                        >
                          <strong style={{ color: C.text }}>{d.name}</strong>
                          {d.attachment_original_name ? ` · ${d.attachment_original_name}` : ' · sans fichier'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 10, color: C.text3, margin: '8px 0 0' }}>
                      Aucun document — ouvre aussi le Coffre depuis l&apos;accueil (Plus → Coffre).
                    </p>
                  )}
                </Card>

                <Card title="Mes données (RGPD)">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Exporte l&apos;ensemble des données de ton foyer ou demande la suppression de ton compte (délai de
                    grâce de 14 jours).
                  </p>
                  {deletionStatus?.deletion_requested_at ? (
                    <p style={{ fontSize: 12, color: C.red, margin: '0 0 10px', lineHeight: 1.45, fontWeight: 700 }}>
                      {t('gdpr.delete_scheduled')}
                      {deletionStatus.grace_ends_at
                        ? ` — avant le ${new Date(deletionStatus.grace_ends_at).toLocaleDateString('fr-FR')}.`
                        : ''}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn light onClick={() => void exportAccountData()} disabled={exportBusy || !token}>
                      {exportBusy ? 'Préparation…' : t('gdpr.export_data')}
                    </Btn>
                    {deletionStatus?.deletion_requested_at ? (
                      <Btn light onClick={() => void cancelAccountDeletion()} disabled={deleteBusy || !token}>
                        {deleteBusy ? '…' : 'Annuler la suppression'}
                      </Btn>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void requestAccountDeletion()}
                        disabled={deleteBusy || !token}
                        style={{
                          border: 'none',
                          borderRadius: 12,
                          padding: '10px 12px',
                          minHeight: 44,
                          background: C.redL,
                          color: C.red,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: deleteBusy || !token ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {deleteBusy ? '…' : t('gdpr.delete_account')}
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: C.text3, margin: '10px 0 0', lineHeight: 1.45 }}>
                    Contact DPO : <a href="mailto:privacy@majordom.eu" style={{ color: C.terra, fontWeight: 700 }}>privacy@majordom.eu</a>
                    {' · '}
                    <a href="/settings#confidentialite" style={{ color: C.terra, fontWeight: 700 }}>
                      Politique de confidentialité
                    </a>
                  </p>
                </Card>
              </>
            ) : null}

            {activeTab === 'securite' ? (
              <>
                {vaultSecretsEnabled ? (
                <Card title="Trousseau mots de passe (intégrations)">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px', lineHeight: 1.5 }}>
                    Stocke les identifiants Carrefour Drive, enseignes ou autres services pour qu&apos;Alfred puisse s&apos;y connecter plus tard.
                    Les mots de passe ne sont jamais affichés en clair dans la liste.
                  </p>
                  <VaultEncryptionBadge C={C} encryptionAtRest={vaultEncryptionAtRest} style={{ marginBottom: 8 }} />
                  {driveAutomationReady ? (
                    <p style={{ fontSize: 10, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
                      Remplissage automatique du panier courses disponible pour les enseignes connectées.
                    </p>
                  ) : null}
                  {vaultSecrets.length > 0 ? (
                    <ul style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                      {vaultSecrets.map((s) => (
                        <li
                          key={s.id}
                          style={{
                            border: `1px solid ${C.border}`,
                            borderRadius: 12,
                            padding: '8px 10px',
                            background: C.surface,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{s.label}</div>
                          <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>
                            {s.service_key}
                            {s.username ? ` · ${s.username}` : ''}
                            {s.has_password ? ' · mot de passe enregistré' : ''}
                          </div>
                          {s.login_url ? (
                            <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{s.login_url}</div>
                          ) : null}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {['carrefour', 'marche_u', 'leclerc', 'auchan', 'intermarche', 'lidl', 'aldi'].includes(
                              s.service_key,
                            ) ? (
                              <>
                                <Btn light onClick={() => void prepareVaultDrive(s.service_key)}>
                                  Ouvrir Drive
                                </Btn>
                                {s.service_key === 'carrefour' && s.has_password ? (
                                  <>
                                    <Btn light onClick={() => void automateVaultDriveLogin(s.service_key)}>
                                      Connexion auto
                                    </Btn>
                                    <Btn light onClick={() => void fillVaultDriveCart(s.service_key)}>
                                      Remplir panier
                                    </Btn>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                            <Btn light onClick={() => void removeVaultSecret(s.id)}>
                              Supprimer
                            </Btn>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 11, color: C.text3, margin: '0 0 10px' }}>Aucun identifiant enregistré.</p>
                  )}
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Input value={vaultLabel} onChange={setVaultLabel} placeholder="Libellé (ex: Carrefour Drive perso)" />
                    <select
                      value={vaultService}
                      onChange={(e) => setVaultService(e.target.value)}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 12, background: C.white }}
                    >
                      <option value="carrefour">Carrefour</option>
                      <option value="marche_u">Marché U</option>
                      <option value="leclerc">Leclerc</option>
                      <option value="auchan">Auchan</option>
                      <option value="tahoma">TaHoma</option>
                      <option value="legrand_control">Legrand Control</option>
                      <option value="verisure">Verisure</option>
                      <option value="other">Autre</option>
                    </select>
                    <Input value={vaultUsername} onChange={setVaultUsername} placeholder="Identifiant / email" />
                    <Input value={vaultPassword} onChange={setVaultPassword} placeholder="Mot de passe" type="password" />
                    <Input value={vaultUrl} onChange={setVaultUrl} placeholder="URL de connexion (optionnel)" />
                    <Input value={vaultNotes} onChange={setVaultNotes} placeholder="Notes (optionnel)" />
                    <Btn onClick={() => void addVaultSecret()} disabled={vaultSaving || !vaultLabel.trim()}>
                      {vaultSaving ? '...' : 'Ajouter au trousseau'}
                    </Btn>
                  </div>
                </Card>
                ) : null}
                <Card title="Sécurité session">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Ta session reste active sur cet appareil. Déconnecte-toi sur un appareil partagé.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn light onClick={refreshSessionNow} disabled={refreshingSession}>
                      {refreshingSession ? '...' : 'Renouveler'}
                    </Btn>
                    <Btn light onClick={logoutEverywhere} disabled={loggingOut}>
                      {loggingOut ? '...' : 'Déconnexion'}
                    </Btn>
                  </div>
                </Card>
                <section id="confidentialite" style={{ scrollMarginTop: 80 }}>
                  <Card title="Confidentialité & données">
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.text2, lineHeight: 1.55 }}>
                      <li>
                        <strong>Hébergement</strong> : données de ton foyer hébergées en Union européenne.
                      </li>
                      <li>
                        <strong>Coffre & santé</strong> : passeports, mutuelle, cycle — données sensibles ; accès limité
                        aux membres du foyer connectés.
                      </li>
                      <li>
                        <strong>Synchronisation</strong> : listes, humeur et mémoire Alfred sont partagées entre les
                        appareils de ton foyer.
                      </li>
                      <li>
                        <strong>Tes droits</strong> : export, rectification et suppression depuis l&apos;onglet Compte.
                      </li>
                    </ul>
                    <p style={{ fontSize: 11, color: C.text3, margin: '12px 0 0', lineHeight: 1.45 }}>
                      Contact DPO :{' '}
                      <a href="mailto:privacy@majordom.eu" style={{ color: C.terra, fontWeight: 700 }}>
                        privacy@majordom.eu
                      </a>
                      {' · '}
                      <a href="/settings#confidentialite" style={{ color: C.terra, fontWeight: 700 }}>
                        Politique de confidentialité
                      </a>
                    </p>
                  </Card>
                </section>
              </>
            ) : null}

            {loading ? <p style={{ color: C.text2, fontSize: 11 }}>Chargement...</p> : null}
          {toasts.length > 0 ? (
            <div style={{ position: 'fixed', left: 14, right: 14, top: 14, display: 'grid', gap: 8, pointerEvents: 'none', zIndex: 60, maxWidth: 760, margin: '0 auto' }}>
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
                    fontWeight: 800,
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
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, borderRadius: 16, padding: 12, marginBottom: 10, border: `1px solid ${C.border}` }}>
      <strong style={{ fontSize: 13, color: C.text }}>{title}</strong>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, light, disabled }: { children: React.ReactNode; onClick?: () => void; light?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none',
        borderRadius: 12,
        padding: '10px 12px',
        minHeight: 44,
        background: light ? C.surface2 : C.terra,
        color: light ? C.text : '#fff',
        fontSize: 12,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      aria-label={ariaLabel || placeholder}
      style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, minHeight: 44, background: C.white }}
    />
  );
}
