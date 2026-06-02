'use client';

import type { ReactNode } from 'react';
import type { AppLayerId } from '../lib/appNavigation';
import { OverlayChrome } from './OverlayChrome';
import { RecettesPanel } from './RecettesPanel';
import { RoutinesPanel } from './RoutinesPanel';
import { CourrierPanel } from './CourrierPanel';
import { AlbumsPanel } from './AlbumsPanel';
import { AnniversairesPanel } from './AnniversairesPanel';
import { PoubellesPanel } from './PoubellesPanel';
import { FamilleTempsReelPanel } from './FamilleTempsReelPanel';
import { NotifsStubPanel } from './NotifsStubPanel';
import { IntegrationsOverlayPanel } from './IntegrationsOverlayPanel';
import type { ConnectedAccountLike, IntegrationStatus } from '../lib/calendarIntegrations';

const SECONDARY_OVERLAY_LAYERS = [
  'recettes',
  'routines',
  'courrier',
  'albums',
  'anniversaires',
  'poubelles',
  'messages',
  'notifs',
  'integrations',
] as const;

export type AppSecondaryOverlayLayer = (typeof SECONDARY_OVERLAY_LAYERS)[number];

export function isSecondaryOverlayLayer(layer: AppLayerId): layer is AppSecondaryOverlayLayer {
  return (SECONDARY_OVERLAY_LAYERS as readonly string[]).includes(layer);
}

export type AppSecondaryOverlaysProps = {
  layer: AppLayerId;
  C: Record<string, string>;
  onBack: () => void;
  token: string | null;
  userFirstName: string;
  partenaireName: string;
  enfantName: string;
  courrierImportBusy: boolean;
  onImportCourrierTasks: (titles: string[]) => void | Promise<void>;
  onAddCourseItems: (labels: string[]) => void;
  accounts: ConnectedAccountLike[];
  integrationStatuses: IntegrationStatus[];
  calendarSyncBusy: string | null;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onSyncGoogle: () => void;
  onSyncMicrosoft: () => void;
  onAlfredPrompt: (text: string) => void;
};

export function AppSecondaryOverlays(props: AppSecondaryOverlaysProps): ReactNode {
  if (!isSecondaryOverlayLayer(props.layer)) return null;

  const wrapOv = (title: string, body: ReactNode) => (
    <OverlayChrome
      title={title}
      onBack={props.onBack}
      white={props.C.white}
      border={props.C.border}
      text={props.C.text}
    >
      {body}
    </OverlayChrome>
  );

  switch (props.layer) {
    case 'recettes':
      return wrapOv(
        'Recettes',
        <RecettesPanel C={props.C} onAddIngredients={props.onAddCourseItems} />,
      );
    case 'routines':
      return wrapOv('Routines', <RoutinesPanel C={props.C} userName={props.userFirstName} />);
    case 'courrier':
      return wrapOv(
        'Courrier IA',
        <CourrierPanel
          C={props.C}
          token={props.token}
          busy={props.courrierImportBusy}
          onImportTasks={props.onImportCourrierTasks}
        />,
      );
    case 'albums':
      return wrapOv('Souvenirs', <AlbumsPanel C={props.C} />);
    case 'anniversaires':
      return wrapOv('Anniversaires', <AnniversairesPanel C={props.C} />);
    case 'poubelles':
      return wrapOv('Poubelles & collecte', <PoubellesPanel C={props.C} />);
    case 'messages':
      return wrapOv(
        'Famille temps réel',
        <FamilleTempsReelPanel C={props.C} partenaire={props.partenaireName} enfant={props.enfantName} />,
      );
    case 'notifs':
      return wrapOv('Notifications', <NotifsStubPanel C={props.C} />);
    case 'integrations':
      return wrapOv(
        'Intégrations tierces',
        <IntegrationsOverlayPanel
          token={props.token}
          C={props.C}
          accounts={props.accounts}
          integrationStatuses={props.integrationStatuses}
          calendarSyncBusy={props.calendarSyncBusy}
          onConnectGoogle={props.onConnectGoogle}
          onConnectMicrosoft={props.onConnectMicrosoft}
          onSyncGoogle={props.onSyncGoogle}
          onSyncMicrosoft={props.onSyncMicrosoft}
          onOpenSettings={() => {
            window.location.href = '/settings';
          }}
          onAlfredPrompt={props.onAlfredPrompt}
          partenaireName={props.partenaireName}
        />,
      );
    default:
      return null;
  }
}
