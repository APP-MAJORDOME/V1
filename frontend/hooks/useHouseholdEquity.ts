'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../lib/api';
import type { EquityShare } from '../lib/selectors';

export type EquityApiResponse = {
  shares: { member_id: number; name: string; pct: number; minutes: number; color: string }[];
  weeks: { label: string; members: Record<string, number> }[];
  categories: { key: string; label: string; members: Record<string, number> }[];
  suggestions: {
    task_id: string;
    task: string;
    from: string;
    to: string;
    message: string;
    save: string;
  }[];
  mode: string;
};

export function useHouseholdEquity(token: string | null) {
  const [data, setData] = useState<EquityApiResponse | null>(null);
  const [mode, setMode] = useState<'execution' | 'planning' | 'combined'>('combined');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getJson<EquityApiResponse>(`/api/v1/household/equity?mode=${mode}`, token);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, mode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shares: EquityShare[] = (data?.shares ?? []).map((s) => ({
    name: s.name,
    pct: s.pct,
    color: s.color,
  }));

  const proposeTransfer = useCallback(
    async (taskId: string, toMemberId: number) => {
      if (!token) return null;
      return postJson<{ status: string; assigned_to: string }>(
        '/api/v1/household/equity/propose-transfer',
        { task_id: Number(taskId), to_member_id: toMemberId },
        token,
      );
    },
    [token],
  );

  return { data, shares, mode, setMode, loading, refresh, proposeTransfer };
}
