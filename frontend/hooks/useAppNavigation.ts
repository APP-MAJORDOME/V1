'use client';

import { useCallback, useMemo, useState } from 'react';
import type { HubKey } from '../components/PlusHub';
import type { AppTabId } from '../components/BottomTabBar';
import { resolveAppLayer, type MainTab, type OverlayId } from '../lib/appNavigation';

export type UseAppNavigationOptions = {
  onBeforeOpenWallet?: () => void;
};

export function useAppNavigation(options: UseAppNavigationOptions = {}) {
  const [mainTab, setMainTab] = useState<MainTab>('home');
  const [overlay, setOverlay] = useState<OverlayId | null>(null);

  const goMainTab = useCallback((t: MainTab) => {
    if (t === 'modules') {
      setMainTab('moi');
      setOverlay(null);
      return;
    }
    setMainTab(t);
    if (t === 'alfred') {
      setOverlay('assistant');
      return;
    }
    setOverlay(null);
  }, []);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const handleBottomTab = useCallback(
    (tab: AppTabId) => {
      if (tab === 'home') goMainTab('home');
      else if (tab === 'salon') goMainTab('salon');
      else if (tab === 'agenda') goMainTab('agenda');
      else if (tab === 'alfred') goMainTab('alfred');
      else goMainTab('moi');
    },
    [goMainTab],
  );

  const openModulesHub = useCallback(() => {
    goMainTab('moi');
  }, [goMainTab]);

  const openHubModule = useCallback(
    (hubKey: HubKey) => {
      if (hubKey === 'wallet') {
        options.onBeforeOpenWallet?.();
        setOverlay('courses');
        return;
      }
      if (hubKey === 'integrations') {
        setOverlay('integrations');
        return;
      }
      if (hubKey === 'messages') {
        setMainTab('salon');
        setOverlay(null);
        return;
      }
      setOverlay(hubKey as OverlayId);
    },
    [options],
  );

  const bottomTabActive: AppTabId = useMemo(() => {
    if (overlay === 'assistant' || mainTab === 'alfred') return 'alfred';
    if (mainTab === 'salon') return 'salon';
    if (mainTab === 'agenda') return 'agenda';
    if (mainTab === 'moi') return 'moi';
    return 'home';
  }, [overlay, mainTab]);

  const layer = useMemo(() => resolveAppLayer(overlay, mainTab), [overlay, mainTab]);

  return {
    mainTab,
    setMainTab,
    overlay,
    setOverlay,
    layer,
    goMainTab,
    closeOverlay,
    handleBottomTab,
    openHubModule,
    openModulesHub,
    bottomTabActive,
  };
}
