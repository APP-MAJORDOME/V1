'use client';

import { useRef, useEffect, useState } from 'react';
import type { SalonMessage } from '../lib/householdCaptures';
import { GUIDED_CAPTURE_PROMPT, GUIDED_CAPTURE_STORAGE_KEY } from '../lib/onboardingV2';
import { ChipCapture, type ChipCaptureType } from './ChipCapture';
import { IconMessageBubble, IconSparkleSmall } from './md-icons';

export type SalonFoyerPanelProps = {
  C: Record<string, string>;
  selfName: string;
  partnerName: string;
  aiName: string;
  messages: SalonMessage[];
  onApproveProposal?: (captureId: string) => void;
  onRejectProposal?: (captureId: string) => void;
  onOpenCaptures?: () => void;
  onSendMessage?: (text: string) => void | Promise<void>;
  onSendPhoto?: (file: File) => void | Promise<void>;
  sending?: boolean;
  loadError?: string | null;
};

function bubbleBg(author: SalonMessage['author'], C: Record<string, string>): string {
  if (author === 'self') return C.terraXL;
  if (author === 'partner') return C.sageL ?? '#EAF4F1';
  return C.lilacL;
}

export function SalonFoyerPanel({
  C,
  selfName,
  partnerName,
  aiName,
  messages,
  onApproveProposal,
  onRejectProposal,
  onOpenCaptures,
  onSendMessage,
  onSendPhoto,
  sending,
  loadError,
}: SalonFoyerPanelProps) {
  const [draft, setDraft] = useState('');
  const [guidedCapture, setGuidedCapture] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setGuidedCapture(localStorage.getItem(GUIDED_CAPTURE_STORAGE_KEY) === '1');
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function dismissGuidedCapture() {
    try {
      localStorage.removeItem(GUIDED_CAPTURE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setGuidedCapture(false);
  }

  function sendGuidedCapture() {
    if (!onSendMessage) return;
    void onSendMessage(GUIDED_CAPTURE_PROMPT);
    dismissGuidedCapture();
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: C.bg,
      }}
    >
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${C.border}`,
          background: C.white,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <IconMessageBubble size={20} color={C.terra} strokeWidth={1.65} />
          <h2 className="md-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>
            Salon du foyer
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: C.text2, lineHeight: 1.45 }}>
          {selfName || 'Toi'} & {partnerName || 'partenaire'} — {aiName} analyse et crée des captures.
        </p>
        {loadError ? (
          <p style={{ margin: '6px 0 0', fontSize: 10, color: C.red }}>{loadError}</p>
        ) : null}
        {onOpenCaptures ? (
          <button
            type="button"
            onClick={onOpenCaptures}
            style={{
              marginTop: 8,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '6px 10px',
              background: C.white,
              fontSize: 11,
              fontWeight: 700,
              color: C.terra,
              cursor: 'pointer',
            }}
          >
            Voir les captures à valider →
          </button>
        ) : null}
        {guidedCapture ? (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: C.terraXL,
              border: `1px solid ${C.terra}44`,
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, color: C.text, lineHeight: 1.45 }}>
              <strong>Première capture</strong> — envoie un message comme : « {GUIDED_CAPTURE_PROMPT} »
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={sendGuidedCapture}
                disabled={sending}
                style={{
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 12px',
                  background: C.terra,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Essayer l&apos;exemple
              </button>
              <button
                type="button"
                onClick={dismissGuidedCapture}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '8px 12px',
                  background: C.white,
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.text2,
                  cursor: 'pointer',
                }}
              >
                J&apos;ai compris
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.map((msg) => {
          const isSelf = msg.author === 'self';
          const isAlfred = msg.author === 'alfred';
          const p = msg.proposal;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isSelf ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                alignSelf: isSelf ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{ fontSize: 10, color: C.text3, marginBottom: 3, paddingLeft: isSelf ? 0 : 4 }}>
                {msg.authorLabel} · {msg.time}
              </div>
              <div
                style={{
                  background: bubbleBg(msg.author, C),
                  borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '10px 12px',
                  fontSize: 13,
                  color: C.text,
                  lineHeight: 1.5,
                  border: isAlfred ? `1px solid ${C.lilac}44` : 'none',
                }}
              >
                {isAlfred ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <IconSparkleSmall size={14} color={C.lilac} />
                    <strong className="md-display" style={{ fontSize: 11, color: C.lilac }}>
                      {aiName}
                    </strong>
                  </span>
                ) : null}
                <div>{msg.text}</div>
              </div>
              {p && p.captureId ? (
                <ChipCapture
                  C={C}
                  type={(p.captureType as ChipCaptureType) || 'suggestion'}
                  title={p.title}
                  when={p.when}
                  assignee={p.assignee}
                  busy={sending}
                  onAdd={onApproveProposal ? () => onApproveProposal(p.captureId!) : undefined}
                  onEdit={onOpenCaptures}
                  onIgnore={onRejectProposal ? () => onRejectProposal(p.captureId!) : undefined}
                />
              ) : null}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div
        style={{
          padding: '10px 16px max(12px, env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${C.border}`,
          background: C.white,
        }}
      >
        <form
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || !onSendMessage || sending) return;
            const text = draft.trim();
            setDraft('');
            void Promise.resolve(onSendMessage(text));
          }}
        >
          {onSendPhoto ? (
            <>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void Promise.resolve(onSendPhoto(f));
                }}
              />
              <button
                type="button"
                aria-label="Envoyer une photo"
                disabled={sending}
                onClick={() => photoRef.current?.click()}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: C.white,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                📷
              </button>
            </>
          ) : null}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écrire au Salon…"
            disabled={!onSendMessage || sending}
            style={{
              flex: 1,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={!onSendMessage || sending || !draft.trim()}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '10px 14px',
              background: C.terra,
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? '…' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  );
}
