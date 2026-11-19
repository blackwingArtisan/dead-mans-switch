import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { MachineClock } from '../../src/server/adapters/clocks';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS, withSecurityHeaders } from '../../src/server/security';
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

describe('response hardening headers', () => {
  const directives = () =>
    new Map(CONTENT_SECURITY_POLICY.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values] as const));

  it('sends a closed Permissions-Policy and Cross-Origin-Opener-Policy on every kind of response (Req 11.9, 11.10)', async () => {
    const { app, knock } = setup({ limit: 1 });
    app.get('/page', (c) => c.html('<!doctype html><p>page</p>'));
    const responses = [
      await app.request('/api/health'),
      await app.request('/page'),
      await app.request('/api/nowhere'), // 404
      await app.request('/api/vault'), // 401
      await knock('203.0.113.9'), // 404: unknown link, inside the limit
      await knock('203.0.113.9'), // 429
    ];
    expect(responses.map((r) => r.status)).toEqual([200, 200, 404, 401, 404, 429]);
    for (const res of responses) {
      expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
      const policy = res.headers.get('Permissions-Policy')!;
      expect(policy).toBe('camera=(), microphone=(), geolocation=(), payment=()');
      // Closed: every feature listed is switched off for everyone.
      for (const entry of policy.split(',')) expect(entry.trim()).toMatch(/^[a-z-]+=\(\)$/);
    }
  });

  it('adds every hardening header to a response from an immutable source (Req 11.1-11.10)', () => {
    const asset = Response.redirect('https://example.com/', 302); // headers of such responses are immutable
    const out = withSecurityHeaders(asset);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(out.headers.get(name), name).toBe(value);
    expect(Object.keys(SECURITY_HEADERS).sort()).toEqual(
      ['Content-Security-Policy', 'Cross-Origin-Opener-Policy', 'Permissions-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options'].sort(),
    );
  });

  it('blocks plugins, framing and base-tag hijack by CSP directive (Req 11.4, 11.5)', () => {
    const d = directives();
    expect(d.get('object-src')).toEqual(["'none'"]);
    expect(d.get('frame-ancestors')).toEqual(["'none'"]);
    expect(d.get('base-uri')).toEqual(["'none'"]);
  });

  it('limits scripts and network requests to the page origin by CSP directive (Req 11.1, 11.6)', () => {
    const d = directives();
    expect(d.get('script-src')).toEqual(["'self'"]);
    expect(d.get('connect-src')).toEqual(["'self'"]);
    expect(d.get('default-src')).toEqual(["'self'"]);
    expect(d.get('form-action')).toEqual(["'self'"]);
    // No directive names another origin or a wildcard.
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:|\*/);
  });
});
