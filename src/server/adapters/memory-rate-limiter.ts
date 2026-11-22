import type { RateLimitDecision, RateLimiter } from '../ports';

export interface FixedWindowOptions {
  /** Requests allowed per client per window. */
  limit: number;
  windowMs: number;
}

/**
 * Fixed-window counter held in memory. State is per process (per isolate on
 * Workers), so a restart resets it. It slows guessing and noise; the 256-bit
 * tokens remain the real defence.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly opts: FixedWindowOptions) {}

  async hit(key: string, now: number): Promise<RateLimitDecision> {
    const { limit, windowMs } = this.opts;
    let w = this.windows.get(key);
    // A clock that moved backwards (the demo's time machine resetting) also starts a fresh window.
    if (!w || now - w.start >= windowMs || now < w.start) {
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    w.count += 1;
    if (this.windows.size > 10_000) {
      for (const [k, v] of this.windows) if (now - v.start >= windowMs) this.windows.delete(k);
    }
    if (w.count > limit) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) };
    }
    return { allowed: true, retryAfterSec: 0 };
  }
}
