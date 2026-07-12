'use client';

import { useEffect } from 'react';
import { applyNativeShellClass } from '../lib/nativeShell';

/** Maintient data-native-shell à jour (rotation, redimensionnement). */
export function NativeShellSync() {
  useEffect(() => {
    applyNativeShellClass();
    const onResize = () => applyNativeShellClass();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return null;
}
