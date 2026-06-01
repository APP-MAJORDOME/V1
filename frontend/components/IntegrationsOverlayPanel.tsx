'use client';

import {
  type ConnectedAccountLike,
  type IntegrationStatus,
  integrationConfigured,
  isCalendarConnected,
} from '../lib/calendarIntegrations';

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

export type IntegrationsOverlayPanelProps = {
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
  const googleConnected = isCalendarConnected(accounts, 'google_calendar');
  const microsoftConnected = isCalendarConnected(accounts, 'microsoft_calendar');
  const msConfigured = integrationConfigured(integrationStatuses, 'microsoft_calendar');
  const googleConfigured = integrationConfigured(integrationStatuses, 'google_calendar');
  const btnRow = { display: 'flex' as const, flexWrap: 'wrap' as const, gap: 8 };

  return (
    <div>
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
