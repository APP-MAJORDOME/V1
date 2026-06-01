'use client';

import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import type { AlfredMessage } from '../components/AlfredChatPanel';
import {
  agentNeedsConfirm,
  clearAlfredMemoryServer,
  confirmLabelForIntent,
  extractVaultDocuments,
  extractWebSources,
  extractShoppingPlan,
  isAlfredConsultationIntent,
  runServerAgentAct,
  tryExtractAlfredMemory,
  type AgentExecutionResult,
  type AgentInterpretResponse,
} from '../lib/alfredAgent';
import { postJson, getJson, postFormData } from '../lib/api';
import { ALFRED_FILE_MAX_MB } from '../lib/alfredAgent';
import { inferAlfredActions } from '../lib/alfredSuggestions';
import { realtimeToolToInterpret } from '../lib/alfredRealtimeTools';
import { normalizeWebRtcSdp, waitForIceGatheringComplete } from '../lib/realtimeSdp';
import {
  extractTranscriptFromRealtimePayload,
  isAiTranscriptDone,
  isFunctionCallDone,
  isUserTranscriptDone,
  parseRealtimeChannelMessage,
  sendRealtimeToolOutput,
} from '../lib/alfredRealtime';
import { createFrenchSpeechRecognition, type SpeechRecognitionLike } from '../lib/speechRecognition';

const ASSISTANT_HISTORY_KEY = 'majordome_assistant_history';

function alfredReplyMeta(
  res: AgentInterpretResponse,
): Pick<AlfredMessage, 'webSources' | 'openVault' | 'vaultDocuments' | 'shoppingPlan'> {
  const webSources = extractWebSources(res.proposal);
  const vaultDocuments = extractVaultDocuments(res.proposal);
  const shoppingPlan = extractShoppingPlan(res.proposal) ?? undefined;
  const openVault =
    res.intent === 'household_answer' && vaultDocuments.length === 0 ? true : undefined;
  return {
    webSources: webSources.length > 0 ? webSources : undefined,
    openVault,
    vaultDocuments: vaultDocuments.length > 0 ? vaultDocuments : undefined,
    shoppingPlan,
  };
}

export type AlfredToastType = 'success' | 'error' | 'info';

export type UseAlfredAssistantOptions = {
  token: string;
  /** Overlay Alfred ou onglet alfred actif. */
  overlayActive: boolean;
  aiName: string;
  alfredMemory: string[];
  setAlfredMemory: React.Dispatch<React.SetStateAction<string[]>>;
  onExecuteIntent: (
    command: string,
    interpreted: AgentInterpretResponse,
  ) => Promise<AgentExecutionResult>;
  onToast: (type: AlfredToastType, message: string) => void;
};

