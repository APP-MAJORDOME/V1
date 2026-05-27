'use client';

import { useMemo } from 'react';
import { IconMic, IconSpeaker } from './md-icons';
import { getAlfredSuggestions, type AlfredAction } from '../lib/alfredSuggestions';

export type AlfredMessage = {
  who: 'ai' | 'user';
  text: string;
  actions?: AlfredAction[];
};

export function AlfredChatPanel({
  C,
  aiName,
  firstName,
  partenaire,
  assistantHistory,
  assistantTyping,
  assistantInput,
  setAssistantInput,
  endRef,
  realtimeAudioElRef,
  openAiRealtimeOn,
  realtimeVoiceOk,
  openAiRealtimeBusy,
  alfredMemoryCount,
  voiceSupported,
  isListening,
  autoSpeak,
  setAutoSpeak,
  onBack,
  onClearMemory,
  onSend,
  onToggleVoice,
  onToggleRealtime,
  onSuggestion,
  onAction,
}: {
  C: Record<string, string>;
  aiName: string;
  firstName: string;
  partenaire: string;
  assistantHistory: AlfredMessage[];
  assistantTyping: boolean;
  assistantInput: string;
  setAssistantInput: (v: string) => void;
  endRef: React.RefObject<HTMLDivElement>;
  realtimeAudioElRef: React.RefObject<HTMLAudioElement>;
  openAiRealtimeOn: boolean;
  realtimeVoiceOk: boolean | null;
  openAiRealtimeBusy: boolean;
  alfredMemoryCount: number;
  voiceSupported: boolean;
  isListening: boolean;
  autoSpeak: boolean;
  setAutoSpeak: (v: boolean) => void;
  onBack: () => void;
  onClearMemory: () => void;
  onSend: () => void;
  onToggleVoice: () => void;
  onToggleRealtime: () => void;
  onSuggestion: (text: string) => void;
  onAction: (actionId: string) => void;
}) {
  const suggestions = useMemo(() => getAlfredSuggestions(firstName, partenaire), [firstName, partenaire]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <audio ref={realtimeAudioElRef} autoPlay playsInline hidden aria-hidden />
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: C.white,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '8px 12px',
              background: C.white,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Retour
          </button>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 16, color: C.text }}>{aiName}</strong>
            <div style={{ fontSize: 11, color: C.text2 }}>
              {alfredMemoryCount} note{alfredMemoryCount !== 1 ? 's' : ''} mémorisée{alfredMemoryCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              style={{
                flexShrink: 0,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                padding: '8px 12px',
                background: C.terraXL,
                color: C.terra,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                maxWidth: 200,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          WebkitOverflowScrolling: 'touch',
          background: C.bg,
        }}
      >
        {assistantHistory.map((m, i) => (
          <div key={`${m.who}-${i}`} style={{ display: 'flex', justifyContent: m.who === 'ai' ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
            <div style={{ maxWidth: '88%' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: m.who === 'ai' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                  background: m.who === 'ai' ? C.white : C.terra,
                  color: m.who === 'ai' ? C.text : '#fff',
                  border: m.who === 'ai' ? `1px solid ${C.border}` : 'none',
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.text}
              </div>
              {m.who === 'ai' && m.actions && m.actions.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {m.actions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onAction(a.id)}
                      style={{
                        border: `1px solid ${C.terra}`,
                        borderRadius: 10,
                        padding: '6px 10px',
                        background: C.white,
                        color: C.terra,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {assistantTyping ? (
          <div style={{ fontSize: 13, color: C.text2, padding: '4px 8px' }}>{aiName} réfléchit…</div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div style={{ padding: '10px 12px max(12px, env(safe-area-inset-bottom))', background: C.white, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={assistantInput}
            onChange={(e) => setAssistantInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
            placeholder={`Demande à ${aiName}…`}
            aria-label={`Message pour ${aiName}`}
            style={{
              flex: 1,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: '12px 14px',
              fontSize: 16,
            }}
          />
          <button
            type="button"
            onClick={onToggleVoice}
            disabled={!voiceSupported || openAiRealtimeOn}
            aria-label="Micro"
            style={{
              width: 44,
              height: 44,
              border: 'none',
              borderRadius: 12,
              background: isListening ? C.redL : C.terraXL,
              opacity: !voiceSupported || openAiRealtimeOn ? 0.45 : 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconMic size={20} color={isListening ? C.red : C.terra} />
          </button>
          <button
            type="button"
            onClick={onToggleRealtime}
            disabled={openAiRealtimeBusy}
            title="Voix Alfred (GPT Realtime)"
            aria-label="Voix Alfred GPT Realtime"
            style={{
              width: 44,
              height: 44,
              border: 'none',
              borderRadius: 12,
              background: openAiRealtimeOn ? C.redL : C.surface2,
              opacity: !openAiRealtimeOn && realtimeVoiceOk !== true ? 0.45 : 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSpeaker size={20} color={openAiRealtimeOn ? C.red : C.text2} />
          </button>
          <button
            type="button"
            onClick={onSend}
            style={{
              border: 'none',
              borderRadius: 12,
              background: C.terra,
              color: '#fff',
              padding: '0 16px',
              height: 44,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Envoyer
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: C.text3 }}>
          {!openAiRealtimeOn ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
              Lire les réponses (navigateur)
            </label>
          ) : (
            <span>Voix GPT Realtime active — parle naturellement</span>
          )}
          {alfredMemoryCount > 0 ? (
            <button type="button" onClick={onClearMemory} style={{ border: 'none', background: 'none', color: C.text3, cursor: 'pointer', fontSize: 10 }}>
              Effacer mémoire
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
