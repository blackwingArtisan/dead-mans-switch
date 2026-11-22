/** Thin client for the API, plus the few things this browser remembers. */
import type { SealedExport } from '../../core/export';
import type { CandleBack, CandleLine } from '../../core/types';
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

let failedRequests = 0;
/** How many requests have failed so far (no answer, or a 5xx). The story compares it before and after to notice a demo that went quiet. */
export const failedRequestCount = (): number => failedRequests;

async function request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = session.token();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    failedRequests += 1;
    throw new ApiError(0, 'The crypt is unreachable. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status >= 500) failedRequests += 1;
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

export interface CheckInLinkInfo {
  authorName: string;
  state: VaultView['state'];
  lastCheckInAt: number;
}

export interface CheckInLinkResult extends CheckInLinkInfo {
  nextDueAt: number;
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
  candle: CandleLine | null;
  candles: CandleBack[];
  /** The author's candle as they last tended it: when, and how much wax was left (0..1). */
  lastCandle: { keptUntil: number; wax: number };
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
  exportSealed: () => request<SealedExport>('GET', '/api/vault/export', undefined, true),
  burnLetter: (id: string) => request<VaultView>('DELETE', `/api/vault/letters/${encodeURIComponent(id)}`, undefined, true),
  witness: (token: string) => request<WitnessInfo>('GET', `/api/witness/${encodeURIComponent(token)}`),
  witnessRespond: (token: string, response: 'confirm' | 'deny', note?: string) =>
    request<{ state: string; response: string }>('POST', `/api/witness/${encodeURIComponent(token)}`, {
      response,
      ...(note ? { note } : {}),
    }),
  checkInLink: (token: string) => request<CheckInLinkInfo>('GET', `/api/check-in/${encodeURIComponent(token)}`),
  checkInByLink: (token: string) => request<CheckInLinkResult>('POST', `/api/check-in/${encodeURIComponent(token)}`, {}),
  openInfo: (token: string) => request<OpenInfo>('GET', `/api/open/${encodeURIComponent(token)}`),
  breakSeal: (token: string) =>
    request<{ letterId: string; ciphertext: string; iv: string; vaultHalf: string }>(
      'POST',
      `/api/open/${encodeURIComponent(token)}/break`,
      {},
    ),
  lightCandle: (token: string, line: string) =>
    request<{ candle: CandleLine; candles: CandleBack[] }>('POST', `/api/open/${encodeURIComponent(token)}/candle`, { line }),
  dev: {
    clock: () => request<ClockInfo>('GET', '/api/dev/clock'),
    travel: (body: { days?: number; hours?: number; to?: 'next'; reset?: boolean }) =>
      request<ClockInfo & { tick: { vaults: number; emails: number } }>('POST', '/api/dev/clock', body),
    outbox: () => request<{ messages: OutboxMessage[] }>('GET', '/api/dev/outbox'),
    clearOutbox: () => request<{ ok: boolean }>('DELETE', '/api/dev/outbox'),
    reset: () => request<{ ok: boolean }>('POST', '/api/dev/reset', {}),
  },
};

/** Lets any component ask the vigil and the outbox to refresh (after time travel, for example). */
export const REFRESH_EVENT = 'dms:refresh';
export function requestRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
