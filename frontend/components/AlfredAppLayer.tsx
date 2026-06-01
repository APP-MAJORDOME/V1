'use client';

import { AlfredChatPanel } from './AlfredChatPanel';
import type { AlfredAssistantController } from '../hooks/useAlfredAssistant';
import type { MainTab, OverlayId } from '../lib/appNavigation';

export type AlfredAppLayerProps = {
  C: Record<string, string>;
  aiName: string;
  firstName: string;
  partenaire: string;
  openTasksCount: number;
  eventsTodayCount: number;
  fridgeAlertsCount: number;
  mentalHeavy: boolean;
  alfred: AlfredAssistantController;
  alfredMemoryCount: number;
  onOpenVault: () => void;
  onOpenDocument: (docId: number) => void;
  onNavigate: (target: {
    overlay: OverlayId | null;
    mainTab?: MainTab;
    coursesTab?: 'liste' | 'frigo' | 'wallet';
  }) => void;
};

export function AlfredAppLayer({
  C,
  aiName,
  firstName,
  partenaire,
  openTasksCount,
  eventsTodayCount,
  fridgeAlertsCount,
  mentalHeavy,
  alfred,
  alfredMemoryCount,
  onOpenVault,
  onOpenDocument,
  onNavigate,
}: AlfredAppLayerProps) {
  return (
    <AlfredChatPanel
      C={C}
      aiName={aiName}
      firstName={firstName}
      partenaire={partenaire}
      suggestionContext={{
        openTasksCount,
        eventsTodayCount,
        fridgeAlertsCount,
        mentalHeavy,
      }}
      assistantHistory={alfred.assistantHistory}
      assistantTyping={alfred.assistantTyping}
      assistantInput={alfred.assistantInput}
      setAssistantInput={alfred.setAssistantInput}
      inputRef={alfred.alfredInputRef}
      chatScrollRef={alfred.chatScrollRef}
      endRef={alfred.endRef}
      realtimeAudioElRef={alfred.realtimeAudioElRef}
      openAiRealtimeOn={alfred.openAiRealtimeOn}
      realtimeVoiceOk={alfred.realtimeVoiceOk}
      openAiRealtimeBusy={alfred.openAiRealtimeBusy}
      alfredMemoryCount={alfredMemoryCount}
      voiceSupported={alfred.voiceSupported}
      isListening={alfred.isListening}
      autoSpeak={alfred.autoSpeak}
      setAutoSpeak={alfred.setAutoSpeak}
      onClearMemory={() => void alfred.clearAlfredMemoryAll()}
      onSend={() => void alfred.sendAssistant()}
      onUploadFile={(file) => void alfred.sendAlfredFile(file)}
      fileUploadBusy={alfred.fileUploadBusy}
      onToggleVoice={alfred.toggleVoiceListening}
      onToggleRealtime={() => void alfred.toggleOpenAiRealtimeVoice()}
      onSuggestion={(text) => void alfred.sendAssistant(text)}
      onConfirmPending={(cmd, intent, proposal) => void alfred.confirmAlfredAction(cmd, intent, proposal)}
      onOpenVault={onOpenVault}
      onOpenDocument={onOpenDocument}
      onAction={(actionId) => {
        if (actionId === 'courses') {
          onNavigate({ overlay: 'courses', coursesTab: 'liste' });
          return;
        }
        if (actionId === 'tasks') {
          onNavigate({ overlay: null, mainTab: 'home' });
          return;
        }
        if (actionId === 'agenda') {
          onNavigate({ overlay: null, mainTab: 'agenda' });
          return;
        }
        if (actionId === 'famille') {
          onNavigate({ overlay: 'famille' });
        }
      }}
    />
  );
}
