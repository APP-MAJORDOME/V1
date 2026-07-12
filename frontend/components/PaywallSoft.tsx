'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../lib/api';

export type SubscriptionStatus = {
  tier: string;
  captures_limit: number;
  captures_used: number;
  captures_remaining: number;
  premium: boolean;
  stripe_configured?: boolean;
  price_label?: string;
  can_manage?: boolean;
};

export function useHouseholdSubscription(token: string | null) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return null;
    try {
      const next = await getJson<SubscriptionStatus>('/api/v1/household/subscription', token);
      setStatus(next);
      return next;
    } catch {
      setStatus(null);
      return null;
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCheckout = useCallback(async () => {
    if (!token) throw new Error('Session requise');
    setBusy(true);
    try {
      const res = await postJson<{ url?: string }>('/api/v1/billing/checkout', {}, token);
      if (!res.url) throw new Error('URL de paiement manquante');
      window.location.href = res.url;
    } finally {
      setBusy(false);
    }
  }, [token]);

  const openPortal = useCallback(async () => {
    if (!token) throw new Error('Session requise');
    setBusy(true);
    try {
      const res = await postJson<{ url?: string }>('/api/v1/billing/portal', {}, token);
      if (!res.url) throw new Error('URL portail manquante');
      window.location.href = res.url;
    } finally {
      setBusy(false);
    }
  }, [token]);

  return { status, busy, refresh, startCheckout, openPortal };
}

export function PaywallSoft({
  C,
  status,
  onUpgrade,
  busy,
}: {
  C: Record<string, string>;
  status: SubscriptionStatus | null;
  onUpgrade?: () => void;
  busy?: boolean;
}) {
  if (!status || status.premium || status.captures_remaining > 5) return null;
  const exhausted = status.captures_remaining <= 0;
  return (
    <div
      style={{
        margin: '10px 16px',
        padding: '12px 14px',
        borderRadius: 14,
        background: exhausted ? C.redL ?? '#FDEAEA' : C.terraXL,
        border: `1px solid ${exhausted ? C.red : C.terra}44`,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        {exhausted ? 'Captures Alfred épuisées ce mois-ci' : `${status.captures_remaining} captures restantes`}
      </div>
      <p style={{ fontSize: 11, color: C.text2, margin: '0 0 8px', lineHeight: 1.45 }}>
        {exhausted
          ? `Alfred a capturé ${status.captures_used} choses ce mois-ci — environ ${Math.round(status.captures_used * 8)} min de charge mentale en moins. Passe en Premium Foyer pour continuer.`
          : 'Le cœur du foyer reste gratuit. Premium débloque Alfred illimité et les suggestions d’équité.'}
      </p>
      {onUpgrade ? (
        <button
          type="button"
          onClick={onUpgrade}
          disabled={busy}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '8px 12px',
            background: C.terra,
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Redirection…' : `Voir Premium Foyer — ${status.price_label || '6,90 €/mois'}`}
        </button>
      ) : null}
    </div>
  );
}
