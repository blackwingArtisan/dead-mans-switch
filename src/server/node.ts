/**
 * Local Node entry. Serves the API and the built web app on one port.
 *
 * Env (all optional; defaults are free and local):
 *   PORT            3140
 *   DMS_BASE_URL    http://localhost:$PORT   (used in email links)
 *   DMS_CLOCK       system | machine         (machine = demo time machine; also --time-machine)
 *   DMS_STORE       file | memory            (file = ./data/vaults.json)
 *   DMS_DATA_DIR    ./data
 *   DMS_MAILER      outbox | resend          (outbox = ./data/outbox.json)
 *   RESEND_API_KEY, DMS_MAIL_FROM            (only for DMS_MAILER=resend)
 *   DMS_TRUST_PROXY 0 | 1                    (1 = rate-limit by X-Forwarded-For)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app';
import { MachineClock, SystemClock } from './adapters/clocks';
import { OutboxMailer, ResendMailer, type OutboxEntry } from './adapters/mailers';
import { MemoryStore, type StoreSnapshot } from './adapters/memory-store';
import type { Mailer } from './ports';

const env = process.env;
const port = Number(env.PORT ?? 3140);
const baseUrl = env.DMS_BASE_URL ?? `http://localhost:${port}`;
const dataDir = resolve(env.DMS_DATA_DIR ?? 'data');
const useFiles = (env.DMS_STORE ?? 'file') === 'file';
if (useFiles) mkdirSync(dataDir, { recursive: true });

function isLocalOrigin(url: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function readJson<T>(file: string, fallback: T): T {
  const path = join(dataDir, file);
  if (!useFiles || !existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}
function writeJson(file: string, value: unknown): void {
  if (useFiles) writeFileSync(join(dataDir, file), JSON.stringify(value, null, 2));
}

// The time machine and outbox routes act on every vault, so they are opt-in and local-only.
const wantMachine = process.argv.includes('--time-machine') || env.DMS_CLOCK === 'machine';
if (wantMachine && !isLocalOrigin(baseUrl)) {
  console.error(`Refusing to start the time machine for ${baseUrl}. It is a local demo tool; use DMS_CLOCK=system.`);
  process.exit(1);
}
const machine = wantMachine ? new MachineClock() : null;
const savedClock = readJson<{ offsetMs: number }>('clock.json', { offsetMs: 0 });
if (machine && savedClock.offsetMs > 0) machine.advance(savedClock.offsetMs);
const clock = machine ?? new SystemClock();

const store = new MemoryStore(readJson<StoreSnapshot>('vaults.json', { vaults: [] }), (snap) => writeJson('vaults.json', snap));
const outbox = new OutboxMailer(clock, readJson<OutboxEntry[]>('outbox.json', []), (entries) => writeJson('outbox.json', entries));

let mailer: Mailer = outbox;
if (env.DMS_MAILER === 'resend') {
  mailer = new ResendMailer(env.RESEND_API_KEY ?? '', env.DMS_MAIL_FROM ?? "Dead Man's Switch <switch@example.com>");
}

const dev = machine && mailer === outbox
  ? {
      clock: {
        now: () => machine.now(),
        offset: () => machine.offset(),
        advance: (ms: number) => {
          machine.advance(ms);
          writeJson('clock.json', { offsetMs: machine.offset() });
        },
        set: (at: number) => {
          machine.set(at);
          writeJson('clock.json', { offsetMs: machine.offset() });
        },
        reset: () => {
          machine.reset();
          writeJson('clock.json', { offsetMs: 0 });
        },
      },
      outbox,
      resetStore: () => store.clear(),
    }
  : undefined;

const { app, service } = createApp({
  store,
  mailer,
  clock,
  baseUrl,
  dev,
  // Behind a proxy every client shares its address; set DMS_TRUST_PROXY=1 to key on X-Forwarded-For.
  clientKey: (c) =>
    (env.DMS_TRUST_PROXY === '1' ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined) ??
    getConnInfo(c).remote.address ??
    'anonymous',
});

const webRoot = resolve(env.DMS_WEB_ROOT ?? 'dist/web');
if (existsSync(webRoot)) {
  const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: webRoot }));
  app.get('*', (c) => c.html(indexHtml));
}

// Local stand-in for the Worker's Cron Trigger.
const tickEvery = machine ? 3_000 : 60_000;
const timer = setInterval(() => {
  service.tickAll().catch((err) => console.error('Tick failed:', err instanceof Error ? err.message : err));
}, tickEvery);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Dead Man's Switch is listening on ${baseUrl}`);
  console.log(`  clock: ${machine ? 'time machine' : 'system'}, store: ${useFiles ? dataDir : 'memory'}, mail: ${mailer === outbox ? 'local outbox' : 'Resend'}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    server.close();
    process.exit(0);
  });
}
