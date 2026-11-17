/** Thin client for the API, plus the few things this browser remembers. */
import type { VaultView } from '../../core/vault';
import type { SealedLetter, Settings } from '../../core/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const OWNER_KEY = 'dms.owner';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const local = {
  get(key: string): string | null {
    try {
      return storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      storage()?.setItem(key, value);
    } catch {
      /* private mode: the page still works, it just forgets */
    }
  },
  remove(key: string): void {
    try {
      storage()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const session = {
  token: () => local.get(OWNER_KEY),
  save: (token: string) => local.set(OWNER_KEY, token),
  clear: () => local.remove(OWNER_KEY),
};

/** The author keeps each keepsake half on their own device so they can hand it over later. */
export const authored = {
  save: (letterId: string, half: string) => local.set(`dms.authored.${letterId}`, half),
  get: (letterId: string) => local.get(`dms.authored.${letterId}`),
  forget: (letterId: string) => local.remove(`dms.authored.${letterId}`),
};

/** A recipient's browser remembers keepsakes it has been shown. */
export const keepsakes = {
  save: (letterId: string, half: string) => local.set(`dms.keepsake.${letterId}`, half),
  get: (letterId: string) => local.get(`dms.keepsake.${letterId}`),
};

async function request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = session.token();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'The crypt is unreachable. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export interface WitnessInfo {
  authorName: string;
  witnessName: string;
  state: VaultView['state'];
  lastCheckInAt: number;
  response: 'pending' | 'confirmed' | 'denied';
  confirmations: number;
  confirmationsRequired: number;
}

export interface OpenInfo {
  letterId: string;
  authorName: string;
  recipientName: string;
  custody: 'keepsake' | 'vault';
  sealedAt: number;
  releasedAt: number | null;
  openedAt: number | null;
  opened: boolean;
  keepsakeTag: string | null;
}

export interface ClockInfo {
  now: number;
  offsetMs: number;
  nextEventAt: number | null;
}

export interface OutboxMessage {
  id: number;
  kind: string;
  to: { name: string; email: string };
  subject: string;
  text: string;
  sentAt: number;
}

export const api = {
  health: () => request<{ ok: boolean; now: number; dev: boolean }>('GET', '/api/health'),
  createVault: (author: { name: string; email: string }, settings: Partial<Settings>) =>
    request<{ ownerToken: string; vault: VaultView }>('POST', '/api/vaults', { author, settings }),
  vault: () => request<VaultView>('GET', '/api/vault', undefined, true),
  checkIn: () => request<VaultView>('POST', '/api/vault/check-in', {}, true),
  pause: () => request<VaultView>('POST', '/api/vault/pause', {}, true),
  resume: () => request<VaultView>('POST', '/api/vault/resume', {}, true),
  settings: (s: Partial<Settings>) => request<VaultView>('PATCH', '/api/vault/settings', s, true),
  addWitness: (p: { name: string; email: string }) => request<VaultView>('POST', '/api/vault/witnesses', p, true),
  removeWitness: (id: string) => request<VaultView>('DELETE', `/api/vault/witnesses/${encodeURIComponent(id)}`, undefined, true),
  addLetter: (body: {
    id: string;
    recipient: { name: string; email: string };
    custody: 'keepsake' | 'vault';
    sealed: SealedLetter;
    keepsakeHalf?: string;
  }) => request<VaultView>('POST', '/api/vault/letters', body, true),
  burnLetter: (id: string) => request<VaultView>('DELETE', `/api/vault/letters/${encodeURIComponent(id)}`, undefined, true),
  witness: (token: string) => request<WitnessInfo>('GET', `/api/witness/${encodeURIComponent(token)}`),
  witnessRespond: (token: string, response: 'confirm' | 'deny') =>
    request<{ state: string; response: string }>('POST', `/api/witness/${encodeURIComponent(token)}`, { response }),
  openInfo: (token: string) => request<OpenInfo>('GET', `/api/open/${encodeURIComponent(token)}`),
  breakSeal: (token: string) =>
    request<{ letterId: string; ciphertext: string; iv: string; vaultHalf: string }>(
      'POST',
      `/api/open/${encodeURIComponent(token)}/break`,
      {},
    ),
  dev: {
    clock: () => request<ClockInfo>('GET', '/api/dev/clock'),
    travel: (body: { days?: number; hours?: number; to?: 'next'; reset?: boolean }) =>
      request<ClockInfo & { tick: { vaults: number; emails: number } }>('POST', '/api/dev/clock', body),
    outbox: () => request<{ messages: OutboxMessage[] }>('GET', '/api/dev/outbox'),
    reset: () => request<{ ok: boolean }>('POST', '/api/dev/reset', {}),
  },
};

/** Lets any component ask the vigil and the outbox to refresh (after time travel, for example). */
export const REFRESH_EVENT = 'dms:refresh';
export function requestRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
