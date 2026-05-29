'use client';

import { useEffect, useState } from 'react';

/** true après montage — évite écarts SSR/client sur dates et localStorage. */
export function useIsClient(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
