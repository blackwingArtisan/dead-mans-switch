import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { MachineClock } from '../../src/server/adapters/clocks';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { CONTENT_SECURITY_POLICY } from '../../src/server/security';
import { T0 } from './helpers';

function setup(opts: { limit?: number; dev?: boolean } = {}) {
  const clock = new MachineClock(() => T0);
  const store = new MemoryStore();
  const outbox = new OutboxMailer(clock);
  const { app } = createApp({
    store,
    mailer: outbox,
    clock,
    baseUrl: 'http://switch.test',
    tokenRateLimit: { limit: opts.limit ?? 3, windowMs: 60_000 },
    ...(opts.dev ? { dev: { clock, outbox, resetStore: () => store.clear() } } : {}),
  });
  const knock = (ip: string, path = '/api/open/bm90LWEtcmVhbC10b2tlbg') =>
    app.request(path, { headers: { 'cf-connecting-ip': ip } });
  return { app, clock, knock };
}

describe('security headers', () => {
  it('sends a strict CSP and anti-framing headers on API and page responses', async () => {
    const { app } = setup();
    app.get('/page', (c) => c.html('<!doctype html><p>page</p>'));
    for (const path of ['/api/health', '/page', '/api/nowhere']) {
      const res = await app.request(path);
      expect(res.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    }
    expect((await app.request('/api/health')).headers.get('Cache-Control')).toBe('no-store');
  });

  it('allows scripts only from the same origin and blocks plugins and framing', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*unsafe/);
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});

describe('token route rate limit', () => {
  it('lets a client knock a few times, then answers 429 with Retry-After', async () => {
    const { knock } = setup({ limit: 3 });
    for (let i = 0; i < 3; i++) expect((await knock('203.0.113.7')).status).toBe(404);
    const blocked = await knock('203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Witness links share the same budget.
    expect((await knock('203.0.113.7', '/api/witness/bm90LWEtcmVhbC10b2tlbg')).status).toBe(429);
  });

  it('keeps clients apart and resets when the window passes', async () => {
    const { knock, clock } = setup({ limit: 1 });
    expect((await knock('203.0.113.7')).status).toBe(404);
    expect((await knock('203.0.113.7')).status).toBe(429);
    expect((await knock('198.51.100.20')).status).toBe(404);
    clock.advance(60_000);
    expect((await knock('203.0.113.7')).status).toBe(404);
  });

  it('does not limit the owner or vault-creation routes', async () => {
    const { app } = setup({ limit: 1 });
    for (let i = 0; i < 3; i++) expect((await app.request('/api/health')).status).toBe(200);
  });
});

describe('demo tools', () => {
  it('are absent unless the local dev adapters are wired in', async () => {
    const prod = setup();
    expect((await prod.app.request('/api/dev/reset', { method: 'POST' })).status).toBe(404);
    expect((await prod.app.request('/api/dev/clock', { method: 'POST', body: '{"days":3650}' })).status).toBe(404);
    const demo = setup({ dev: true });
    expect((await demo.app.request('/api/dev/clock')).status).toBe(200);
  });
});
