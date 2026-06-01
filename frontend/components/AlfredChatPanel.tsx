'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ALFRED_FILE_ACCEPT } from '../lib/alfredAgent';
import { IconMic, IconPaperclip, IconSpeaker } from './md-icons';
import { getAlfredSuggestions, type AlfredAction, type AlfredSuggestionContext } from '../lib/alfredSuggestions';

export type AlfredPendingConfirm = {
  command: string;
  intent: string;
  label: string;
  proposal?: Record<string, unknown>;
};

export type AlfredWebSource = {
  title: string;
  snippet?: string;
  url: string;
};

export type AlfredVaultDocument = {
  id: number;
  name: string;
  category?: string;
  has_file?: boolean;
};

export type AlfredMessageAttachment = {
  name: string;
  mime: string;
  previewUrl?: string;
};

export type AlfredMessage = {
  id?: string;
  who: 'ai' | 'user';
  text: string;
  actions?: AlfredAction[];
  pendingConfirm?: AlfredPendingConfirm;
  webSources?: AlfredWebSource[];
  /** Réponse basée sur le coffre / budget — proposer d’ouvrir le module Coffre. */
  openVault?: boolean;
  /** Documents du coffre à ouvrir directement depuis le chat. */
  vaultDocuments?: AlfredVaultDocument[];
  attachment?: AlfredMessageAttachment;
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
  onUploadFile,
  onOpenVault,
  onOpenDocument,
  fileUploadBusy,
  suggestionContext,
}: {
  C: Record<string, string>;
  aiName: string;
  firstName: string;
  partenaire: string;
  suggestionContext?: AlfredSuggestionContext;
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
  onUploadFile: (file: File) => void;
  onOpenVault?: () => void;
  onOpenDocument?: (documentId: number) => void;
  fileUploadBusy?: boolean;
}) {
  const suggestions = useMemo(
    () => getAlfredSuggestions(firstName, partenaire, suggestionContext),
    [firstName, partenaire, suggestionContext],
  );
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
          La conversation vocale avec Alfred n&apos;est pas encore activée sur ton espace. Tu peux toujours écrire ou utiliser le micro du navigateur.
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
                {m.attachment?.previewUrl ? (
                  <img
                    src={m.attachment.previewUrl}
                    alt={m.attachment.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 160,
                      borderRadius: 8,
                      marginBottom: m.text ? 8 : 0,
                      display: 'block',
                    }}
                  />
                ) : null}
                {m.attachment && !m.attachment.previewUrl ? (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: m.text ? 6 : 0,
                      opacity: 0.9,
                    }}
                  >
                    📎 {m.attachment.name}
                  </div>
                ) : null}
                {m.text ? m.text : null}
              </div>
              {m.who === 'ai' && m.vaultDocuments && m.vaultDocuments.length > 0 && onOpenDocument ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.vaultDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => onOpenDocument(doc.id)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.terra,
                        background: C.terraXL,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Ouvrir « {doc.name} »{doc.has_file === false ? ' (sans fichier)' : ''} →
                    </button>
                  ))}
                </div>
              ) : null}
              {m.who === 'ai' && m.openVault && onOpenVault ? (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={onOpenVault}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.terra,
                      background: C.terraXL,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: '8px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    Ouvrir le coffre documents →
                  </button>
                </div>
              ) : null}
              {m.who === 'ai' && m.webSources && m.webSources.length > 0 ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>Sources web</div>
                  {m.webSources.map((src) => (
                    <a
                      key={src.url}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: C.terra,
                        textDecoration: 'none',
                        lineHeight: 1.4,
                      }}
                    >
                      {src.title}
                    </a>
                  ))}
                </div>
              ) : null}
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
        <input
          ref={fileInputRef}
          type="file"
          accept={ALFRED_FILE_ACCEPT}
          style={{ display: 'none' }}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onUploadFile(file);
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileUploadBusy || openAiRealtimeOn}
              aria-label="Joindre un fichier ou une photo"
              title="Photo, PDF, Word…"
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                background: C.white,
                opacity: fileUploadBusy || openAiRealtimeOn ? 0.45 : 1,
                cursor: fileUploadBusy || openAiRealtimeOn ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconPaperclip size={20} color={C.terra} strokeWidth={1.75} />
            </button>
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
                minWidth: 0,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: '12px 14px',
                fontSize: 16,
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={fileUploadBusy}
              aria-label="Envoyer le message"
              style={{
                flexShrink: 0,
                border: 'none',
                borderRadius: 12,
                background: C.terra,
                color: '#fff',
                padding: '0 14px',
                height: 44,
                fontWeight: 700,
                cursor: fileUploadBusy ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: fileUploadBusy ? 0.5 : 1,
              }}
            >
              Envoyer
            </button>
          </div>
          <div style={{ fontSize: 10, color: C.text3, lineHeight: 1.4 }}>
            Photos, PDF, Word (.docx) ou texte — jusqu’à 12 Mo. Ajoute une consigne dans le champ avant d’envoyer.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onToggleVoice}
              disabled={!voiceSupported || openAiRealtimeOn}
              aria-label="Micro navigateur"
              title="Dictée navigateur"
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
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
              title="Conversation vocale avec Alfred"
              aria-label="Conversation vocale avec Alfred"
              className={openAiRealtimeOn ? 'majordome-realtime-live' : undefined}
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
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
          </div>
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
            <span>Conversation vocale — Alfred peut agir dans l&apos;app pendant que tu parles</span>
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
