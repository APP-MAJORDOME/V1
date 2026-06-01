'use client';

import { useCallback, useEffect, useState } from 'react';
import { postJson } from '../lib/api';
import {
  type ConnectedAccountLike,
  type OAuthStartResponse,
  readOAuthCallbackNotice,
  stripUrlSearchKeys,
  syncAllConnectedCalendars,
  syncCalendarAccount,
  integrationErrorMessage,
} from '../lib/calendarIntegrations';

export type CalendarSyncProvider = 'google_calendar' | 'microsoft_calendar' | 'all';

export type UseCalendarConnectionsOptions = {
  token: string | null;
  accounts: ConnectedAccountLike[];
  onReload: (token: string) => void | Promise<void>;
  onToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  onOAuthSuccess?: () => void;
};

export function useCalendarConnections({
  token,
  accounts,
  onReload,
  onToast,
  onOAuthSuccess,
}: UseCalendarConnectionsOptions) {
  const [syncBusy, setSyncBusy] = useState<string | null>(null);

  const connectGoogle = useCallback(async () => {
    if (!token) {
      onToast('info', 'Connecte-toi d’abord pour lier Google Calendar.');
      return;
    }
    try {
      const res = await postJson<OAuthStartResponse>('/api/v1/integrations/google/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      onToast('error', integrationErrorMessage(e, 'Connexion Google impossible'));
    }
  }, [token, onToast]);

  const connectMicrosoft = useCallback(async () => {
    if (!token) {
      onToast('info', 'Connecte-toi d’abord pour lier Outlook.');
      return;
    }
    try {
      const res = await postJson<OAuthStartResponse>('/api/v1/integrations/microsoft/oauth/start', {}, token);
      window.location.href = res.authorization_url;
    } catch (e) {
      onToast('error', integrationErrorMessage(e, 'Connexion Microsoft impossible'));
    }
  }, [token, onToast]);

  const syncProvider = useCallback(
    async (provider: 'google_calendar' | 'microsoft_calendar') => {
      if (!token) return;
      const account = accounts.find((a) => a.provider === provider && a.status === 'connected');
      if (!account?.id) {
        onToast('info', 'Connecte d’abord ce calendrier.');
        return;
      }
      setSyncBusy(provider);
      try {
        const status = await syncCalendarAccount(token, account.id);
        onToast('success', `Synchronisation : ${status}`);
        await onReload(token);
      } catch (e) {
        onToast('error', integrationErrorMessage(e, 'Synchronisation impossible'));
      } finally {
        setSyncBusy(null);
      }
    },
    [token, accounts, onReload, onToast],
  );

  const syncAll = useCallback(async () => {
    if (!token) return;
    const connected = accounts.filter(
      (a) =>
        a.status === 'connected' &&
        (a.provider === 'google_calendar' ||
          a.provider === 'microsoft_calendar' ||
          a.provider === 'apple_calendar'),
    );
    if (connected.length === 0) {
      onToast('info', 'Connecte un calendrier dans Intégrations.');
      return false;
    }
    setSyncBusy('all');
    try {
      const statuses = await syncAllConnectedCalendars(token, accounts);
      onToast('success', `Agenda mis à jour (${statuses.join(', ')})`);
      await onReload(token);
      return true;
    } catch (e) {
      onToast('error', integrationErrorMessage(e, 'Synchronisation impossible'));
      return false;
    } finally {
      setSyncBusy(null);
    }
  }, [token, accounts, onReload, onToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { notice, keysToStrip } = readOAuthCallbackNotice(window.location.search);
    if (!notice) return;
    onToast(notice.kind, notice.message);
    stripUrlSearchKeys(keysToStrip);
    if (notice.kind === 'success') {
      onOAuthSuccess?.();
      if (token) void onReload(token);
    }
  }, [token, onToast, onOAuthSuccess, onReload]);

  return {
    syncBusy,
    connectGoogle,
    connectMicrosoft,
    syncProvider,
    syncAll,
    isSyncingAll: syncBusy === 'all',
  };
}
