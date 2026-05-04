/**
 * Normalise une SDP (offer ou answer) pour WebRTC : CRLF + coupe avant v=0.
 * Ne fait pas de `.trim()` par ligne : les lignes SDP peuvent commencer par une espace
 * (continuation RFC 4566) ; Chrome rejette parfois a=ice-pwd si on les casse.
 */
export function normalizeWebRtcSdp(raw: string): string {
  const text = raw.trim().replace(/^\uFEFF/, '');
  const start = text.indexOf('v=0');
  const core = start >= 0 ? text.slice(start) : text;
  const lines = core.split(/\r?\n/).map((l) => l.replace(/\r$/, ''));
  const nonempty = lines.filter((l) => l.length > 0);
  if (!nonempty.length || !nonempty[0].startsWith('v=0')) {
    throw new Error('SDP invalide (pas de session v=0).');
  }
  return `${nonempty.join('\r\n')}\r\n`;
}

/** Alias historique (réponse OpenAI). */
export function normalizeWebRtcAnswerSdp(raw: string): string {
  return normalizeWebRtcSdp(raw);
}

/** Attend fin de collecte ICE pour un SDP complet (important sur mobile / NAT). */
export function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 8000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(), timeoutMs);
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(t);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}