export function useAlfredAssistant({
  token,
  overlayActive,
  aiName,
  alfredMemory,
  setAlfredMemory,
  onExecuteIntent,
  onToast,
}: UseAlfredAssistantOptions) {
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [fileUploadBusy, setFileUploadBusy] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState<AlfredMessage[]>([
    { who: 'ai', text: `Coucou, je suis ${aiName}. Dis-moi ce que je dois gérer pour toi.` },
  ]);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [openAiRealtimeOn, setOpenAiRealtimeOn] = useState(false);
  const [openAiRealtimeBusy, setOpenAiRealtimeBusy] = useState(false);
  const [realtimeVoiceOk, setRealtimeVoiceOk] = useState<boolean | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const alfredInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const alfredNearBottomRef = useRef(true);
  const realtimeAudioElRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const realtimePcRef = useRef<RTCPeerConnection | null>(null);
  const realtimeDcRef = useRef<RTCDataChannel | null>(null);
  const realtimeMsRef = useRef<MediaStream | null>(null);
  const realtimeVoicePendingRef = useRef('');
  const realtimeVoiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeToolBusyRef = useRef(false);
  const realtimeToolHandledRef = useRef(false);
  const realtimeCallsSeenRef = useRef<Set<string>>(new Set());
  const openAiRealtimeOnRef = useRef(false);

  useEffect(() => {
    openAiRealtimeOnRef.current = openAiRealtimeOn;
  }, [openAiRealtimeOn]);

  const cleanupRealtimeMedia = useCallback(() => {
    try {
      realtimeDcRef.current?.close();
    } catch {
      /* ignore */
    }
    realtimeDcRef.current = null;
    try {
      realtimePcRef.current?.getSenders().forEach((s) => {
        try {
          s.track?.stop();
        } catch {
          /* ignore */
        }
      });
      realtimePcRef.current?.close();
    } catch {
      /* ignore */
    }
    realtimePcRef.current = null;
    try {
      realtimeMsRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    realtimeMsRef.current = null;
    const el = realtimeAudioElRef.current;
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  }, []);

  const disconnectRealtime = useCallback(() => {
    cleanupRealtimeMedia();
    realtimeCallsSeenRef.current.clear();
    setOpenAiRealtimeOn(false);
  }, [cleanupRealtimeMedia]);

  useEffect(() => {
    if (!token) disconnectRealtime();
  }, [token, disconnectRealtime]);

  useEffect(() => () => disconnectRealtime(), [disconnectRealtime]);

  useEffect(() => {
    try {
      localStorage.setItem(ASSISTANT_HISTORY_KEY, JSON.stringify(assistantHistory.slice(-200)));
    } catch {
      /* ignore */
    }
  }, [assistantHistory]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      alfredNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [overlayActive]);

  useEffect(() => {
    if (!alfredNearBottomRef.current) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantHistory, assistantTyping]);

  useEffect(() => {
    const rec = createFrenchSpeechRecognition({
      onFinalChunk: (text) => setAssistantInput((prev) => `${prev} ${text}`.trim()),
      onEnd: () => setIsListening(false),
      onError: () => setIsListening(false),
    });
    setVoiceSupported(Boolean(rec));
    speechRecognitionRef.current = rec;
    return () => {
      try {
        rec?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    if (!overlayActive) disconnectRealtime();
  }, [overlayActive, disconnectRealtime]);

  useEffect(() => {
    if (!overlayActive || !token) {
      setRealtimeVoiceOk(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const s = await getJson<{ configured: boolean }>('/api/v1/agent/realtime/status', token);
        if (!cancelled) setRealtimeVoiceOk(s.configured);
      } catch {
        if (!cancelled) setRealtimeVoiceOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overlayActive, token]);

  const handleRealtimeToolCall = useCallback(
    async (dc: RTCDataChannel, callId: string, name: string, argsJson: string) => {
      if (!token || realtimeToolBusyRef.current) return;
      if (realtimeCallsSeenRef.current.has(callId)) return;
      realtimeCallsSeenRef.current.add(callId);
      realtimeToolBusyRef.current = true;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        args = {};
      }
      let output: { ok: boolean; message: string } = { ok: false, message: 'Action non reconnue.' };
      if (name === 'search_web') {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (query) {
          try {
            const res = await postJson<AgentInterpretResponse>(
              '/api/v1/agent/interpret',
              { command: `recherche web: ${query}` },
              token,
            );
            const msg = res.explanation?.trim() || 'Recherche terminée.';
            output = { ok: true, message: msg };
            onToast('success', 'Réponse web');
            realtimeToolHandledRef.current = true;
            window.setTimeout(() => {
              realtimeToolHandledRef.current = false;
            }, 2500);
          } catch {
            output = { ok: false, message: 'Recherche web indisponible pour le moment.' };
          }
        }
      } else if (name === 'consult_household') {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (query) {
          try {
            const res = await postJson<AgentInterpretResponse>(
              '/api/v1/agent/interpret',
              { command: query },
              token,
            );
            const msg = res.explanation?.trim() || 'Consultation terminée.';
            output = { ok: true, message: msg };
            onToast('success', 'Réponse foyer');
            realtimeToolHandledRef.current = true;
            window.setTimeout(() => {
              realtimeToolHandledRef.current = false;
            }, 2500);
          } catch {
            output = { ok: false, message: 'Consultation du foyer indisponible pour le moment.' };
          }
        }
      } else {
        const interpreted = realtimeToolToInterpret(name, args);
        if (interpreted) {
          const raw =
            typeof args.title === 'string'
              ? args.title
              : typeof args.label === 'string'
                ? args.label
                : typeof args.task_title === 'string'
                  ? args.task_title
                  : typeof args.note === 'string'
                    ? args.note
                    : name;
          try {
            const execution = await onExecuteIntent(String(raw), interpreted);
            if (execution.done && execution.message) {
              output = { ok: true, message: execution.message };
              onToast('success', execution.message);
              realtimeToolHandledRef.current = true;
              window.setTimeout(() => {
                realtimeToolHandledRef.current = false;
              }, 2500);
            } else {
              output = { ok: false, message: "Je n'ai pas pu terminer cette action." };
            }
          } catch {
            output = { ok: false, message: 'Erreur lors de l’exécution.' };
          }
        }
      }
      try {
        sendRealtimeToolOutput(dc, callId, output);
      } catch {
        /* canal fermé */
      } finally {
        realtimeToolBusyRef.current = false;
      }
    },
    [token, onExecuteIntent, onToast],
  );

  const processVoiceCommand = useCallback(
    async (transcript: string) => {
      if (!token || !transcript.trim()) return;
      const text = transcript.trim();
      setAssistantTyping(true);
      try {
        const res = await postJson<AgentInterpretResponse>(
          '/api/v1/agent/interpret',
          { command: text },
          token,
        );
        let aiText = res.explanation || '';
        if (agentNeedsConfirm(res)) {
          if (!aiText.trim()) aiText = 'Je peux faire ça pour toi si tu confirmes.';
          startTransition(() => {
            setAssistantHistory((h) => [
              ...h,
              { who: 'user', text, id: `u-${Date.now()}` },
              {
                who: 'ai',
                text: aiText,
                id: `ai-${Date.now()}`,
                ...alfredReplyMeta(res),
                pendingConfirm: {
                  command: text,
                  intent: res.intent,
                  label: confirmLabelForIntent(res.intent),
                  proposal: res.proposal,
                },
              },
            ]);
          });
          return;
        }
        let execution = await onExecuteIntent(text, res).catch(
          () => ({ done: false }) as AgentExecutionResult,
        );
        if (
          !execution.done &&
          !isAlfredConsultationIntent(res.intent) &&
          res.mode === 'auto'
        ) {
          const server = await runServerAgentAct(token, text).catch(() => null);
          if (server?.completed) {
            execution = { done: true, message: server.message };
          }
        }
        if (execution.done && execution.message) {
          aiText = execution.message;
        } else if (!aiText.trim()) {
          aiText = isAlfredConsultationIntent(res.intent)
            ? 'Je n’ai pas pu formuler de réponse.'
            : `${res.intent} (${res.mode})`;
        }
        startTransition(() => {
          setAssistantHistory((h) => [
            ...h,
            { who: 'user', text, id: `u-${Date.now()}` },
            {
              who: 'ai',
              text: aiText,
              id: `ai-${Date.now()}`,
              ...alfredReplyMeta(res),
            },
          ]);
        });
        if (execution.done && execution.message) onToast('success', execution.message);
      } catch {
        onToast('error', 'Impossible d’exécuter la commande vocale.');
      } finally {
        setAssistantTyping(false);
      }
    },
    [token, onExecuteIntent, onToast],
  );

  const scheduleVoiceCommandFromTranscript = useCallback(
    (transcript: string) => {
      if (openAiRealtimeOnRef.current) return;
      realtimeVoicePendingRef.current = transcript.trim();
      if (realtimeVoiceTimerRef.current) clearTimeout(realtimeVoiceTimerRef.current);
      realtimeVoiceTimerRef.current = setTimeout(() => {
        const t = realtimeVoicePendingRef.current;
        realtimeVoicePendingRef.current = '';
        if (t && !realtimeToolHandledRef.current) void processVoiceCommand(t);
      }, 450);
    },
    [processVoiceCommand],
  );

  const sendAlfredFile = useCallback(
    async (file: File) => {
      if (!token || fileUploadBusy) return;
      const maxBytes = ALFRED_FILE_MAX_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        onToast('error', `Fichier trop volumineux (max ${ALFRED_FILE_MAX_MB} Mo).`);
        return;
      }
      const command = assistantInput.trim();
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      const userLabel = command || `📎 ${file.name}`;
      alfredNearBottomRef.current = true;
      setAssistantHistory((m) => [
        ...m,
        {
          who: 'user',
          text: userLabel,
          id: `u-${Date.now()}`,
          attachment: { name: file.name, mime: file.type || 'application/octet-stream', previewUrl },
        },
      ]);
      setAssistantInput('');
      setAssistantTyping(true);
      setFileUploadBusy(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (command) fd.append('command', command);
        const res = await postFormData<AgentInterpretResponse>(
          '/api/v1/agent/analyze-file',
          fd,
          token,
        );
        let aiText = res.explanation?.trim() || 'Analyse terminée.';
        setAssistantHistory((m) => [
          ...m,
          {
            who: 'ai',
            text: aiText,
            id: `ai-${Date.now()}`,
            ...alfredReplyMeta(res),
          },
        ]);
        if (
          autoSpeak &&
          !openAiRealtimeOn &&
          typeof window !== 'undefined' &&
          'speechSynthesis' in window
        ) {
          const utterance = new SpeechSynthesisUtterance(aiText);
          utterance.lang = 'fr-FR';
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } catch (e) {
        setAssistantHistory((m) => [
          ...m,
          {
            who: 'ai',
            text:
              e instanceof Error
                ? e.message
                : "Impossible d'analyser ce fichier. Réessaie avec un PDF, une photo ou un DOCX.",
            id: `ai-${Date.now()}`,
          },
        ]);
        onToast('error', e instanceof Error ? e.message : 'Analyse du fichier impossible');
      } finally {
        setAssistantTyping(false);
        setFileUploadBusy(false);
      }
    },
    [token, assistantInput, fileUploadBusy, autoSpeak, openAiRealtimeOn, onToast],
  );

  const sendAssistant = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? assistantInput).trim();
      if (!token || !text) return;
      const memNote = tryExtractAlfredMemory(text);
      alfredNearBottomRef.current = true;
      setAssistantHistory((m) => [...m, { who: 'user', text, id: `u-${Date.now()}` }]);
      setAssistantInput('');
      setAssistantTyping(true);
      try {
        const res = await postJson<AgentInterpretResponse>(
          '/api/v1/agent/interpret',
          { command: text },
          token,
        );
        let aiText = res.explanation || '';
        if (
          res.proposal &&
          typeof res.proposal === 'object' &&
          'title' in res.proposal &&
          !isAlfredConsultationIntent(res.intent)
        ) {
          const t = (res.proposal as { title?: string }).title;
          if (t && !agentNeedsConfirm(res)) aiText = `${aiText}\n\nTâche proposée : ${t}`.trim();
        }
        if (agentNeedsConfirm(res)) {
          if (!aiText.trim()) aiText = 'Je peux faire ça pour toi si tu confirmes.';
          setAssistantHistory((m) => [
            ...m,
            {
              who: 'ai',
              text: aiText,
              id: `ai-${Date.now()}`,
              ...alfredReplyMeta(res),
              pendingConfirm: {
                command: text,
                intent: res.intent,
                label: confirmLabelForIntent(res.intent),
                proposal: res.proposal,
              },
            },
          ]);
          if (memNote) {
            setAlfredMemory((prev) => (prev.includes(memNote) ? prev : [...prev, memNote]));
            void postJson('/api/v1/memory/facts', { fact_text: memNote }, token).catch(() => undefined);
            onToast('info', 'Alfred a mémorisé une note');
          }
          return;
        }
        let execution = await onExecuteIntent(text, res).catch(
          () => ({ done: false }) as AgentExecutionResult,
        );
        if (
          !execution.done &&
          !isAlfredConsultationIntent(res.intent) &&
          res.mode === 'auto'
        ) {
          const server = await runServerAgentAct(token, text).catch(() => null);
          if (server?.completed) {
            execution = { done: true, message: server.message };
          }
        }
        if (execution.done && execution.message) {
          aiText = `${aiText}\n\n${execution.message}`.trim();
        }
        if (!aiText.trim()) {
          aiText = isAlfredConsultationIntent(res.intent)
            ? 'Je n’ai pas pu formuler de réponse.'
            : `${res.intent} (${res.mode})`;
        }
        const actions = inferAlfredActions(aiText, execution.done);
        setAssistantHistory((m) => [
          ...m,
          {
            who: 'ai',
            text: aiText,
            actions: actions.length > 0 ? actions : undefined,
            ...alfredReplyMeta(res),
            id: `ai-${Date.now()}`,
          },
        ]);
        if (memNote) {
          setAlfredMemory((prev) => (prev.includes(memNote) ? prev : [...prev, memNote]));
          void postJson('/api/v1/memory/facts', { fact_text: memNote }, token).catch(() => undefined);
          onToast('info', 'Alfred a mémorisé une note');
        }
        if (
          autoSpeak &&
          !openAiRealtimeOn &&
          typeof window !== 'undefined' &&
          'speechSynthesis' in window
        ) {
          const utterance = new SpeechSynthesisUtterance(aiText);
          utterance.lang = 'fr-FR';
          utterance.rate = 1;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        setAssistantHistory((m) => [
          ...m,
          {
            who: 'ai',
            text: "Je n'ai pas pu répondre maintenant, réessaie dans quelques secondes.",
            id: `ai-${Date.now()}`,
          },
        ]);
      } finally {
        setAssistantTyping(false);
      }
    },
    [
      assistantInput,
      token,
      autoSpeak,
      openAiRealtimeOn,
      setAlfredMemory,
      onExecuteIntent,
      onToast,
    ],
  );

  const confirmAlfredAction = useCallback(
    async (command: string, intent: string, proposal?: Record<string, unknown>) => {
      if (!token) return;
      setAssistantTyping(true);
      try {
        const res: AgentInterpretResponse = {
          intent,
          mode: 'auto',
          explanation: '',
          proposal: proposal ?? {},
        };
        let execution = await onExecuteIntent(command, res);
        if (!execution.done && res.mode === 'auto' && !isAlfredConsultationIntent(res.intent)) {
          const server = await runServerAgentAct(token, command).catch(() => null);
          if (server?.completed) {
            execution = { done: true, message: server.message };
          }
        }
        if (execution.done && execution.message) {
          setAssistantHistory((h) => [
            ...h.map((m) => ({ ...m, pendingConfirm: undefined })),
            { who: 'ai', text: execution.message!, id: `ai-${Date.now()}` },
          ]);
          onToast('success', execution.message);
        }
      } finally {
        setAssistantTyping(false);
      }
    },
    [token, onExecuteIntent, onToast],
  );

  const clearAlfredMemoryAll = useCallback(async () => {
    if (!token) return;
    if (!window.confirm('Effacer toutes les notes mémorisées par Alfred (app + serveur) ?')) return;
    try {
      await clearAlfredMemoryServer(token);
    } catch {
      /* ignore */
    }
    setAlfredMemory([]);
    localStorage.removeItem('majordome_alfred_memory');
    onToast('info', 'Mémoire Alfred effacée');
  }, [token, setAlfredMemory, onToast]);

  const toggleVoiceListening = useCallback(() => {
    if (!speechRecognitionRef.current) return;
    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    speechRecognitionRef.current.start();
    setIsListening(true);
  }, [isListening]);

  const toggleOpenAiRealtimeVoice = useCallback(async () => {
    if (!token) {
      onToast('error', 'Connecte-toi pour utiliser la voix avec Alfred.');
      return;
    }
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      onToast('error', 'La conversation vocale n’est pas disponible sur ce navigateur.');
      return;
    }
    if (openAiRealtimeOn || realtimePcRef.current) {
      disconnectRealtime();
      onToast('info', 'Appel vocal terminé');
      return;
    }
    const audioSink = realtimeAudioElRef.current;
    if (!audioSink) {
      onToast('error', 'Lecteur audio indisponible. Réessaie après avoir rouvert Alfred.');
      return;
    }
    audioSink.muted = false;
    audioSink.volume = 1;
    audioSink.autoplay = true;
    setOpenAiRealtimeBusy(true);
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      realtimePcRef.current = pc;

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream && realtimeAudioElRef.current) {
          realtimeAudioElRef.current.srcObject = stream;
          void realtimeAudioElRef.current.play().catch(() => {
            onToast('info', 'Touchez le bouton vagues pour activer le son.');
          });
        }
      };

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      realtimeMsRef.current = ms;
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      const dc = pc.createDataChannel('oai-events');
      realtimeDcRef.current = dc;

      dc.onmessage = (ev) => {
        const msg = parseRealtimeChannelMessage(ev.data as string);
        if (!msg) return;
        const typ = String(msg.type || '');

        if (isFunctionCallDone(typ)) {
          const callId = String(msg.call_id || '');
          const fnName = String(msg.name || '');
          const fnArgs = String(msg.arguments || '{}');
          if (callId && fnName) void handleRealtimeToolCall(dc, callId, fnName, fnArgs);
          return;
        }

        const text = extractTranscriptFromRealtimePayload(msg);
        if (!text) return;
        if (isAiTranscriptDone(typ)) {
          startTransition(() => {
            setAssistantHistory((h) => [...h, { who: 'ai', text, id: `ai-${Date.now()}` }]);
          });
        } else if (isUserTranscriptDone(typ)) {
          startTransition(() => {
            setAssistantHistory((h) => [...h, { who: 'user', text, id: `u-${Date.now()}` }]);
          });
          scheduleVoiceCommandFromTranscript(text);
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc, 10000);
      const sdpRaw = pc.localDescription?.sdp;
      if (!sdpRaw) throw new Error('SDP local vide');

      const answer = await postJson<{ sdp: string }>(
        '/api/v1/agent/realtime/webrtc',
        {
          sdp: normalizeWebRtcSdp(sdpRaw),
          assistant_display_name: aiName,
          extra_memory_notes: alfredMemory.slice(-14),
        },
        token,
      );

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: normalizeWebRtcSdp(answer.sdp),
      });
      setOpenAiRealtimeOn(true);
      onToast('success', 'Conversation vocale avec Alfred activée');
    } catch (e) {
      disconnectRealtime();
      onToast('error', e instanceof Error ? e.message : 'Impossible de démarrer la conversation vocale');
    } finally {
      setOpenAiRealtimeBusy(false);
    }
  }, [
    token,
    openAiRealtimeOn,
    aiName,
    alfredMemory,
    disconnectRealtime,
    handleRealtimeToolCall,
    scheduleVoiceCommandFromTranscript,
    onToast,
  ]);

  const hydrateHistoryFromStorage = useCallback((name: string) => {
    try {
      const rawHistory = localStorage.getItem(ASSISTANT_HISTORY_KEY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter(
              (x: unknown): x is AlfredMessage =>
                !!x &&
                typeof x === 'object' &&
                (((x as { who?: string }).who === 'ai') || (x as { who?: string }).who === 'user') &&
                typeof (x as { text?: string }).text === 'string',
            )
            .slice(-200);
          if (cleaned.length > 0) {
            setAssistantHistory(cleaned);
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }
    setAssistantHistory([
      { who: 'ai', text: `Coucou, je suis ${name}. Dis-moi ce que je dois gérer pour toi.` },
    ]);
  }, []);

  const api = {
    assistantInput,
    setAssistantInput,
    assistantTyping,
    assistantHistory,
    setAssistantHistory,
    voiceSupported,
    isListening,
    autoSpeak,
    setAutoSpeak,
    openAiRealtimeOn,
    openAiRealtimeBusy,
    realtimeVoiceOk,
    endRef,
    alfredInputRef,
    chatScrollRef,
    realtimeAudioElRef,
    sendAssistant,
    sendAlfredFile,
    fileUploadBusy,
    confirmAlfredAction,
    clearAlfredMemoryAll,
    toggleVoiceListening,
    toggleOpenAiRealtimeVoice,
    disconnectRealtime,
    hydrateHistoryFromStorage,
  };
  return api;
}

export type AlfredAssistantController = ReturnType<typeof useAlfredAssistant>;
