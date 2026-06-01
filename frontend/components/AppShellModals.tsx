'use client';

import type { ComponentProps, RefObject } from 'react';
import type React from 'react';
import { AlexModal } from './AlexModal';
import { CoffreModal } from './CoffreModal';
import { DebordeeModal } from './DebordeeModal';
import { EquiteModal } from './EquiteModal';
import type { DebordeeResult } from './DebordeeModal';

type MajordomePalette = Record<string, string>;

export type AppShellModalsProps = {
  C: MajordomePalette;
  modalDebordee: ComponentProps<typeof DebordeeModal>['phase'];
  openTasks: ComponentProps<typeof DebordeeModal>['openTasks'];
  debordeeResult: DebordeeResult | null;
  family: { prenom: string; partenaire: string; enfant: string };
  primaryMemberId: number | null;
  partnerMemberId: number | null;
  childMemberId: number | null;
  householdMembers: ComponentProps<typeof DebordeeModal>['householdMembers'];
  token: string;
  taskAssignBusyId: number | null;
  taskCompleteBusyId: number | null;
  onCloseDebordee: () => void;
  onLaunchDebordee: () => void;
  onAssignTask: ComponentProps<typeof DebordeeModal>['onAssign'];
  onCompleteTask: ComponentProps<typeof DebordeeModal>['onDone'];
  modalAlex: boolean;
  alexTasksList: ComponentProps<typeof AlexModal>['tasks'];
  alexDoneIds: number[];
  alexNotified: boolean;
  onCloseAlex: () => void;
  onToggleAlexDone: (taskId: number) => void;
  onNotifyPrimary: () => void | Promise<void>;
  modalCoffre: boolean;
  loading: boolean;
  docVault: ComponentProps<typeof CoffreModal>['docVault'];
  docStorageSummary: ComponentProps<typeof CoffreModal>['docStorageSummary'];
  docCat: string;
  onDocCatChange: (cat: string) => void;
  docSearch: string;
  onDocSearchChange: (v: string) => void;
  docAddedFlash: boolean;
  docEdit: ComponentProps<typeof CoffreModal>['docEdit'];
  onDocEditChange: ComponentProps<typeof CoffreModal>['onDocEditChange'];
  docEditSaving: boolean;
  docAttachmentReplaceRef: RefObject<HTMLInputElement | null>;
  docPhotoInputRef: RefObject<HTMLInputElement | null>;
  onCloseCoffre: () => void;
  onRefreshCoffre: () => void;
  onQuickAddDoc: () => void;
  onOpenDocEdit: ComponentProps<typeof CoffreModal>['onOpenDocEdit'];
  onSaveDocEdit: () => void;
  onDownloadAttachment: ComponentProps<typeof CoffreModal>['onDownloadAttachment'];
  onUploadAttachment: ComponentProps<typeof CoffreModal>['onUploadAttachment'];
  onRemoveAttachment: ComponentProps<typeof CoffreModal>['onRemoveAttachment'];
  onToggleDocUrgent: ComponentProps<typeof CoffreModal>['onToggleUrgent'];
  onDeleteDoc: ComponentProps<typeof CoffreModal>['onDeleteDoc'];
  onCreateDocFromPhoto: ComponentProps<typeof CoffreModal>['onCreateFromPhoto'];
  onOpenDocEmailDraft: () => void;
  modalEquite: boolean;
  equiteTab: ComponentProps<typeof EquiteModal>['equiteTab'];
  onEquiteTabChange: ComponentProps<typeof EquiteModal>['onEquiteTabChange'];
  equityWeeks: ComponentProps<typeof EquiteModal>['equityWeeks'];
  equityCategories: ComponentProps<typeof EquiteModal>['equityCategories'];
  equitySuggestions: ComponentProps<typeof EquiteModal>['equitySuggestions'];
  equitePlanText: string;
  equitePlanLoading: boolean;
  onCloseEquite: () => void;
  onAlfredPrompt: (text: string) => void;
};

