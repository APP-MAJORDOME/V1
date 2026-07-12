'use client';

import { t } from '../lib/i18n';
import { PrivacyPolicyLink } from './PrivacyLinks';

export function EuTrustBanner({
  C,
  compact = false,
}: {
  C: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        padding: compact ? '8px 10px' : '10px 12px',
        borderRadius: 12,
        background: C.sageL ?? '#EAF4F1',
        border: `1px solid ${C.sage ?? '#6BA898'}44`,
        fontSize: compact ? 11 : 12,
        color: C.text2,
        lineHeight: 1.45,
      }}
    >
      <span aria-hidden style={{ fontSize: compact ? 14 : 16 }}>
        🇪🇺
      </span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: C.text }}>{t('trust.eu_hosting')}</span>
      <PrivacyPolicyLink C={C} style={{ fontSize: compact ? 10 : 11 }} />
    </div>
  );
}
