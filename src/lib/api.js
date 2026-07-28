const KEY_STORAGE = 'avail-dashboard-key';

export const getStoredKey = () => localStorage.getItem(KEY_STORAGE);
export const setStoredKey = (key) => localStorage.setItem(KEY_STORAGE, key);
export const clearStoredKey = () => localStorage.removeItem(KEY_STORAGE);

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

export async function fetchJson(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
  ).toString();

  const res = await fetch(`${path}${qs ? `?${qs}` : ''}`, {
    headers: { 'x-dashboard-key': getStoredKey() || '' },
  });

  if (res.status === 401) {
    clearStoredKey();
    window.dispatchEvent(new Event('dashboard:unauthorized'));
    throw new ApiError(401, { error: 'unauthorized' });
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export async function checkPassword(password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'x-dashboard-key': password },
  });
  return res.status === 204;
}
