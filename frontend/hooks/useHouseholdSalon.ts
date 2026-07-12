'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAPTURE_CHIPS, pendingCaptureCount, type CaptureChip, type HouseholdCapture, type SalonMessage } from '../lib/householdCaptures';
import {
  fetchSalonCaptures,
  fetchSalonMessages,
  mapCaptureApi,
  mapSalonMessageApi,
  patchSalonCapture,
  postSalonMessage,
} from '../lib/householdSalon';

const POLL_MS = 12_000;

export function useHouseholdSalon(
  token: string | null,
  selfName: string,
  /** Quand true (onglet Salon ouvert), poll léger pour voir les messages du partenaire. */
  active = false,
) {
  const [captures, setCaptures] = useState<HouseholdCapture[]>([]);
  const [salonMessages, setSalonMessages] = useState<SalonMessage[]>([]);
  const [captureChip, setCaptureChip] = useState<CaptureChip>('all');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quietRefreshRef = useRef(false);

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!token) return;
    const quiet = Boolean(opts?.quiet);
    if (!quiet) setLoading(true);
    quietRefreshRef.current = quiet;
    setError(null);
    try {
      const [msgRes, capRes] = await Promise.all([
        fetchSalonMessages(token, true),
        fetchSalonCaptures(token),
      ]);
      const mappedCaps = capRes.map(mapCaptureApi);
      setCaptures(mappedCaps);
      setSalonMessages(msgRes.map((m) => mapSalonMessageApi(m, selfName, mappedCaps)));
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'Salon indisponible');
    } finally {
      if (!quiet) setLoading(false);
      quietRefreshRef.current = false;
    }
  }, [token, selfName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token || !active) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (quietRefreshRef.current) return;
      void refresh({ quiet: true });
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, active, refresh]);

  const visibleCaptures = useMemo(() => {
    const pending = captures.filter((c) => c.status === 'pending');
    if (captureChip === 'all') return pending;
    return pending.filter((c) => c.chip === captureChip);
  }, [captures, captureChip]);

  const pendingCount = useMemo(() => pendingCaptureCount(captures), [captures]);

  const approveCapture = useCallback(
    async (id: string) => {
      if (!token) return;
      const numId = Number(id);
      if (!Number.isFinite(numId)) return;
      try {
        const res = await patchSalonCapture(token, numId, 'approved');
        setCaptures((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c)),
        );
        return res.message;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Validation impossible');
        return null;
      }
    },
    [token],
  );

  const rejectCapture = useCallback(
    async (id: string) => {
      if (!token) return;
      const numId = Number(id);
      if (!Number.isFinite(numId)) return;
      try {
        await patchSalonCapture(token, numId, 'rejected');
        setCaptures((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action impossible');
      }
    },
    [token],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!token || !text.trim()) return;
      setSending(true);
      setError(null);
      try {
        await postSalonMessage(token, text.trim());
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Envoi impossible');
      } finally {
        setSending(false);
      }
    },
    [token, refresh],
  );

  return {
    captures,
    visibleCaptures,
    pendingCount,
    captureChip,
    setCaptureChip,
    captureChips: CAPTURE_CHIPS,
    salonMessages,
    loading,
    sending,
    error,
    refresh,
    approveCapture,
    rejectCapture,
    sendMessage,
  };
}
