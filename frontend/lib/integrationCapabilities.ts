/** Capacités réelles du serveur (GET /integrations/capabilities). */

export type IntegrationCapabilities = {
  apple_caldav_available: boolean;
  microsoft_oauth_configured?: boolean;
  google_oauth_configured?: boolean;
  drive_automation_enabled?: boolean;
  home_assistant_auto_when_connected?: boolean;
  llm_configured?: boolean;
  realtime_configured?: boolean;
  vault_secrets_enabled?: boolean;
  telegram_configured?: boolean;
  whatsapp_configured?: boolean;
};

export const DEFAULT_INTEGRATION_CAPABILITIES: IntegrationCapabilities = {
  apple_caldav_available: true,
};
