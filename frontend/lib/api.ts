import {
  COOKIE_AUTH_SESSION,
  clearStoredAuthTokens,
  consumeLegacyRefreshToken,
  isCookieAuthSession,
  persistAccessToken,
} from './authTokens';

const browserDefaultBase =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : window.location.origin
    : 'http://localhost:8000';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || browserDefaultBase;

export const AUTH_TOKEN_EVENT = 'majordome:auth-token';
export const AUTH_LOGOUT_EVENT = 'majordome:auth-logout';

type RequestOptions = {
  token?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Internal: évite boucle infinie sur refresh. */
  _retried?: boolean;
};

function notifyAuthToken(accessToken: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_TOKEN_EVENT, { detail: { accessToken } }));
}

function notifyAuthLogout() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
}

function logoutIfUnauthorized(code: string | undefined) {
  if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
    clearStoredAuthTokens();
    notifyAuthLogout();
  }
}

function detailFromResponseBody(text: string): { code?: string; message: string } {
  try {
    const parsed = JSON.parse(text);
    const detail = parsed?.detail;
    const code = detail?.code;
    const message = detail?.message || detail?.code || parsed?.message || text;
    return { code, message };
  } catch {
    return { message: text };
  }
}

export async function tryRefreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const legacyRefresh = consumeLegacyRefreshToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(legacyRefresh ? { refresh_token: legacyRefresh } : {}),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return null;
    persistAccessToken(data.access_token);
    notifyAuthToken(COOKIE_AUTH_SESSION);
    return COOKIE_AUTH_SESSION;
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, method = 'GET', body, _retried = false } = options;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token && !isCookieAuthSession(token)) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const { code, message } = detailFromResponseBody(text);
    if (
      !_retried &&
      (code === 'invalid_bearer_token' || code === 'missing_bearer_token')
    ) {
      const newToken = await tryRefreshAccessToken();
      if (newToken) {
        return requestJson<T>(path, { ...options, token: newToken, _retried: true });
      }
    }
    logoutIfUnauthorized(code);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      throw new Error('Session expirée. Merci de te reconnecter.');
    }
    const err = new Error(message || text || `API error ${res.status}`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = code;
    throw err;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function getJson<T>(path: string, token?: string): Promise<T> {
  return requestJson<T>(path, { token });
}

export async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'POST', body, token });
}

export async function putJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'PUT', body, token });
}

export async function patchJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'PATCH', body, token });
}

export async function deleteJson<T>(path: string, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'DELETE', token });
}

async function authedFetch(path: string, init: RequestInit, token: string, retried = false): Promise<Response> {
  const hdrs: HeadersInit = { ...init.headers };
  if (!isCookieAuthSession(token)) {
    (hdrs as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
    headers: hdrs,
  });
  if (!res.ok && !retried) {
    const text = await res.text();
    const { code } = detailFromResponseBody(text);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      const newToken = await tryRefreshAccessToken();
      if (newToken) return authedFetch(path, init, newToken, true);
    }
    logoutIfUnauthorized(code);
  }
  return res;
}

export async function postFormData<T>(path: string, formData: FormData, token?: string): Promise<T> {
  if (!token) throw new Error('Session requise');
  const res = await authedFetch(path, { method: 'POST', body: formData }, token);
  if (!res.ok) {
    const text = await res.text();
    const { code, message } = detailFromResponseBody(text);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      throw new Error('Session expirée. Merci de te reconnecter.');
    }
    throw new Error(message || text || `API error ${res.status}`);
  }
  return res.json();
}

export async function downloadAuthed(path: string, token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await authedFetch(path, {}, token);
  if (!res.ok) {
    const text = await res.text();
    const { code, message } = detailFromResponseBody(text);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      throw new Error('Session expirée. Merci de te reconnecter.');
    }
    throw new Error(message || text || `API error ${res.status}`);
  }
  const cd = res.headers.get('Content-Disposition') || '';
  let filename = 'piece-jointe';
  const mStar = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
  const mPlain = /filename="([^"]+)"/i.exec(cd);
  if (mStar) {
    try {
      filename = decodeURIComponent(mStar[1].trim().replace(/^"(.*)"$/, '$1'));
    } catch {
      filename = mStar[1].trim();
    }
  } else if (mPlain) {
    filename = mPlain[1];
  }
  const blob = await res.blob();
  return { blob, filename };
}

export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
