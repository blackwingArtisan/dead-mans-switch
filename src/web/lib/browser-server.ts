/**
 * Static demo mode: the whole API runs inside the visitor's browser.
 *
 * Built with `VITE_STATIC_DEMO=1` (`npm run build:static`), the web app needs no server at all,
 * so it can be hosted as plain files. Requests to `/api/*` go to the same Hono app the Node and
 * Worker entries use, wired to the in-memory store, the demo outbox and the time machine. Their
 * state lives in this browser's localStorage, so every visitor gets a private demo, and links
 * opened from the outbox in another tab (a witness, a recipient) see the same vigil.
 *
 * Each request reloads the state and saves it again, one request at a time (across tabs too,
 * when the Web Locks API is there), so two tabs never overwrite each other's changes.
 */
import { createApp } from '../../server/app';
import { MachineClock } from '../../server/adapters/clocks';
import { OutboxMailer, type OutboxEntry } from '../../server/adapters/mailers';
import { MemoryStore, type StoreSnapshot } from '../../server/adapters/memory-store';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DemoState {
  vaults: StoreSnapshot;
  outbox: OutboxEntry[];
  offsetMs: number;
}

import { STATIC_DEMO_KEY } from './static-demo-key';
export { STATIC_DEMO_KEY };
const TICK_MS = 3_000;
const LOCK_NAME = 'dms.static-demo';

const empty = (): DemoState => ({ vaults: { vaults: [] }, outbox: [], offsetMs: 0 });

export interface BrowserServerOptions {
  /** Where the demo keeps its state; `null` keeps it in memory for this page only. */
  storage: KeyValueStorage | null;
  /** The origin used in email links, normally `location.origin`. */
  baseUrl: string;
  /** Wall-clock time; the time machine adds its offset on top. */
  now?: () => number;
  /** Runs one unit of work at a time; defaults to an in-page queue. */
  exclusive?: <T>(work: () => Promise<T>) => Promise<T>;
}

/** A serial queue for this page. */
function pageQueue(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>) => {
    const result = tail.then(work, work);
    tail = result.catch(() => undefined);
    return result;
  };
}

/** A queue shared by every tab on this origin, through the Web Locks API, with the page queue as fallback. */
function tabLock(): <T>(work: () => Promise<T>) => Promise<T> {
  const local = pageQueue();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return local;
  return <T>(work: () => Promise<T>) => local(() => locks.request(LOCK_NAME, work) as Promise<T>);
}

export function createBrowserServer(options: BrowserServerOptions) {
  const now = options.now ?? (() => Date.now());
  const exclusive = options.exclusive ?? pageQueue();
  let memory = empty();

  const load = (): DemoState => {
    if (!options.storage) return structuredClone(memory);
    try {
      const raw = options.storage.getItem(STATIC_DEMO_KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw) as Partial<DemoState>;
      return {
        vaults: { vaults: parsed.vaults?.vaults ?? [] },
        outbox: parsed.outbox ?? [],
        offsetMs: typeof parsed.offsetMs === 'number' && parsed.offsetMs > 0 ? parsed.offsetMs : 0,
      };
    } catch {
      return empty();
    }
  };

  const save = (state: DemoState): void => {
    memory = structuredClone(state);
    try {
      options.storage?.setItem(STATIC_DEMO_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the demo keeps working in memory for this page */
    }
  };

  /** Builds the app over the saved state, runs `work`, then saves what changed. */
  const withApp = <T>(work: (built: ReturnType<typeof createApp>) => Promise<T>): Promise<T> =>
    exclusive(async () => {
      const state = load();
      const clock = new MachineClock(now);
      if (state.offsetMs > 0) clock.advance(state.offsetMs);
      const store = new MemoryStore(state.vaults, (snapshot) => {
        state.vaults = snapshot;
        save(state);
      });
      const outbox = new OutboxMailer(clock, state.outbox, (entries) => {
        state.outbox = entries;
        save(state);
      });
      const built = createApp({
        store,
        mailer: outbox,
        clock,
        baseUrl: options.baseUrl,
        tokenRateLimit: false,
        dev: { clock, outbox, resetStore: () => store.clear() },
      });
      try {
        return await work(built);
      } finally {
        const offsetMs = Math.max(0, clock.offset());
        if (offsetMs !== state.offsetMs) {
          state.offsetMs = offsetMs;
          save(state);
        }
      }
    });

  return {
    /** Answers one API request, exactly as the server would. */
    handle: (request: Request): Promise<Response> => withApp(({ app }) => Promise.resolve(app.fetch(request))),
    /** Delivers anything now due, like the server's cron tick. */
    tick: () => withApp(({ service }) => service.tickAll()),
  };
}

function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Routes this page's same-origin `/api/*` requests to the in-browser server and starts the tick. */
export function installBrowserServer(): void {
  const server = createBrowserServer({ storage: browserStorage(), baseUrl: window.location.origin, exclusive: tabLock() });
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) return server.handle(request);
    return realFetch(input, init);
  };
  window.setInterval(() => {
    server.tick().catch((err) => console.error('Tick failed:', err instanceof Error ? err.message : err));
  }, TICK_MS);
}
