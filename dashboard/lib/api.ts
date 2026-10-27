'use client';

/**
 * Thin client for Payload's REST API from the dashboard. Every call sends the
 * session cookie; a 401 means the session has expired and we go back to login.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    window.location.href = '/admin/login?expired=1';
    throw new ApiError('Please log in again.', 401);
  }
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.data?.errors?.map((e: any) => `${e.label || e.path}: ${e.message}`).join('; ') || data?.errors?.[0]?.message || data?.error || data?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

const json = (body: unknown) => ({ 'Content-Type': 'application/json', body: JSON.stringify(body) });

export const api = {
  get: <T = any>(url: string) => fetch(url, { credentials: 'include', cache: 'no-store' }).then((r) => handle<T>(r)),
  post: <T = any>(url: string, body?: unknown) =>
    fetch(url, { method: 'POST', credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => handle<T>(r)),
  patch: <T = any>(url: string, body: unknown) => fetch(url, { method: 'PATCH', credentials: 'include', ...json(body), headers: { 'Content-Type': 'application/json' } }).then((r) => handle<T>(r)),
  delete: <T = any>(url: string) => fetch(url, { method: 'DELETE', credentials: 'include' }).then((r) => handle<T>(r)),
  /** Upload a file to a collection (create) or replace the file on an existing doc (id given). */
  upload: <T = any>(collection: string, file: File, data: Record<string, unknown> = {}, id?: number | string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('_payload', JSON.stringify(data));
    return fetch(id ? `/api/${collection}/${id}` : `/api/${collection}`, { method: id ? 'PATCH' : 'POST', credentials: 'include', body: fd }).then((r) => handle<T>(r));
  },
};

/** Strip Payload bookkeeping before sending a document back. */
export function stripDoc<T extends Record<string, any>>(doc: T): Partial<T> {
  const { id, createdAt, updatedAt, _status, ...rest } = doc;
  return rest as Partial<T>;
}

/** Media relation value -> id, whether it came back populated or not. */
export const relId = (v: any): number | string | null => (v && typeof v === 'object' ? v.id ?? null : v ?? null);

export const mediaSrc = (m: any): string => {
  if (!m || typeof m !== 'object' || !m.url) return '';
  const raw: string = m.sizes?.thumb?.url || m.url;
  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/media/')) return raw;
  try {
    const u = new URL(raw, 'http://local.invalid');
    return u.pathname.replace(/\/+$/, '') + u.search;
  } catch {
    return raw;
  }
};
export const mediaFull = (m: any): string => {
  if (!m || typeof m !== 'object' || !m.url) return '';
  const raw: string = m.url;
  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/media/')) return raw;
  try {
    const u = new URL(raw, 'http://local.invalid');
    return u.pathname.replace(/\/+$/, '') + u.search;
  } catch {
    return raw;
  }
};
