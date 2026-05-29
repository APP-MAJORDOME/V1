'use client';

import { useEffect, useMemo, useRef } from 'react';
import { IconMic, IconSpeaker } from './md-icons';
import { getAlfredSuggestions, type AlfredAction } from '../lib/alfredSuggestions';

export type AlfredPendingConfirm = {
  command: string;
  intent: string;
  label: string;
  proposal?: Record<string, unknown>;
};

export type AlfredMessage = {
  id?: string;
  who: 'ai' | 'user';
  text: string;
  actions?: AlfredAction[];
  pendingConfirm?: AlfredPendingConfirm;
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
  inputRef,
  chatScrollRef,
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
  onClearMemory,
  onSend,
  onToggleVoice,
  onToggleRealtime,
  onSuggestion,
  onAction,
  onConfirmPending,
}: {
  C: Record<string, string>;
  aiName: string;
  firstName: string;
  partenaire: string;
  assistantHistory: AlfredMessage[];
  assistantTyping: boolean;
  assistantInput: string;
  setAssistantInput: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  chatScrollRef?: React.RefObject<HTMLDivElement>;
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
  onClearMemory: () => void;
  onSend: () => void;
  onToggleVoice: () => void;
  onToggleRealtime: () => void;
  onSuggestion: (text: string) => void;
  onAction: (actionId: string) => void;
  onConfirmPending: (command: string, intent: string, proposal?: Record<string, unknown>) => void;
}) {
  const suggestions = useMemo(() => getAlfredSuggestions(firstName, partenaire), [firstName, partenaire]);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const mergedInputRef = inputRef ?? localInputRef;

  useEffect(() => {
    const t = window.setTimeout(() => mergedInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [mergedInputRef]);

  const realtimeStatus =
    openAiRealtimeBusy ? 'Connexion…' : openAiRealtimeOn ? '● En ligne — parle' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <audio ref={realtimeAudioElRef} autoPlay playsInline hidden aria-hidden />
      {realtimeVoiceOk === false ? (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 11,
            background: C.sunL,
            color: C.text,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          Voix GPT indisponible sur le serveur (clé OpenAI / modèle Realtime). Le texte et le micro navigateur restent actifs.
        </div>
      ) : null}
      {realtimeStatus ? (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            background: openAiRealtimeOn ? C.greenL : C.terraXL,
            color: openAiRealtimeOn ? C.green : C.terra,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {realtimeStatus}
        </div>
      ) : null}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: C.white,
        }}
      >
        <div>
          <strong style={{ fontSize: 16, color: C.text }}>{aiName}</strong>
          <div style={{ fontSize: 11, color: C.text2 }}>
            {alfredMemoryCount} note{alfredMemoryCount !== 1 ? 's' : ''} mémorisée{alfredMemoryCount !== 1 ? 's' : ''}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 10,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 4,
            flexWrap: 'nowrap',
          }}
        >
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
                whiteSpace: 'nowrap',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={chatScrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation avec Alfred"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          WebkitOverflowScrolling: 'touch',
          background: C.bg,
        }}
      >
        {assistantHistory.map((m, i) => (
          <div
            key={m.id ?? `${m.who}-${i}`}
            style={{ display: 'flex', justifyContent: m.who === 'ai' ? 'flex-start' : 'flex-end', marginBottom: 10 }}
          >
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
              {m.who === 'ai' && m.pendingConfirm ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() =>
                      onConfirmPending(
                        m.pendingConfirm!.command,
                        m.pendingConfirm!.intent,
                        m.pendingConfirm!.proposal,
                      )
                    }
                    style={{
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: C.terra,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {m.pendingConfirm.label}
                  </button>
                </div>
              ) : null}
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
            ref={mergedInputRef}
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
            aria-label="Micro navigateur"
            title="Dictée navigateur"
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
            disabled={openAiRealtimeBusy || realtimeVoiceOk === false}
            title="Voix Alfred (GPT Realtime)"
            aria-label="Voix Alfred GPT Realtime"
            className={openAiRealtimeOn ? 'majordome-realtime-live' : undefined}
            style={{
              width: 44,
              height: 44,
              border: 'none',
              borderRadius: 12,
              background: openAiRealtimeOn ? C.redL : C.surface2,
              opacity: realtimeVoiceOk === false ? 0.45 : 1,
              cursor: realtimeVoiceOk === false ? 'not-allowed' : 'pointer',
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
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: C.text3, flexWrap: 'wrap' }}>
          {!openAiRealtimeOn ? (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                className="majordome-toggle"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                aria-label="Lire les réponses à voix haute dans le navigateur"
              />
              <span>Lire les réponses (navigateur)</span>
            </label>
          ) : (
            <span>Voix GPT Realtime — les actions s’exécutent dans l’app</span>
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
