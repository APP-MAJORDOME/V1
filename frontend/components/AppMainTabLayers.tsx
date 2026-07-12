'use client';

import type { ComponentProps, ReactNode } from 'react';
import type { AppLayerId } from '../lib/appNavigation';
import { HomeTabPanel } from './HomeTabPanel';
import { AgendaTabPanel } from './AgendaTabPanel';
import { MoiTabPanel } from './MoiTabPanel';
import { SalonFoyerPanel, type SalonFoyerPanelProps } from './SalonFoyerPanel';

export type HomeTabPanelProps = ComponentProps<typeof HomeTabPanel>;
export type AgendaTabPanelProps = ComponentProps<typeof AgendaTabPanel>;
export type MoiTabPanelProps = ComponentProps<typeof MoiTabPanel>;

export type AppMainTabLayersProps = {
  layer: AppLayerId;
  home?: HomeTabPanelProps | null;
  salon?: SalonFoyerPanelProps | null;
  agenda?: AgendaTabPanelProps | null;
  moi?: MoiTabPanelProps | null;
};

export function AppMainTabLayers({ layer, home, salon, agenda, moi }: AppMainTabLayersProps): ReactNode {
  if (layer === 'home' && home) return <HomeTabPanel {...home} />;
  if (layer === 'salon' && salon) return <SalonFoyerPanel {...salon} />;
  if (layer === 'agenda' && agenda) return <AgendaTabPanel {...agenda} />;
  if (layer === 'moi' && moi) return <MoiTabPanel {...moi} />;
  return null;
}
