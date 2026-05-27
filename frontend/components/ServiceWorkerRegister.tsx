'use client';

import { useEffect } from 'react';

/** Enregistre le SW minimal (notifications + focus app) en production. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore — PWA optionnelle */
    });
  }, []);

  return null;
}
