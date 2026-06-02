'use client';

import { useEffect, useState } from 'react';
import {
  type ConnectedAccountLike,
  type IntegrationStatus,
  integrationConfigured,
  isCalendarConnected,
} from '../lib/calendarIntegrations';
import { deleteJson, getJson, postJson } from '../lib/api';
import { GlassCard } from './GlassCard';

export type IntegrationsOverlayPanelProps = {
  token: string | null;
  C: Record<string, string>;
  accounts: ConnectedAccountLike[];
  integrationStatuses: IntegrationStatus[];
  calendarSyncBusy: string | null;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onSyncGoogle: () => void;
  onSyncMicrosoft: () => void;
  onOpenSettings: () => void;
  onAlfredPrompt: (text: string) => void;
  partenaireName: string;
};

export function IntegrationsOverlayPanel({
  token,
  C,
  accounts,
  integrationStatuses,
  calendarSyncBusy,
  onConnectGoogle,
  onConnectMicrosoft,
  onSyncGoogle,
  onSyncMicrosoft,
  onOpenSettings,
  onAlfredPrompt,
  partenaireName,
}: IntegrationsOverlayPanelProps) {
  const [homeProviders, setHomeProviders] = useState<
    { id: string; label: string; connected: boolean; status: string }[]
  >([]);
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeMsg, setHomeMsg] = useState('');
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [providerToConnect, setProviderToConnect] = useState('google_home');
  const [providerToTest, setProviderToTest] = useState('home_assistant');
  const [credProvider, setCredProvider] = useState('tahoma');
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credBaseUrl, setCredBaseUrl] = useState('');
  const [tahomaDevices, setTahomaDevices] = useState<{ id: string; name: string; device_type?: string }[]>([]);
  const [selectedTahomaDeviceId, setSelectedTahomaDeviceId] = useState('');
  const [selectedTahomaAction, setSelectedTahomaAction] = useState('toggle');
  const [groupName, setGroupName] = useState('');
  const [savedGroups, setSavedGroups] = useState<{ name: string; provider: string; device_ids: string[] }[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const googleConnected = isCalendarConnected(accounts, 'google_calendar');
  const microsoftConnected = isCalendarConnected(accounts, 'microsoft_calendar');
  const msConfigured = integrationConfigured(integrationStatuses, 'microsoft_calendar');
  const googleConfigured = integrationConfigured(integrationStatuses, 'google_calendar');
  const btnRow = { display: 'flex' as const, flexWrap: 'wrap' as const, gap: 8 };
  const homeConnectedCount = homeProviders.filter((p) => p.connected).length;

  async function refreshHomeProviders() {
    if (!token) return;
    try {
      const res = await getJson<{ providers: { id: string; label: string; connected: boolean; status: string }[] }>(
        '/api/v1/home/providers',
        token,
      );
      setHomeProviders(res.providers || []);
    } catch {
      setHomeProviders([]);
    }
  }

  useEffect(() => {
    if (!token) return;
    void refreshHomeProviders();
  }, [token]);

  async function runHomeAction(capability: string, action: string, target?: string) {
    if (!token) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await postJson<{ message?: string; status: string }>(
        '/api/v1/home/devices/control',
        { provider: 'home_assistant', capability, action, target: target || null },
        token,
      );
      setHomeMsg(res.message || `Action ${res.status}.`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : "Action domotique impossible.");
    } finally {
      setHomeBusy(false);
    }
  }

  async function connectHomeAssistant() {
    if (!token || !haUrl.trim() || !haToken.trim()) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      await postJson(
        '/api/v1/home/providers/home_assistant/connect',
        { base_url: haUrl.trim(), access_token: haToken.trim() },
        token,
      );
      setHaToken('');
      setHomeMsg('Home Assistant connecté.');
      await refreshHomeProviders();
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Connexion Home Assistant impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function connectPlannedProvider() {
    if (!token || !providerToConnect) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      await postJson('/api/v1/home/providers/connect', { provider: providerToConnect, status: 'connected' }, token);
      setHomeMsg('Connecteur marqué comme connecté. Auth fournisseur détaillée à finaliser.');
      await refreshHomeProviders();
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Connexion provider impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function testProviderConnection() {
    if (!token || !providerToTest) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await getJson<{ provider: string; status: string; message: string }>(
        `/api/v1/home/providers/${encodeURIComponent(providerToTest)}/test`,
        token,
      );
      setHomeMsg(res.message || `Test ${res.status}`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Test de connexion impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function saveProviderCredentials() {
    if (!token || !credProvider) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      await postJson(
        '/api/v1/home/providers/credentials',
        {
          provider: credProvider,
          username: credUsername.trim() || null,
          password: credPassword.trim() || null,
          base_url: credBaseUrl.trim() || null,
        },
        token,
      );
      setCredPassword('');
      setHomeMsg(`Identifiants ${credProvider} enregistrés.`);
      await refreshHomeProviders();
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Sauvegarde des identifiants impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function loadTahomaDevices() {
    if (!token) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await getJson<{ provider: string; devices: { id: string; name: string; device_type?: string }[] }>(
        '/api/v1/home/providers/tahoma/devices',
        token,
      );
      const rows = Array.isArray(res.devices) ? res.devices : [];
      setTahomaDevices(rows);
      setSelectedTahomaDeviceId(rows[0]?.id ?? '');
      setHomeMsg(rows.length > 0 ? `${rows.length} appareil(s) TaHoma chargés.` : 'Aucun appareil TaHoma trouvé.');
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Impossible de charger les appareils TaHoma.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function runTahomaDeviceAction() {
    if (!token || !selectedTahomaDeviceId) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await postJson<{ message: string; status: string }>(
        `/api/v1/home/providers/tahoma/devices/${encodeURIComponent(selectedTahomaDeviceId)}/action`,
        { action: selectedTahomaAction },
        token,
      );
      setHomeMsg(res.message || `Action ${res.status}`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Action TaHoma impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function refreshGroups() {
    if (!token) return;
    try {
      const res = await getJson<{ groups: { name: string; provider: string; device_ids: string[] }[] }>(
        '/api/v1/home/device-groups',
        token,
      );
      const rows = Array.isArray(res.groups) ? res.groups : [];
      setSavedGroups(rows);
      if (rows.length > 0 && !selectedGroupName) setSelectedGroupName(rows[0].name);
    } catch {
      setSavedGroups([]);
    }
  }

  async function saveGroupFromLoadedDevices() {
    if (!token || !groupName.trim() || tahomaDevices.length === 0) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const ids = tahomaDevices.map((d) => d.id).slice(0, 120);
      const res = await postJson<{ groups: { name: string; provider: string; device_ids: string[] }[] }>(
        `/api/v1/home/device-groups/${encodeURIComponent(groupName.trim().toLowerCase())}`,
        { provider: 'tahoma', device_ids: ids },
        token,
      );
      setSavedGroups(res.groups || []);
      setSelectedGroupName(groupName.trim().toLowerCase());
      setHomeMsg(`Groupe « ${groupName.trim()} » enregistré (${ids.length} appareils).`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Enregistrement du groupe impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function saveGroupFromCurrentSelection() {
    if (!token || !groupName.trim() || !selectedTahomaDeviceId) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await postJson<{ groups: { name: string; provider: string; device_ids: string[] }[] }>(
        `/api/v1/home/device-groups/${encodeURIComponent(groupName.trim().toLowerCase())}`,
        { provider: 'tahoma', device_ids: [selectedTahomaDeviceId] },
        token,
      );
      setSavedGroups(res.groups || []);
      setSelectedGroupName(groupName.trim().toLowerCase());
      setHomeMsg(`Groupe « ${groupName.trim()} » mis à jour avec 1 appareil.`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Mise à jour du groupe impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function runGroupAction() {
    if (!token || !selectedGroupName) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await postJson<{ message: string; status: string }>(
        `/api/v1/home/device-groups/${encodeURIComponent(selectedGroupName)}/action`,
        { action: selectedTahomaAction },
        token,
      );
      setHomeMsg(res.message || `Groupe ${res.status}`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Action groupe impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  async function deleteSelectedGroup() {
    if (!token || !selectedGroupName) return;
    setHomeBusy(true);
    setHomeMsg('');
    try {
      const res = await deleteJson<{ groups: { name: string; provider: string; device_ids: string[] }[] }>(
        `/api/v1/home/device-groups/${encodeURIComponent(selectedGroupName)}`,
        token,
      );
      setSavedGroups(res.groups || []);
      setSelectedGroupName(res.groups?.[0]?.name ?? '');
      setHomeMsg(`Groupe « ${selectedGroupName} » supprimé.`);
    } catch (e) {
      setHomeMsg(e instanceof Error ? e.message : 'Suppression du groupe impossible.');
    } finally {
      setHomeBusy(false);
    }
  }

  return (
    <div>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: '#EEF5FF' }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Domotique Home Hub</div>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: C.text2 }}>
          {homeProviders.length > 0
            ? `${homeConnectedCount}/${homeProviders.length} connecteur(s) domotiques connectés.`
            : 'Lecture des connecteurs domotiques...'}
        </p>
        <div style={btnRow}>
          <button
            type="button"
            onClick={() => void runHomeAction('lights', 'off', 'salon')}
            disabled={homeBusy}
            style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: C.terra, color: '#fff', fontWeight: 700, fontSize: 12 }}
          >
            Éteindre lumières salon
          </button>
          <button
            type="button"
            onClick={() => void runHomeAction('heating', 'down')}
            disabled={homeBusy}
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
          >
            Baisser chauffage
          </button>
          <button
            type="button"
            onClick={() => void runHomeAction('ventilation', 'on')}
            disabled={homeBusy}
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
          >
            Activer ventilation
          </button>
          <button
            type="button"
            onClick={() => void runHomeAction('scene', 'on', 'soir')}
            disabled={homeBusy}
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
          >
            Scène soir
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          <input
            value={haUrl}
            onChange={(e) => setHaUrl(e.target.value)}
            placeholder="URL Home Assistant (ex: https://ha.maison.local)"
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12 }}
          />
          <input
            value={haToken}
            onChange={(e) => setHaToken(e.target.value)}
            placeholder="Token long-lived Home Assistant"
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12 }}
          />
          <button
            type="button"
            onClick={() => void connectHomeAssistant()}
            disabled={homeBusy || !haUrl.trim() || !haToken.trim()}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              background: C.lilac,
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              opacity: homeBusy || !haUrl.trim() || !haToken.trim() ? 0.6 : 1,
            }}
          >
            Connecter Home Assistant
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={providerToConnect}
            onChange={(e) => setProviderToConnect(e.target.value)}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 12,
              background: C.white,
            }}
          >
            <option value="google_home">Google Home</option>
            <option value="legrand_control">Legrand Home + Control</option>
            <option value="tahoma">TaHoma</option>
            <option value="sharkclean">SharkClean</option>
            <option value="ezviz">Ezviz</option>
            <option value="verisure">Verisure</option>
            <option value="lsc_smart_connect">LSC Smart Connect</option>
          </select>
          <button
            type="button"
            onClick={() => void connectPlannedProvider()}
            disabled={homeBusy}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 12px',
              background: C.white,
              color: C.text,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Marquer connecté
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={providerToTest}
            onChange={(e) => setProviderToTest(e.target.value)}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 12,
              background: C.white,
            }}
          >
            <option value="home_assistant">Home Assistant</option>
            <option value="google_home">Google Home</option>
            <option value="legrand_control">Legrand Home + Control</option>
            <option value="tahoma">TaHoma</option>
            <option value="sharkclean">SharkClean</option>
            <option value="ezviz">Ezviz</option>
            <option value="verisure">Verisure</option>
            <option value="lsc_smart_connect">LSC Smart Connect</option>
          </select>
          <button
            type="button"
            onClick={() => void testProviderConnection()}
            disabled={homeBusy}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 12px',
              background: C.white,
              color: C.text,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Tester connexion
          </button>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: `1px dashed ${C.border}`, background: C.white }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Credentials provider (TaHoma en priorité)</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <select
              value={credProvider}
              onChange={(e) => setCredProvider(e.target.value)}
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, background: C.white }}
            >
              <option value="tahoma">TaHoma</option>
              <option value="legrand_control">Legrand Home + Control</option>
              <option value="verisure">Verisure</option>
              <option value="ezviz">Ezviz</option>
              <option value="sharkclean">SharkClean</option>
            </select>
            <input
              value={credUsername}
              onChange={(e) => setCredUsername(e.target.value)}
              placeholder="Login / email provider"
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12 }}
            />
            <input
              value={credPassword}
              onChange={(e) => setCredPassword(e.target.value)}
              placeholder="Mot de passe provider"
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12 }}
            />
            <input
              value={credBaseUrl}
              onChange={(e) => setCredBaseUrl(e.target.value)}
              placeholder="Base URL API (optionnel)"
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12 }}
            />
            <button
              type="button"
              onClick={() => void saveProviderCredentials()}
              disabled={homeBusy || !credUsername.trim() || !credPassword.trim()}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '8px 12px',
                background: C.terra,
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                opacity: homeBusy || !credUsername.trim() || !credPassword.trim() ? 0.6 : 1,
              }}
            >
              Enregistrer credentials
            </button>
          </div>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: `1px dashed ${C.border}`, background: '#F7FBFF' }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Contrôle TaHoma devices</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => void loadTahomaDevices()}
              disabled={homeBusy}
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
            >
              Charger appareils TaHoma
            </button>
            <button
              type="button"
              onClick={() => void refreshGroups()}
              disabled={homeBusy}
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
            >
              Charger groupes
            </button>
          </div>
          {tahomaDevices.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <select
                value={selectedTahomaDeviceId}
                onChange={(e) => setSelectedTahomaDeviceId(e.target.value)}
                style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, background: C.white }}
              >
                {tahomaDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.device_type ? ` (${d.device_type})` : ''}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={selectedTahomaAction}
                  onChange={(e) => setSelectedTahomaAction(e.target.value)}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, background: C.white }}
                >
                  <option value="toggle">toggle</option>
                  <option value="on">on</option>
                  <option value="off">off</option>
                  <option value="open">open</option>
                  <option value="close">close</option>
                  <option value="stop">stop</option>
                </select>
                <button
                  type="button"
                  onClick={() => void runTahomaDeviceAction()}
                  disabled={homeBusy || !selectedTahomaDeviceId}
                  style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: C.terra, color: '#fff', fontWeight: 700, fontSize: 12 }}
                >
                  Exécuter action TaHoma
                </button>
              </div>
            </div>
          ) : null}
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, color: C.text2 }}>Groupes favoris (ex: nuit, matin, rdc)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nom du groupe"
                style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12 }}
              />
              <button
                type="button"
                onClick={() => void saveGroupFromLoadedDevices()}
                disabled={homeBusy || !groupName.trim() || tahomaDevices.length === 0}
                style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: C.lilac, color: '#fff', fontWeight: 700, fontSize: 12 }}
              >
                Sauver groupe
              </button>
              <button
                type="button"
                onClick={() => void saveGroupFromCurrentSelection()}
                disabled={homeBusy || !groupName.trim() || !selectedTahomaDeviceId}
                style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
              >
                Sauver avec appareil sélectionné
              </button>
            </div>
            {savedGroups.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={selectedGroupName}
                  onChange={(e) => setSelectedGroupName(e.target.value)}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, background: C.white }}
                >
                  {savedGroups.map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.name} ({g.device_ids.length})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void runGroupAction()}
                  disabled={homeBusy || !selectedGroupName}
                  style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: C.terra, color: '#fff', fontWeight: 700, fontSize: 12 }}
                >
                  Exécuter action groupe
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelectedGroup()}
                  disabled={homeBusy || !selectedGroupName}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', background: C.white, color: C.text, fontWeight: 700, fontSize: 12 }}
                >
                  Supprimer groupe
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {homeMsg ? <div style={{ marginTop: 8, fontSize: 11, color: C.text2 }}>{homeMsg}</div> : null}
        {homeProviders.length > 0 ? (
          <div style={{ marginTop: 8, fontSize: 11, color: C.text2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {homeProviders.map((p) => (
              <span key={p.id} style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 8px', background: p.connected ? '#E7F9ED' : C.white }}>
                {p.label}: {p.connected ? 'connecté' : 'non connecté'}
              </span>
            ))}
          </div>
        ) : null}
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: C.lilacL }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Outlook / Microsoft 365</div>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: C.text2 }}>
          {microsoftConnected
            ? 'Connecté — agenda pro synchronisé avec MajorDome.'
            : msConfigured
              ? 'Connecte ton calendrier Outlook ou Microsoft 365.'
              : 'Connexion Outlook : à activer sur le serveur (clés Azure — voir docs/MICROSOFT_OAUTH_SETUP.md).'}
        </p>
        <div style={btnRow}>
          <button
            type="button"
            disabled={!msConfigured}
            onClick={onConnectMicrosoft}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              background: C.lilac,
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              opacity: msConfigured ? 1 : 0.5,
            }}
          >
            {microsoftConnected ? 'Reconnecter Outlook' : 'Connecter Outlook'}
          </button>
          {microsoftConnected ? (
            <button
              type="button"
              onClick={onSyncMicrosoft}
              disabled={calendarSyncBusy === 'microsoft_calendar'}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 12px',
                background: C.white,
                color: C.text,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {calendarSyncBusy === 'microsoft_calendar' ? 'Sync…' : 'Synchroniser'}
            </button>
          ) : null}
        </div>
      </GlassCard>
      <GlassCard C={C} style={{ padding: 12, marginBottom: 10, background: C.terraXL }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Google Calendar</div>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: C.text2 }}>
          {googleConnected
            ? 'Connecté — tes événements se synchronisent.'
            : googleConfigured
              ? 'Connecte ton agenda pour remplir automatiquement ton planning.'
              : 'Connexion Google : à configurer sur le serveur.'}
        </p>
        <div style={btnRow}>
          <button
            type="button"
            disabled={!googleConfigured}
            onClick={onConnectGoogle}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              background: C.terra,
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              opacity: googleConfigured ? 1 : 0.5,
            }}
          >
            {googleConnected ? 'Reconnecter Google' : 'Connecter Google Calendar'}
          </button>
          {googleConnected ? (
            <button
              type="button"
              onClick={onSyncGoogle}
              disabled={calendarSyncBusy === 'google_calendar'}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 12px',
                background: C.white,
                color: C.text,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {calendarSyncBusy === 'google_calendar' ? 'Sync…' : 'Synchroniser'}
            </button>
          ) : null}
        </div>
      </GlassCard>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
        Raccourcis web et messages Alfred pour les autres services.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          onClick={() => window.open('https://www.doctolib.fr/', '_blank')}
          style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}
        >
          Doctolib (web)
        </button>
        <button
          type="button"
          onClick={() => window.open('https://www.pronote.com/', '_blank')}
          style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}
        >
          Pronote / ENT (web)
        </button>
        <button
          type="button"
          onClick={() => window.open('https://www.picnic.app/fr/', '_blank')}
          style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}
        >
          Picnic / Instacart
        </button>
        <button
          type="button"
          onClick={() =>
            onAlfredPrompt(
              `Prépare un message WhatsApp pour ${partenaireName} pour répartir les tâches de ce soir`,
            )
          }
          style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}
        >
          Msg WhatsApp (Alfred)
        </button>
        <button
          type="button"
          onClick={() => onAlfredPrompt('Crée une routine vocale Alexa et Google Home pour rappel tâches')}
          style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: C.white, fontSize: 11 }}
        >
          Alexa/Home/Siri
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 8,
            background: C.terraXL,
            color: C.terra,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Configurer connexions
        </button>
      </div>
    </div>
  );
}
