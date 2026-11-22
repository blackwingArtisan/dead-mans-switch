/** HTTP API. The same app runs on Node (local) and on a Cloudflare Worker. */
import { Hono, type Context } from 'hono';
import { SwitchError } from '../core/machine';
import { DAY, HOUR } from '../core/time';
import { ValidationError } from '../core/vault';
import type { OutboxMailer } from './adapters/mailers';
import { MemoryRateLimiter } from './adapters/memory-rate-limiter';
import type { AdjustableClock, RateLimiter } from './ports';
import {
  DEFAULT_TOKEN_RATE_LIMIT,
  cloudflareClientKey,
  rateLimit,
  securityHeaders,
  type ClientKey,
  type RateLimitOptions,
} from './security';
import { HttpError, SwitchService, type ServiceDeps } from './service';

export interface DevTools {
  clock: AdjustableClock;
  outbox: OutboxMailer;
  /** Wipes all vaults (demo reset). */
  resetStore: () => void;
}

export interface AppDeps extends ServiceDeps {
  /** Present only locally: the time machine and the outbox. Never in production. */
  dev?: DevTools;
  /** Limits on the witness and letter-link routes. `false` turns them off. */
  tokenRateLimit?: RateLimitOptions | false;
  /** Counts token-route requests. Defaults to an in-memory fixed window built from `tokenRateLimit`. */
  rateLimiter?: RateLimiter;
  /** How to identify a client for rate limiting. Defaults to Cloudflare's connecting IP. */
  clientKey?: ClientKey;
}

type Vars = { Variables: { vaultId: string } };

export function createApp(deps: AppDeps) {
  const service = new SwitchService(deps);
  const app = new Hono<Vars>();

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
    if (err instanceof SwitchError) return c.json({ error: err.message, code: err.code }, 409);
    console.error('Unhandled error', err instanceof Error ? err.message : err);
    return c.json({ error: 'Something went wrong in the crypt. Please try again.' }, 500);
  });

  app.use('*', securityHeaders());
  app.use('/api/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  const limits = deps.tokenRateLimit ?? DEFAULT_TOKEN_RATE_LIMIT;
  if (limits) {
    const limiter = rateLimit(deps.clock, deps.rateLimiter ?? new MemoryRateLimiter(limits), deps.clientKey ?? cloudflareClientKey);
    app.use('/api/witness/*', limiter);
    app.use('/api/open/*', limiter);
    app.use('/api/check-in/*', limiter);
  }

  const json = async (c: Context): Promise<Record<string, unknown>> => {
    try {
      const body = await c.req.json();
      return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    } catch {
      throw new ValidationError('The request body must be JSON.');
    }
  };

  app.get('/api/health', (c) => c.json({ ok: true, now: service.now(), dev: Boolean(deps.dev) }));

  app.post('/api/vaults', async (c) => {
    const body = await json(c);
    return c.json(await service.createVault({ author: body.author, settings: body.settings }), 201);
  });

  // Everything under /api/vault needs the owner's bearer token.
  const owner = async (c: Context<Vars>, next: () => Promise<void>) => {
    const auth = c.req.header('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
    c.set('vaultId', await service.vaultIdForOwner(token));
    await next();
  };
  app.use('/api/vault', owner);
  app.use('/api/vault/*', owner);

  app.get('/api/vault', async (c) => c.json(await service.view(c.get('vaultId'))));
  app.post('/api/vault/check-in', async (c) => c.json(await service.event(c.get('vaultId'), { type: 'checkIn' })));
  app.post('/api/vault/pause', async (c) => c.json(await service.event(c.get('vaultId'), { type: 'pause' })));
  app.post('/api/vault/resume', async (c) => c.json(await service.event(c.get('vaultId'), { type: 'resume' })));
  app.patch('/api/vault/settings', async (c) => c.json(await service.updateSettings(c.get('vaultId'), await json(c))));
  app.post('/api/vault/witnesses', async (c) => c.json(await service.addWitness(c.get('vaultId'), await json(c)), 201));
  app.delete('/api/vault/witnesses/:id', async (c) =>
    c.json(await service.removeWitness(c.get('vaultId'), c.req.param('id'))),
  );
  app.post('/api/vault/letters', async (c) => c.json(await service.addLetter(c.get('vaultId'), await json(c)), 201));
  app.delete('/api/vault/letters/:id', async (c) => c.json(await service.burnLetter(c.get('vaultId'), c.req.param('id'))));
  app.get('/api/vault/export', async (c) => c.json(await service.exportSealed(c.get('vaultId'))));

  app.get('/api/witness/:token', async (c) => c.json(await service.witnessInfo(c.req.param('token'))));
  app.post('/api/witness/:token', async (c) => {
    const body = await json(c);
    return c.json(await service.witnessRespond(c.req.param('token'), body.response, body.note));
  });

  // One-tap check-in links from emails. GET only describes; checking in needs the POST, so mail
  // scanners that follow links cannot check anyone in.
  app.get('/api/check-in/:token', async (c) => c.json(await service.checkInLinkInfo(c.req.param('token'))));
  app.post('/api/check-in/:token', async (c) => c.json(await service.checkInByLink(c.req.param('token'))));

  app.get('/api/open/:token', async (c) => c.json(await service.openInfo(c.req.param('token'))));
  app.post('/api/open/:token/break', async (c) => c.json(await service.breakSeal(c.req.param('token'))));
  app.post('/api/open/:token/candle', async (c) => {
    const body = await json(c);
    return c.json(await service.lightCandle(c.req.param('token'), body.line), 201);
  });

  // ── local-only demo tools ───────────────────────────────
  const dev = deps.dev;
  if (dev) {
    const clockView = async () => ({
      now: dev.clock.now(),
      offsetMs: dev.clock.offset(),
      nextEventAt: await service.nextEventAt(),
    });
    app.get('/api/dev/clock', async (c) => c.json(await clockView()));
    app.post('/api/dev/clock', async (c) => {
      const body = await json(c);
      if (body.reset === true) dev.clock.reset();
      else if (body.to === 'next') {
        const next = await service.nextEventAt();
        if (next === null) throw new ValidationError('Nothing is scheduled. The candle is out or paused.');
        if (next > dev.clock.now()) dev.clock.set(next);
      } else {
        const days = typeof body.days === 'number' ? body.days : 0;
        const hours = typeof body.hours === 'number' ? body.hours : 0;
        if (days < 0 || hours < 0 || days > 3650) throw new ValidationError('The time machine only travels forward.');
        dev.clock.advance(days * DAY + hours * HOUR);
      }
      const tick = await service.tickAll();
      return c.json({ ...(await clockView()), tick });
    });
    app.post('/api/dev/tick', async (c) => c.json(await service.tickAll()));
    app.get('/api/dev/outbox', (c) => c.json({ messages: dev.outbox.list().reverse() }));
    app.delete('/api/dev/outbox', (c) => {
      dev.outbox.clear();
      return c.json({ ok: true });
    });
    app.post('/api/dev/reset', (c) => {
      dev.resetStore();
      dev.outbox.clear();
      dev.clock.reset();
      return c.json({ ok: true });
    });
  }

  app.all('/api/*', (c) => c.json({ error: 'No such path in the crypt.' }, 404));

  return { app, service };
}
