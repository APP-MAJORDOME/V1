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

/** Bandeau court : données synchronisées pour le foyer. */
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
      Tes données de foyer sont synchronisées et partagées entre les appareils de ton compte.{' '}
      <PrivacyPolicyLink C={C} />
    </p>
  );
}
