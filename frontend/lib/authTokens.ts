/** Session : jeton d’accès en cookie HttpOnly ; marqueur d’onglet en sessionStorage. */

const ACCESS_KEY = 'majordome_access_token';
const LEGACY_REFRESH_KEY = 'majordome_refresh_token';
const SESSION_ACTIVE_KEY = 'majordome_session_active';

/** Valeur sentinel pour les appels API (Bearer omis, cookie HttpOnly utilisé). */
export const COOKIE_AUTH_SESSION = 'cookie';

export function hasSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_ACTIVE_KEY) === '1';
}

export function markSessionActive(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_ACTIVE_KEY, '1');
}

export function isCookieAuthSession(token: string | null | undefined): boolean {
  return token === COOKIE_AUTH_SESSION;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (hasSessionActive()) return COOKIE_AUTH_SESSION;
  const session = sessionStorage.getItem(ACCESS_KEY);
  if (session) return session;
  const legacy = localStorage.getItem(ACCESS_KEY);
  if (legacy) {
    sessionStorage.setItem(ACCESS_KEY, legacy);
    localStorage.removeItem(ACCESS_KEY);
    return legacy;
  }
  return null;
}

export function persistAccessToken(accessToken: string): void {
  if (typeof window === 'undefined') return;
  markSessionActive();
  sessionStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
  void accessToken;
}

export function clearStoredAuthTokens(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

/** Ancien refresh local — utilisé une fois pour migration vers cookie HttpOnly. */
export function consumeLegacyRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const legacy = localStorage.getItem(LEGACY_REFRESH_KEY);
  if (legacy) localStorage.removeItem(LEGACY_REFRESH_KEY);
  return legacy;
}
