/**
 * Defence in depth for every response, on Node and on the Worker.
 *
 * The web app is a static bundle: no inline scripts, no third-party origins,
 * fonts self-hosted. Letter HTML is sanitised with DOMPurify before it is
 * rendered; the policy below makes sure that even a sanitiser miss cannot run
 * script, load remote content or frame the page.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { Clock, RateLimiter } from './ports';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // React writes style attributes (candle flicker, progress); no external sheets.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Adds the security headers to a response that may be immutable (e.g. from a Fetcher). */
export function withSecurityHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}

export const securityHeaders = (): MiddlewareHandler => async (c, next) => {
  await next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
};

export interface RateLimitOptions {
  /** Requests allowed per client per window. */
  limit: number;
  windowMs: number;
}

export const DEFAULT_TOKEN_RATE_LIMIT: RateLimitOptions = { limit: 60, windowMs: 60_000 };

/** Picks the client key: the Worker's connecting IP, else whatever the host resolves. */
export type ClientKey = (c: Context) => string;

export const cloudflareClientKey: ClientKey = (c) => c.req.header('cf-connecting-ip') ?? 'anonymous';

/**
 * Rate-limits the token routes (witness and letter links) through a `RateLimiter`
 * port. Tokens carry 256 bits of entropy, so this is about cost and noise, not the
 * only line of defence.
 */
export function rateLimit(clock: Clock, limiter: RateLimiter, keyOf: ClientKey): MiddlewareHandler {
  return async (c, next) => {
    const decision = await limiter.hit(keyOf(c), clock.now());
    if (!decision.allowed) {
      c.header('Retry-After', String(Math.max(1, Math.ceil(decision.retryAfterSec))));
      return c.json({ error: 'Too many knocks at the crypt door. Please wait a moment and try again.' }, 429);
    }
    await next();
  };
}
