'use client';

import { useEffect, useRef } from 'react';

const DEFAULT_POLL_MS = 12_000;

/**
 * Rafraîchissement silencieux tant que `active` est vrai (onglet / overlay ouvert).
 * Pause si l’onglet navigateur est en arrière-plan.
 */
export function useSoftSyncPoll(
  active: boolean,
  onTick: () => void | Promise<void>,
  intervalMs: number = DEFAULT_POLL_MS,
) {
  const onTickRef = useRef(onTick);
  const inFlightRef = useRef(false);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!active) return;

    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      void Promise.resolve(onTickRef.current()).finally(() => {
        inFlightRef.current = false;
      });
    };

    const id = window.setInterval(run, intervalMs);
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, intervalMs]);
}
