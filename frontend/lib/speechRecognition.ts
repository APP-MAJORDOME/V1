/** API Web Speech (Chromium / Safari) — types DOM incomplets selon les configs TS. */

export type WebSpeechRecognitionResultList = {
  length: number;
  [index: number]: { 0?: { transcript?: string }; isFinal: boolean };
};

export type WebSpeechRecognitionResultEvent = {
  resultIndex: number;
  results: WebSpeechRecognitionResultList;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: WebSpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function createFrenchSpeechRecognition(handlers: {
  onFinalChunk: (text: string) => void;
  onEnd: () => void;
  onError: () => void;
}): SpeechRecognitionLike | null {
  const SR = getSpeechRecognitionCtor();
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (event: WebSpeechRecognitionResultEvent) => {
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) finalText += `${chunk} `;
    }
    if (finalText.trim()) handlers.onFinalChunk(finalText.trim());
  };
  rec.onerror = handlers.onError;
  rec.onend = handlers.onEnd;
  return rec;
}
