/**
 * Cloudflare Worker entry (production path). Written and type-checked; not deployed from CI.
 *
 *   fetch      /api/*  -> the shared Hono app; everything else -> static assets (SPA)
 *   scheduled  Cron Trigger every 15 minutes -> tick every vault
 */
import { createApp } from '../server/app';
import { SystemClock } from '../server/adapters/clocks';
import { KvStore } from '../server/adapters/kv-store';
import { ResendMailer } from '../server/adapters/mailers';

export interface Env {
  DMS_KV: KVNamespace;
  ASSETS: Fetcher;
  RESEND_API_KEY: string;
  DMS_MAIL_FROM: string;
  DMS_BASE_URL: string;
}

function build(env: Env) {
  return createApp({
    store: new KvStore(env.DMS_KV),
    mailer: new ResendMailer(env.RESEND_API_KEY, env.DMS_MAIL_FROM),
    clock: new SystemClock(),
    baseUrl: env.DMS_BASE_URL,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return build(env).app.fetch(request, env);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      build(env)
        .service.tickAll()
        .then((r) => console.log(`Tick: ${r.vaults} vaults, ${r.emails} emails`)),
    );
  },
} satisfies ExportedHandler<Env>;
