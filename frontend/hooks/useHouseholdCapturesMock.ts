'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CAPTURE_CHIPS,
  filterCapturesByChip,
  INITIAL_MOCK_CAPTURES,
  INITIAL_SALON_MESSAGES,
  pendingCaptureCount,
  type CaptureChip,
  type HouseholdCapture,
  type SalonMessage,
} from '../lib/householdCaptures';

export function useHouseholdCapturesMock() {
  const [captures, setCaptures] = useState<HouseholdCapture[]>(INITIAL_MOCK_CAPTURES);
  const [salonMessages] = useState<SalonMessage[]>(INITIAL_SALON_MESSAGES);
  const [captureChip, setCaptureChip] = useState<CaptureChip>('all');

  const visibleCaptures = useMemo(
    () => filterCapturesByChip(captures, captureChip).filter((c) => c.status === 'pending'),
    [captures, captureChip],
  );

  const pendingCount = useMemo(() => pendingCaptureCount(captures), [captures]);

  const approveCapture = useCallback((id: string) => {
    setCaptures((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c)),
    );
  }, []);

  const rejectCapture = useCallback((id: string) => {
    setCaptures((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c)),
    );
  }, []);

  return {
    captures,
    visibleCaptures,
    pendingCount,
    captureChip,
    setCaptureChip,
    captureChips: CAPTURE_CHIPS,
    salonMessages,
    approveCapture,
    rejectCapture,
  };
}
