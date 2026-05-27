'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteJson, getJson, postJson } from '../../lib/api';
import { newToastId } from '../../lib/clientId';
import { TOAST_DURATION_MS } from '../../lib/constants';

type ConnectedAccount = { id: number; provider: string; status: string; last_sync_at?: string | null };
type IntegrationStatus = { provider: string; configured: boolean; connected: boolean; status: string };
type GoogleOAuthStartResponse = { authorization_url: string };
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
    const stored = localStorage.getItem('majordome_access_token');
    const storedRefresh = localStorage.getItem('majordome_refresh_token');
    if (!stored) return;
    setToken(stored);
    if (storedRefresh) setRefreshToken(storedRefresh);
    loadData(stored);
    const storedAiName = localStorage.getItem('majordome_ai_name');
    if (!storedAiName) {
      localStorage.setItem('majordome_ai_name', 'Alfred');
      setAiName('Alfred');
    } else {
      setAiName(storedAiName.trim() || 'Alfred');
    }
  }, []);

  const googleAccount = useMemo(() => accounts.find((a) => a.provider === 'google_calendar') || null, [accounts]);
  const appleAccount = useMemo(() => accounts.find((a) => a.provider === 'apple_calendar') || null, [accounts]);
  const homeAccount = useMemo(() => accounts.find((a) => a.provider === 'home_assistant') || null, [accounts]);
  const googleIntegration = useMemo(() => integrations.find((i) => i.provider === 'google_calendar') || null, [integrations]);
  const appleIntegration = useMemo(() => integrations.find((i) => i.provider === 'apple_calendar') || null, [integrations]);
  const llmIntegration = useMemo(() => integrations.find((i) => i.provider === 'openai_llm') ?? null, [integrations]);
  const agendaConnectedCount = [googleAccount, appleAccount, homeAccount].filter(Boolean).length;
  const readyServicesCount = agendaConnectedCount + (llmIntegration?.connected ? 1 : 0);

  async function connectGoogle() {
    if (!token) return;
    try {
      const res = await postJson<GoogleOAuthStartResponse>('/api/v1/integrations/google/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connexion Google impossible';
      setError(msg);
      pushToast('error', msg);
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
    if (!refreshToken) return setError('Aucun refresh token local.');
    setRefreshingSession(true);
    try {
      const res = await postJson<RefreshTokenResponse>('/api/v1/auth/refresh', { refresh_token: refreshToken });
      localStorage.setItem('majordome_access_token', res.access_token);
      setToken(res.access_token);
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
      localStorage.removeItem('majordome_access_token');
      localStorage.removeItem('majordome_refresh_token');
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
                {readyServicesCount}/4 services prêts (agendas + Alfred serveur)
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
                      Synchro Apple indisponible : le serveur n’est pas encore configuré pour CalDAV.
                    </p>
                  ) : (
                    <p style={{ fontSize: 10, color: C.text3, margin: '0 0 8px', lineHeight: 1.45 }}>
                      Saisis ton Apple ID et un mot de passe d&apos;application pour synchroniser ton calendrier.
                    </p>
                  )}
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Input value={appleId} onChange={setAppleId} placeholder="Apple ID (ex: a***@icloud.com)" type="email" />
                    <Input value={appleAppPassword} onChange={setAppleAppPassword} placeholder="Mot de passe app" type="password" />
                    <Input value={appleCalendarUrl} onChange={setAppleCalendarUrl} placeholder="URL calendrier (optionnel)" />
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
                    <Input value={haBaseUrl} onChange={setHaBaseUrl} placeholder="URL Home Assistant" />
                    <Input value={haAccessToken} onChange={setHaAccessToken} placeholder="Long-lived token" type="password" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Btn onClick={connectHome}>{syncingHome ? '...' : 'Connecter'}</Btn>
                    <span style={{ fontSize: 11, color: homeAccount ? C.green : C.text3, alignSelf: 'center' }}>{homeAccount ? 'Connecte' : 'Non connecte'}</span>
                  </div>
                  <p style={{ fontSize: 10, color: C.text3, margin: '10px 0 0' }}>
                    Alexa : pas d&apos;API native ici — relie Alexa à Home Assistant (skill ou routine HTTP / webhook vers ton serveur HA), puis MajorDome pilote HA comme ci-dessus.
                  </p>
                </Card>

                <Card title="Alfred — LLM OpenAI (serveur)">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px' }}>
                    Statut : <strong style={{ color: C.text }}>{llmIntegration?.status ?? 'inconnu'}</strong>
                    {' — '}
                    {llmIntegration?.connected
                      ? 'Provider et clé API configurés côté backend (pas dans le navigateur).'
                      : 'À configurer sur le serveur : MAJORDOME_LLM_PROVIDER=openai et MAJORDOME_LLM_API_KEY (ou mock pour les tests).'}
                  </p>
                </Card>
              </>
            ) : null}

            {activeTab === 'compte' ? (
              <>
                <Card title="État du compte">
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.text2 }}>
                    <li>Session: active</li>
                    <li>Refresh token: {refreshToken ? 'present' : 'absent'}</li>
                    <li>Google: {googleAccount ? 'connecte' : 'non connecte'}</li>
                    <li>Apple: {appleAccount ? 'connecte' : 'non connecte'}</li>
                  </ul>
                  <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 11, color: C.text2 }}>Nom de l IA</label>
                    <Input value={aiName} onChange={setAiName} placeholder="Nom de l IA (ex: Alfred)" />
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

                <Card title="Base de connaissances Alfred (RAG)">
                  <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px', lineHeight: 1.5 }}>
                    Importer des PDF ou notes (calendriers scolaires, manuels d&apos;appareils…) pour que les réponses d&apos;Alfred s&apos;appuient sur <strong>vos</strong> documents :{' '}
                    <strong>À venir</strong>. Les fichiers resteront dans votre foyer, avec quotas et suppression possible à tout moment.
                  </p>
                  <p style={{ fontSize: 11, color: C.text3, margin: 0, lineHeight: 1.45 }}>
                    Prochaine étape technique : indexation côté serveur + recherche sémantique limitée au coffre autorisé (pas d&apos;entraînement tiers).
                  </p>
                </Card>
              </>
            ) : null}

            {activeTab === 'securite' ? (
              <Card title="Sécurité session">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn light onClick={refreshSessionNow} disabled={refreshingSession}>{refreshingSession ? '...' : 'Renouveler'}</Btn>
                  <Btn light onClick={logoutEverywhere} disabled={loggingOut}>{loggingOut ? '...' : 'Déconnexion'}</Btn>
                </div>
              </Card>
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

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 13, minHeight: 44, background: C.white }}
    />
  );
}
