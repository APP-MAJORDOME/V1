'use client';

import { useEffect, useState } from 'react';
import {
  type ConnectedAccountLike,
  type IntegrationStatus,
  integrationConfigured,
  isCalendarConnected,
} from '../lib/calendarIntegrations';
import { getJson, postJson } from '../lib/api';
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
