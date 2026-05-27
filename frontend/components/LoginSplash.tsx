'use client';

import { useEffect, useState } from 'react';
import { MajordomeMark, MajordomeWordmark } from './BrandLogo';

const SPLASH_MS = 2600;

/** Animation d’intro (logo + wordmark) avant le formulaire de connexion. */
export function LoginSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'mark' | 'wordmark' | 'out'>('mark');

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('wordmark'), 550);
    const t2 = window.setTimeout(() => setPhase('out'), 1900);
    const t3 = window.setTimeout(() => onDone(), SPLASH_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <div
      className={`login-splash login-splash--${phase}`}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: 'linear-gradient(160deg, #FDEAE5 0%, #F7F0E8 55%, #F0EBFA 100%)',
        pointerEvents: 'none',
      }}
    >
      <div className="login-splash__mark">
        <MajordomeMark size={88} />
      </div>
      <div className="login-splash__wordmark">
        <MajordomeWordmark maxHeight={36} />
      </div>
    </div>
  );
}
