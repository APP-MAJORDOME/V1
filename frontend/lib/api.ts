const browserDefaultBase =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : window.location.origin
    : 'http://localhost:8000';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || browserDefaultBase;

type RequestOptions = {
  token?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

function logoutIfUnauthorized(code: string | undefined) {
  if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('majordome_access_token');
      localStorage.removeItem('majordome_refresh_token');
    }
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

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, method = 'GET', body } = options;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    cache: 'no-store',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const { code, message } = detailFromResponseBody(text);
    logoutIfUnauthorized(code);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      throw new Error('Session expiree. Merci de te reconnecter.');
    }
    throw new Error(message || text || `API error ${res.status}`);
  }
  return res.json();
}

export async function getJson<T>(path: string, token?: string): Promise<T> {
  return requestJson<T>(path, { token });
}

export async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'POST', body, token });
}

export async function patchJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'PATCH', body, token });
}

export async function deleteJson<T>(path: string, token?: string): Promise<T> {
  return requestJson<T>(path, { method: 'DELETE', token });
}

export async function postFormData<T>(path: string, formData: FormData, token?: string): Promise<T> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    const { code, message } = detailFromResponseBody(text);
    logoutIfUnauthorized(code);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      throw new Error('Session expiree. Merci de te reconnecter.');
    }
    throw new Error(message || text || `API error ${res.status}`);
  }
  return res.json();
}

export async function downloadAuthed(path: string, token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    const { code, message } = detailFromResponseBody(text);
    logoutIfUnauthorized(code);
    if (code === 'invalid_bearer_token' || code === 'missing_bearer_token') {
      throw new Error('Session expiree. Merci de te reconnecter.');
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
