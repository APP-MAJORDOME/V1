/** Utilitaires messages data channel OpenAI Realtime. */

export type RealtimeChannelMessage = {
  type?: string;
  transcript?: string;
  item?: unknown;
  name?: string;
  arguments?: string;
  call_id?: string;
};

export function parseRealtimeChannelMessage(raw: string): RealtimeChannelMessage | null {
  try {
    return JSON.parse(raw) as RealtimeChannelMessage;
  } catch {
    return null;
  }
}

export function extractTranscriptFromRealtimePayload(msg: RealtimeChannelMessage): string | null {
  if (typeof msg.transcript === 'string' && msg.transcript.trim()) return msg.transcript.trim();
  const item = msg.item;
  if (!item || typeof item !== 'object') return null;
  const content = (item as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object') {
      const t = (block as { transcript?: string }).transcript;
      if (typeof t === 'string' && t.trim()) return t.trim();
    }
  }
  return null;
}

export function isFunctionCallDone(type: string): boolean {
  return type === 'response.function_call_arguments.done' || type.endsWith('function_call_arguments.done');
}

export function isAiTranscriptDone(type: string): boolean {
  return type === 'response.output_audio_transcript.done' || type.endsWith('output_audio_transcript.done');
}

export function isUserTranscriptDone(type: string): boolean {
  return type.includes('input_audio_transcription.completed');
}

export function sendRealtimeToolOutput(
  dc: RTCDataChannel,
  callId: string,
  output: { ok: boolean; message: string },
): void {
  dc.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    }),
  );
  dc.send(JSON.stringify({ type: 'response.create' }));
}
