import type { AdjustableClock, Clock } from '../ports';

/** Real wall-clock time. Used in production. */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * The demo "time machine": wall-clock time plus an offset that only moves forward
 * when asked. Pass a fixed `base` for fully deterministic tests.
 */
export class MachineClock implements AdjustableClock {
  private shift = 0;
  constructor(private readonly base: () => number = () => Date.now()) {}

  now(): number {
    return this.base() + this.shift;
  }
  advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('The time machine only travels forward.');
    this.shift += ms;
  }
  set(at: number): void {
    this.shift = at - this.base();
  }
  reset(): void {
    this.shift = 0;
  }
  offset(): number {
    return this.shift;
  }
}
