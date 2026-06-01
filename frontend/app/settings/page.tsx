'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteJson, getJson, postJson, tryRefreshAccessToken } from '../../lib/api';
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
import {
  type OAuthStartResponse,
  readOAuthCallbackNotice,
  stripUrlSearchKeys,
} from '../../lib/calendarIntegrations';

type ConnectedAccount = { id: number; provider: string; status: string; last_sync_at?: string | null };
type IntegrationStatus = { provider: string; configured: boolean; connected: boolean; status: string };
type RefreshTokenResponse = { access_token: string };
type DoctolibSummary = { count: number; status: string; events: Array<{ id: number; title: string; starts_at: string }> };
type UiToast = { id: string; kind: 'success' | 'error' | 'info'; text: string };
type MemoryFactRow = { id: number; fact_text: string };

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
  red: '#E05C5C',
  redL: '#FDEAEA',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'connexions' | 'compte' | 'securite'>('connexions');
  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [doctolibSummary, setDoctolibSummary] = useState<DoctolibSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const [accountEmail, setAccountEmail] = useState('');
  const [appleId, setAppleId] = useState('');
  const [appleAppPassword, setAppleAppPassword] = useState('');
  const [appleCalendarUrl, setAppleCalendarUrl] = useState('');
  const [haBaseUrl, setHaBaseUrl] = useState('');
  const [haAccessToken, setHaAccessToken] = useState('');
  const [aiName, setAiName] = useState('Alfred');
  const [memoryFacts, setMemoryFacts] = useState<MemoryFactRow[]>([]);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memorySaving, setMemorySaving] = useState(false);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncingMicrosoft, setSyncingMicrosoft] = useState(false);
  const [syncingApple, setSyncingApple] = useState(false);
  const [syncingHome, setSyncingHome] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [toasts, setToasts] = useState<UiToast[]>([]);

  function pushToast(kind: UiToast['kind'], text: string) {
    const id = newToastId();
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }

  async function loadData(accessToken: string) {
    setLoading(true);
    setError('');
    try {
      const [accountsRes, integrationsRes, doctolibRes, memoryRes] = await Promise.all([
        getJson<ConnectedAccount[]>('/api/v1/accounts', accessToken),
        getJson<IntegrationStatus[]>('/api/v1/integrations/status', accessToken),
        getJson<DoctolibSummary>('/api/v1/events/doctolib/summary', accessToken),
        getJson<MemoryFactRow[]>('/api/v1/memory/facts', accessToken).catch(() => []),
      ]);
      setAccounts(accountsRes);
      setIntegrations(integrationsRes);
      setDoctolibSummary(doctolibRes);
      setMemoryFacts(memoryRes);

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
    if (!storedAiName) {
      localStorage.setItem('majordome_ai_name', 'Alfred');
      setAiName('Alfred');
    } else {
      setAiName(storedAiName.trim() || 'Alfred');
    }
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
  const agendaConnectedCount = [googleAccount, microsoftAccount, appleAccount, homeAccount].filter(Boolean).length;
  const readyServicesCount = agendaConnectedCount + (llmIntegration?.connected ? 1 : 0);

  async function connectGoogle() {
    if (!token) return;
    try {
      const res = await postJson<OAuthStartResponse>('/api/v1/integrations/google/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connexion Google impossible';
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
      const msg = e instanceof Error ? e.message : 'Connexion Microsoft impossible';
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

  async function connectHome() {
    if (!token) return;
    if (!haBaseUrl || !haAccessToken) return setError('URL et token Home Assistant requis.');
    setSyncingHome(true);
    try {
      await postJson('/api/v1/integrations/home-assistant/connect', { base_url: haBaseUrl, access_token: haAccessToken }, token);
      setInfo('Home Assistant connecte.');
      pushToast('success', 'Home Assistant connecté');
      await loadData(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur connexion Home Assistant';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSyncingHome(false);
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
    const cleanName = aiName.trim() || 'Alfred';
    localStorage.setItem('majordome_ai_name', cleanName);
    setAiName(cleanName);
    setInfo(`Nom de l IA enregistre: ${cleanName}`);
    pushToast('success', `Nom IA enregistré: ${cleanName}`);
  }

  async function addMemoryFact() {
    const t = memoryDraft.trim();
    if (!token || t.length < 3) return;
    setMemorySaving(true);
    try {
      const row = await postJson<MemoryFactRow>('/api/v1/memory/facts', { fact_text: t }, token);
      setMemoryFacts((prev) => [row, ...prev]);
      setMemoryDraft('');
      pushToast('success', 'Mémoire enregistrée sur le serveur');
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
            <strong style={{ color: C.text }}>Progression de configuration</strong>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 10, background: C.terraXL, color: C.terra, padding: '4px 8px', borderRadius: 14 }}>
                {readyServicesCount}/5 services prêts (agendas + Alfred serveur)
              </span>
              <span style={{ fontSize: 10, background: C.lilacL, color: C.text2, padding: '4px 8px', borderRadius: 14, border: `1px solid ${C.lilac}33` }}>
                {doctolibSummary?.count || 0} RDV Doctolib détectés
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
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px' }}>
                    Statut: {microsoftAccount ? microsoftAccount.status : 'non connecté'} — OAuth:{' '}
                    {microsoftIntegration?.configured ? 'prêt' : 'à configurer sur le serveur'}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={connectMicrosoft} disabled={!microsoftIntegration?.configured}>
                      Connecter Outlook
                    </Btn>
                    <Btn light onClick={syncMicrosoftNow} disabled={!microsoftAccount || syncingMicrosoft}>
                      {syncingMicrosoft ? '...' : 'Sync'}
                    </Btn>
                  </div>
                </Card>

                <Card title="Google Calendar">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px' }}>Statut: {googleAccount ? googleAccount.status : 'non connecte'} - OAuth: {googleIntegration?.configured ? 'ok' : 'a configurer'}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={connectGoogle}>Connecter</Btn>
                    <Btn light onClick={syncGoogleNow} disabled={!googleAccount || syncingGoogle}>{syncingGoogle ? '...' : 'Sync'}</Btn>
                  </div>
                </Card>

                <Card title="Doctolib (via agenda)">
                  <p style={{ fontSize: 11, color: C.text2, margin: 0 }}>Statut: {doctolibSummary?.status || 'inconnu'} - {doctolibSummary?.count || 0} detecte(s).</p>
                </Card>

                <Card title="Apple Calendar">
                  {appleIntegration && !appleIntegration.configured ? (
                    <p style={{ fontSize: 11, color: C.red, margin: '0 0 8px', lineHeight: 1.45, fontWeight: 800 }}>
                      Synchronisation Apple indisponible pour l’instant sur ton compte.
                    </p>
                  ) : (
                    <p style={{ fontSize: 10, color: C.text3, margin: '0 0 8px', lineHeight: 1.45 }}>
                      Saisis ton Apple ID et un mot de passe d&apos;application pour synchroniser ton calendrier.
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
                      {syncingApple ? '...' : 'Connecter'}
                    </Btn>
                    <Btn
                      light
                      onClick={syncAppleNow}
                      disabled={!appleAccount || syncingApple || appleIntegration?.configured === false}
                    >
                      {syncingApple ? '...' : 'Sync'}
                    </Btn>
                  </div>
                </Card>

                <Card title="Home Assistant (Home iOS)">
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Input value={haBaseUrl} onChange={setHaBaseUrl} placeholder="URL Home Assistant" ariaLabel="URL de Home Assistant" />
                    <Input value={haAccessToken} onChange={setHaAccessToken} placeholder="Long-lived token" type="password" ariaLabel="Jeton d'accès Home Assistant" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Btn onClick={connectHome}>{syncingHome ? '...' : 'Connecter'}</Btn>
                    <span style={{ fontSize: 11, color: homeAccount ? C.green : C.text3, alignSelf: 'center' }}>{homeAccount ? 'Connecte' : 'Non connecte'}</span>
                  </div>
                  <p style={{ fontSize: 10, color: C.text3, margin: '10px 0 0' }}>
                    Pour Alexa : relie-la à Home Assistant, puis MajorDome pourra piloter tes scènes maison via cette connexion.
                  </p>
                </Card>

                <Card title="Alfred — assistant (serveur)">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px' }}>
                    Statut : <strong style={{ color: C.text }}>{llmIntegration?.status ?? 'inconnu'}</strong>
                    {' — '}
                    {llmIntegration?.connected
                      ? 'Alfred est relié au serveur (ta clé n’est pas stockée dans le navigateur).'
                      : 'Alfred vocal avancé : à activer par l’administrateur de ton espace MajorDome.'}
                  </p>
                </Card>
              </>
            ) : null}

            {activeTab === 'compte' ? (
              <>
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
                    <li>Session: active</li>
                    <li>
                      E-mail de connexion:{' '}
                      <strong style={{ color: C.text }}>{accountEmail ? maskEmail(accountEmail) : '—'}</strong>
                    </li>
                    <li>Renouvellement session : {refreshToken ? 'cookie sécurisé' : 'non connecté'}</li>
                    <li>Google: {googleAccount ? 'connecte' : 'non connecte'}</li>
                    <li>Apple: {appleAccount ? 'connecte' : 'non connecte'}</li>
                  </ul>
                  <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 11, color: C.text2 }}>Nom de l IA</label>
                    <Input value={aiName} onChange={setAiName} placeholder="Nom de l IA (ex: Alfred)" ariaLabel="Nom de l'assistant IA" />
                    <div>
                      <Btn onClick={saveAiName}>Enregistrer</Btn>
                    </div>
                  </div>
                </Card>

                <Card title="Mémoire foyer (Alfred)">
                <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px' }}>
                  Faits persistants envoyés à Alfred (commandes vocales / texte et mode débordée). Données stockées sur le serveur par foyer.
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
                    Importer des PDF ou notes (calendriers scolaires, manuels d&apos;appareils…) pour que les réponses d&apos;Alfred s&apos;appuient sur <strong>vos</strong> documents :{' '}
                    <strong>À venir</strong>. Les fichiers resteront dans votre foyer, avec quotas et suppression possible à tout moment.
                  </p>
                  <p style={{ fontSize: 11, color: C.text3, margin: 0, lineHeight: 1.45 }}>
                    Alfred pourra s&apos;appuyer uniquement sur les documents de ton coffre, sans les partager à l&apos;extérieur.
                  </p>
                </Card>
              </>
            ) : null}

            {activeTab === 'securite' ? (
              <>
                <Card title="Sécurité session">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Le renouvellement de session passe par un cookie HttpOnly ; l&apos;accès actif reste en mémoire
                    d&apos;onglet (sessionStorage). Déconnecte-toi sur un appareil partagé.
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
                        <strong>Hébergement</strong> : données de ton foyer sur le serveur MajorDome que tu utilises
                        (Union européenne lorsque le déploiement le prévoit).
                      </li>
                      <li>
                        <strong>Coffre & santé</strong> : passeports, mutuelle, cycle — données sensibles ; accès limité
                        aux membres du foyer connectés.
                      </li>
                      <li>
                        <strong>Appareil</strong> : listes, humeur et mémoire Alfred peuvent rester en cache local ;
                        vider le cache peut les effacer avant synchronisation complète.
                      </li>
                      <li>
                        <strong>Tes droits</strong> : export, rectification et suppression — contacte l’administrateur de
                        ton espace ou utilise la déconnexion puis suppression de compte (à venir en self-service).
                      </li>
                    </ul>
                    <p style={{ fontSize: 11, color: C.text3, margin: '12px 0 0', lineHeight: 1.45 }}>
                      Version prototype : politique complète et DPO à publier avant mise en production grand public.
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
