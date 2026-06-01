/** Session : access en sessionStorage (onglet) ; refresh en cookie HttpOnly côté serveur. */

const ACCESS_KEY = 'majordome_access_token';
const LEGACY_REFRESH_KEY = 'majordome_refresh_token';

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
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
  sessionStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

export function clearStoredAuthTokens(): void {
  if (typeof window === 'undefined') return;
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
