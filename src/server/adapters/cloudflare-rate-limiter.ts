import type { RateLimitDecision, RateLimiter } from '../ports';

/**
 * The shape of Cloudflare's Workers Rate Limiting binding (`[[ratelimits]]` in
 * wrangler.toml; `limit({ key })` resolves to `{ success }`). Typed here so we do
 * not depend on a particular version of @cloudflare/workers-types.
 */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Wraps the binding. The limit and period are configured in wrangler.toml, and
 * the binding does not report the time left, so `retryAfterSec` is the
 * configured period (the longest a client could have to wait).
 */
export class CloudflareRateLimiter implements RateLimiter {
  constructor(
    private readonly binding: RateLimitBinding,
    private readonly periodSec = 60,
  ) {}

  async hit(key: string, _now: number): Promise<RateLimitDecision> {
    try {
      const { success } = await this.binding.limit({ key });
      return success ? { allowed: true, retryAfterSec: 0 } : { allowed: false, retryAfterSec: this.periodSec };
    } catch (err) {
      // A limiter outage must not lock witnesses and recipients out of their links.
      console.error('Rate limiter unavailable, allowing request', err instanceof Error ? err.message : err);
      return { allowed: true, retryAfterSec: 0 };
    }
  }
}
