import { describe, expect, it } from 'vitest';
import { step } from '../../src/core/machine';
import { DAY, lastCandleOf } from '../../src/core/time';
import { ctxAt, makeVault, T0 } from './helpers';

describe('their candle, your light', () => {
  it('stands full when the author never checked in after beginning the vigil', () => {
    const v = makeVault({ cadenceDays: 30 });
    expect(lastCandleOf(v)).toEqual({ keptUntil: T0, wax: 1 });
  });

  it('stands where the wax was at the last check-in', () => {
    let v = makeVault({ cadenceDays: 30 });
    v = step(v, { type: 'checkIn' }, ctxAt(T0 + 21 * DAY)).vault; // nine days to spare
    const candle = lastCandleOf(v);
    expect(candle.keptUntil).toBe(T0 + 21 * DAY);
    expect(candle.wax).toBeCloseTo(0.3, 5);
  });

  it('measures from the previous check-in, not from the start', () => {
    let v = makeVault({ cadenceDays: 30 });
    v = step(v, { type: 'checkIn' }, ctxAt(T0 + 20 * DAY)).vault;
    v = step(v, { type: 'checkIn' }, ctxAt(T0 + 26 * DAY)).vault; // six days into a thirty-day cycle
    expect(lastCandleOf(v).wax).toBeCloseTo(0.8, 5);
  });

  it('never draws less than the stub, even for a check-in made in grace', () => {
    let v = makeVault({ cadenceDays: 30, graceDays: 7 });
    v = step(v, { type: 'tick' }, ctxAt(T0 + 33 * DAY)).vault;
    v = step(v, { type: 'checkIn' }, ctxAt(T0 + 33 * DAY)).vault;
    expect(lastCandleOf(v).wax).toBe(0.06);
  });
});
