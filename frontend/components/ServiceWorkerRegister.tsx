'use client';

import { useEffect } from 'react';

/** Enregistre le SW minimal (notifications + focus app) en production. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        void reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch(() => {
        /* ignore — PWA optionnelle */
      });
  }, []);

  return null;
}
