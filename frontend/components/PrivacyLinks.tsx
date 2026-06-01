'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { PRIVACY_SETTINGS_HREF } from '../lib/privacy';

export function PrivacyPolicyLink({
  C,
  style,
}: {
  C: Record<string, string>;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={PRIVACY_SETTINGS_HREF}
      style={{
        color: C.terra,
        fontWeight: 700,
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        ...style,
      }}
    >
      Politique de confidentialité
    </Link>
  );
}

/** Bandeau court : données locales / cache navigateur. */
export function LocalDataNotice({
  C,
  compact = false,
}: {
  C: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <p
      style={{
        margin: compact ? '8px 0 0' : '10px 0 0',
        fontSize: compact ? 10 : 11,
        color: C.text2,
        lineHeight: 1.45,
      }}
    >
      Certaines données (listes, humeur, mémoire Alfred) peuvent rester sur cet appareil tant que la
      synchronisation complète n&apos;est pas active — vider le cache du navigateur peut les effacer.{' '}
      <PrivacyPolicyLink C={C} />
    </p>
  );
}
