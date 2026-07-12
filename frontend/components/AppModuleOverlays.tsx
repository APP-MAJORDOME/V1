'use client';

import type { ReactNode } from 'react';
import type { AppLayerId } from '../lib/appNavigation';
import { OverlayChrome } from './OverlayChrome';
import { CoursesPanel, type CourseItem } from './CoursesPanel';
import { DocumentsTabPanel } from './DocumentsTabPanel';
import { FamilleTabPanel } from './FamilleTabPanel';
import { MaisonTabPanel } from './MaisonTabPanel';
import type { DocStorageSummary } from '../lib/documentsUi';
import type { EquityShare } from '../lib/selectors';
import type { EquityApiResponse } from '../hooks/useHouseholdEquity';
import type { Coupon, WalletCard } from '../lib/wallet';
const MODULE_OVERLAY_LAYERS = ['courses', 'maison', 'documents', 'famille'] as const;

export type AppModuleOverlayLayer = (typeof MODULE_OVERLAY_LAYERS)[number];

export function isModuleOverlayLayer(layer: AppLayerId): layer is AppModuleOverlayLayer {
  return (MODULE_OVERLAY_LAYERS as readonly string[]).includes(layer);
}

type FridgeUiItem = { id: number; label: string; expires_at: string; qty: number };

type DocVaultPreview = {
  id: number;
  icon: string;
  name: string;
  cat: string;
  attachmentSizeBytes?: number | null;
};

export type AppModuleOverlaysProps = {
  layer: AppLayerId;
  C: Record<string, string>;
  onBack: () => void;
  token: string | null;
  aiName: string;
  userFirstName: string;
  partenaireName: string;
  enfantName: string;
  coursesTab: 'liste' | 'frigo' | 'wallet';
  onCoursesTabChange: (tab: 'liste' | 'frigo' | 'wallet') => void;
  courses: CourseItem[];
  newCourse: string;
  onNewCourseChange: (value: string) => void;
  doneCourses: number;
  fridgeSorted: FridgeUiItem[];
  fridgeAlertsCount: number;
  fridgeExpiredCount: number;
  activeCoupons: Coupon[];
  expiredCoupons: Coupon[];
  walletCards: WalletCard[];
  onAddCourse: () => void;
  onToggleCourse: (id: number, nextDone: boolean) => void;
  onRemoveCourse: (id: number) => void;
  onDelegateCourse: (id: number) => void;
  onClearDoneCourses: () => void;
  onRemoveFridgeItem: (id: number) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  morningDone: boolean[];
  onToggleMorning: (index: number) => void;
  eveningDone: boolean[];
  onToggleEvening: (index: number) => void;
  onOpenDomotiqueAssistant: () => void;
  homeConnected?: boolean;
  onOpenIntegrations?: () => void;
  docVault: DocVaultPreview[];
  docStorageSummary: DocStorageSummary | null;
  onOpenVaultModal: () => void;
  onOpenDoc: (docId: number) => void;
  onDownloadAttachment: (docId: number) => void | Promise<void>;
  equity: EquityShare[];
  equityMode?: 'execution' | 'planning' | 'combined';
  onEquityModeChange?: (mode: 'execution' | 'planning' | 'combined') => void;
  equitySuggestions?: EquityApiResponse['suggestions'];
  onProposeTransfer?: (taskId: string) => void;
  inviteUrl?: string;
  onShareInvite?: () => void;
  onOpenEquiteModal: () => void;
  onOpenPrivateSpace?: () => void;
};

export function AppModuleOverlays(props: AppModuleOverlaysProps): ReactNode {
  if (!isModuleOverlayLayer(props.layer)) return null;

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
    case 'courses':
      return wrapOv(
        'Courses & Frigo',
        <CoursesPanel
          C={props.C}
          coursesTab={props.coursesTab}
          setCoursesTab={props.onCoursesTabChange}
          courses={props.courses}
          newCourse={props.newCourse}
          setNewCourse={props.onNewCourseChange}
          doneCourses={props.doneCourses}
          fridgeSorted={props.fridgeSorted}
          fridgeAlertsCount={props.fridgeAlertsCount}
          fridgeExpiredCount={props.fridgeExpiredCount}
          activeCoupons={props.activeCoupons}
          expiredCoupons={props.expiredCoupons}
          walletCards={props.walletCards}
          partnerName={props.partenaireName}
          onAddCourse={props.onAddCourse}
          onToggleCourse={props.onToggleCourse}
          onRemoveCourse={props.onRemoveCourse}
          onDelegateCourse={props.onDelegateCourse}
          onClearDoneCourses={props.onClearDoneCourses}
          onRemoveFridgeItem={props.onRemoveFridgeItem}
          pushToast={props.pushToast}
        />,
      );
    case 'maison':
      return wrapOv(
        'Maison',
        <MaisonTabPanel
          C={props.C}
          aiName={props.aiName}
          enfantName={props.enfantName}
          morningDone={props.morningDone}
          onToggleMorning={props.onToggleMorning}
          eveningDone={props.eveningDone}
          onToggleEvening={props.onToggleEvening}
          onOpenAssistant={props.onOpenDomotiqueAssistant}
          homeConnected={props.homeConnected}
          onOpenIntegrations={props.onOpenIntegrations}
        />,
      );    case 'documents':
      return wrapOv(
        'Coffre famille',
        <DocumentsTabPanel
          C={props.C}
          token={props.token}
          docVault={props.docVault}
          docStorageSummary={props.docStorageSummary}
          onOpenVault={props.onOpenVaultModal}
          onOpenDoc={props.onOpenDoc}
          onDownloadAttachment={props.onDownloadAttachment}
        />,
      );
    case 'famille':
      return wrapOv(
        'Famille & équité',
        <FamilleTabPanel
          C={props.C}
          equity={props.equity}
          equityMode={props.equityMode}
          onEquityModeChange={props.onEquityModeChange}
          suggestions={props.equitySuggestions}
          onProposeTransfer={props.onProposeTransfer}
          partenaireName={props.partenaireName}
          inviteUrl={props.inviteUrl}
          onShareInvite={props.onShareInvite}
          onOpenEquiteModal={props.onOpenEquiteModal}
          onOpenPrivateSpace={props.onOpenPrivateSpace}
        />,
      );
    default:
      return null;
  }
}