export function AppShellModals({
  C,
  modalDebordee,
  openTasks,
  debordeeResult,
  family,
  primaryMemberId,
  partnerMemberId,
  childMemberId,
  householdMembers,
  token,
  taskAssignBusyId,
  taskCompleteBusyId,
  onCloseDebordee,
  onLaunchDebordee,
  onAssignTask,
  onCompleteTask,
  modalAlex,
  alexTasksList,
  alexDoneIds,
  alexNotified,
  onCloseAlex,
  onToggleAlexDone,
  onNotifyPrimary,
  modalCoffre,
  loading,
  docVault,
  docStorageSummary,
  docCat,
  onDocCatChange,
  docSearch,
  onDocSearchChange,
  docAddedFlash,
  docEdit,
  onDocEditChange,
  docEditSaving,
  docAttachmentReplaceRef,
  docPhotoInputRef,
  onCloseCoffre,
  onRefreshCoffre,
  onQuickAddDoc,
  onOpenDocEdit,
  onSaveDocEdit,
  onDownloadAttachment,
  onUploadAttachment,
  onRemoveAttachment,
  onToggleDocUrgent,
  onDeleteDoc,
  onCreateDocFromPhoto,
  onOpenDocEmailDraft,
  modalEquite,
  equiteTab,
  onEquiteTabChange,
  equityWeeks,
  equityCategories,
  equitySuggestions,
  equitePlanText,
  equitePlanLoading,
  onCloseEquite,
  onAlfredPrompt,
}: AppShellModalsProps) {
  return (
    <>
      <DebordeeModal
        C={C}
        phase={modalDebordee}
        openTasks={openTasks}
        debordeeResult={debordeeResult}
        prenom={family.prenom}
        partenaire={family.partenaire}
        enfant={family.enfant}
        primaryMemberId={primaryMemberId}
        partnerMemberId={partnerMemberId}
        childMemberId={childMemberId}
        householdMembers={householdMembers}
        token={token}
        taskAssignBusyId={taskAssignBusyId}
        taskCompleteBusyId={taskCompleteBusyId}
        onClose={onCloseDebordee}
        onLaunch={onLaunchDebordee}
        onAssign={onAssignTask}
        onDone={onCompleteTask}
      />
      <AlexModal
        C={C}
        open={modalAlex}
        prenom={family.prenom}
        partenaire={family.partenaire}
        enfant={family.enfant}
        tasks={alexTasksList}
        doneIds={alexDoneIds}
        notified={alexNotified}
        primaryMemberId={primaryMemberId}
        partnerMemberId={partnerMemberId}
        childMemberId={childMemberId}
        householdMembers={householdMembers}
        token={token}
        taskAssignBusyId={taskAssignBusyId}
        taskCompleteBusyId={taskCompleteBusyId}
        onClose={onCloseAlex}
        onToggleDone={onToggleAlexDone}
        onAssign={onAssignTask}
        onDone={onCompleteTask}
        onNotifyPrimary={onNotifyPrimary}
      />
      <CoffreModal
        C={C}
        open={modalCoffre}
        token={token}
        loading={loading}
        prenom={family.prenom}
        docVault={docVault}
        docStorageSummary={docStorageSummary}
        docCat={docCat}
        onDocCatChange={onDocCatChange}
        docSearch={docSearch}
        onDocSearchChange={onDocSearchChange}
        docAddedFlash={docAddedFlash}
        docEdit={docEdit}
        onDocEditChange={onDocEditChange}
        docEditSaving={docEditSaving}
        docAttachmentReplaceRef={docAttachmentReplaceRef as React.RefObject<HTMLInputElement>}
        docPhotoInputRef={docPhotoInputRef as React.RefObject<HTMLInputElement>}
        onClose={onCloseCoffre}
        onRefresh={onRefreshCoffre}
        onQuickAdd={onQuickAddDoc}
        onOpenDocEdit={onOpenDocEdit}
        onSaveDocEdit={onSaveDocEdit}
        onDownloadAttachment={onDownloadAttachment}
        onUploadAttachment={onUploadAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onToggleUrgent={onToggleDocUrgent}
        onDeleteDoc={onDeleteDoc}
        onCreateFromPhoto={onCreateDocFromPhoto}
        onOpenDocEmailDraft={onOpenDocEmailDraft}
      />
      <EquiteModal
        C={C}
        open={modalEquite}
        prenom={family.prenom}
        partenaire={family.partenaire}
        enfant={family.enfant}
        equiteTab={equiteTab}
        onEquiteTabChange={onEquiteTabChange}
        equityWeeks={equityWeeks}
        equityCategories={equityCategories}
        equitySuggestions={equitySuggestions}
        equitePlanText={equitePlanText}
        equitePlanLoading={equitePlanLoading}
        onClose={onCloseEquite}
        onAlfredPrompt={onAlfredPrompt}
      />
    </>
  );
}
