import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app';
import { MachineClock } from '../../src/server/adapters/clocks';
import { CloudflareRateLimiter, type RateLimitBinding } from '../../src/server/adapters/cloudflare-rate-limiter';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryRateLimiter } from '../../src/server/adapters/memory-rate-limiter';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { T0 } from './helpers';

describe('MemoryRateLimiter', () => {
  it('allows up to the limit, then blocks with a retry time', async () => {
    const limiter = new MemoryRateLimiter({ limit: 2, windowMs: 60_000 });
    expect((await limiter.hit('a', T0)).allowed).toBe(true);
    expect((await limiter.hit('a', T0)).allowed).toBe(true);
    const blocked = await limiter.hit('a', T0 + 10_000);
    expect(blocked).toEqual({ allowed: false, retryAfterSec: 50 });
    expect((await limiter.hit('b', T0)).allowed).toBe(true);
  });

  it('resets after the window passes', async () => {
    const limiter = new MemoryRateLimiter({ limit: 1, windowMs: 60_000 });
    await limiter.hit('a', T0);
    expect((await limiter.hit('a', T0 + 59_999)).allowed).toBe(false);
    expect((await limiter.hit('a', T0 + 60_000)).allowed).toBe(true);
  });
});

describe('CloudflareRateLimiter', () => {
  it('passes the key to the binding and maps success to allowed', async () => {
    const limit = vi.fn(async (_o: { key: string }) => ({ success: true }));
    const result = await new CloudflareRateLimiter({ limit }).hit('203.0.113.7', T0);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(result.allowed).toBe(true);
  });

  it('maps success false to a blocked decision with the period as retry time', async () => {
    const binding: RateLimitBinding = { limit: async () => ({ success: false }) };
    expect(await new CloudflareRateLimiter(binding, 10).hit('k', T0)).toEqual({ allowed: false, retryAfterSec: 10 });
  });

  it('answers 429 with the usual message and Retry-After through the middleware', async () => {
    const clock = new MachineClock(() => T0);
    const binding: RateLimitBinding = { limit: async () => ({ success: false }) };
    const { app } = createApp({
      store: new MemoryStore(),
      mailer: new OutboxMailer(clock),
      clock,
      baseUrl: 'http://switch.test',
      rateLimiter: new CloudflareRateLimiter(binding, 60),
    });
    const res = await app.request('/api/open/bm90LWEtcmVhbC10b2tlbg');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect((await res.json()) as { error: string }).toEqual({
      error: 'Too many knocks at the crypt door. Please wait a moment and try again.',
    });
  });

  it('allows the request when the binding itself fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const binding: RateLimitBinding = {
      limit: async () => {
        throw new Error('binding down');
      },
    };
    expect((await new CloudflareRateLimiter(binding).hit('k', T0)).allowed).toBe(true);
    err.mockRestore();
  });
});
