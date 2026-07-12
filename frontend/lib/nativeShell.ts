/** Détecte téléphone / tablette tactile / PWA — shell plein écran (pas le cadre démo 390px). */
export function shouldUseNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth || 0;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari « Sur l'écran d'accueil »
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return w <= 1024 || coarse || standalone || (touch && w < 1280);
}

export function applyNativeShellClass(): void {
  if (typeof document === 'undefined') return;
  if (shouldUseNativeShell()) {
    document.documentElement.dataset.nativeShell = 'true';
  } else {
    delete document.documentElement.dataset.nativeShell;
  }
}

/** Snippet inline (layout) — exécuté avant le premier paint React. */
export const NATIVE_SHELL_BOOT_SCRIPT = `(function(){try{var w=window.innerWidth||0,t='ontouchstart'in window||navigator.maxTouchPoints>0,c=window.matchMedia('(pointer:coarse)').matches,s=window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone===true;if(w<=1024||c||s||(t&&w<1280))document.documentElement.dataset.nativeShell='true';window.addEventListener('resize',function(){var nw=window.innerWidth||0,nt='ontouchstart'in window||navigator.maxTouchPoints>0,nc=window.matchMedia('(pointer:coarse)').matches,ns=window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone===true;if(nw<=1024||nc||ns||(nt&&nw<1280))document.documentElement.dataset.nativeShell='true';else delete document.documentElement.dataset.nativeShell;});}catch(e){}})();`;
