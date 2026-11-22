import { describe, expect, it } from 'vitest';
import { step } from '../../src/core/machine';
import { describeAge, reviewOf } from '../../src/core/review';
import { DAY, scheduleOf } from '../../src/core/time';
import { viewOf } from '../../src/core/vault';
import { renderEmail } from '../../src/server/emails';
import { ctxAt, makeVault, T0 } from './helpers';

const BASE = 'http://localhost:3140';
const yearOld = () => makeVault({ cadenceDays: 400, reminderLeadDays: 3 }, 1, 2);

describe('review age (Founder Req 5.1, 5.2)', () => {
  it('is null at 364 days and due at 365 (Founder Req 5.2)', () => {
    const v = makeVault();
    expect(reviewOf(v, T0 + 364 * DAY)).toBeNull();
    expect(reviewOf(v, T0 + 365 * DAY)).toMatchObject({ ageDays: 365, years: 1, days: 0 });
    expect(describeAge(reviewOf(v, T0 + 368 * DAY)!)).toBe('1 year and 3 days');
    expect(describeAge(reviewOf(v, T0 + 730 * DAY)!)).toBe('2 years');
  });

  it('takes the oldest sealed, unreleased letter (Founder Req 5.1, 5.12)', () => {
    const v = makeVault({}, 1, 2);
    v.letters[0]!.sealedAt = T0 - 400 * DAY;
    v.letters[1]!.sealedAt = T0 - 10 * DAY;
    expect(reviewOf(v, T0)!.ageDays).toBe(400);
    v.letters[0]!.sealed = null; // opened: the server forgot it
    expect(reviewOf(v, T0)).toBeNull();
    v.letters[0]!.sealed = { ciphertext: 'a', iv: 'b', vaultHalf: 'c', keepsakeTag: 'd' };
    v.letters.shift(); // burned: recomputed from what remains
    expect(reviewOf(v, T0)).toBeNull();
  });

  it('ignores released letters and released vigils (Founder Req 5.8)', () => {
    const v = makeVault();
    v.letters[0]!.releasedAt = T0;
    expect(reviewOf(v, T0 + 900 * DAY)).toBeNull();
    const w = makeVault();
    w.state = 'released';
    expect(reviewOf(w, T0 + 900 * DAY)).toBeNull();
    expect(reviewOf(makeVault({}, 1, 0), T0 + 900 * DAY)).toBeNull();
  });
});

describe('the nudge in the pure machine', () => {
  const reminderAt = (v = yearOld()) => scheduleOf(v).reminderAt;

  it('adds reviewAgeDays only to the reminder, only when due (Founder Req 5.3, 5.4)', () => {
    const young = makeVault({ cadenceDays: 30 });
    const r1 = step(young, { type: 'tick' }, ctxAt(scheduleOf(young).reminderAt));
    expect(r1.effects.map((e) => e.template)).toEqual(['reminder']);
    expect(r1.effects[0]).not.toHaveProperty('reviewAgeDays');

    const v = yearOld();
    v.lastCheckInAt = T0 + 380 * DAY - 400 * DAY + 380 * DAY; // check-in 360 days in; reminder lands after day 365
    const at = scheduleOf(v).reminderAt;
    expect(at).toBeGreaterThanOrEqual(T0 + 365 * DAY);
    const r2 = step(v, { type: 'tick' }, ctxAt(at));
    expect(r2.effects).toHaveLength(1);
    expect(r2.effects[0]).toMatchObject({ template: 'reminder', reviewAgeDays: Math.floor((at - T0) / DAY) });
  });

  it('changes no state, history, schedule or sent key, and mails nobody else (Founder Req 5.5, 5.6)', () => {
    const old = yearOld();
    old.lastCheckInAt = T0 + 360 * DAY;
    const fresh = structuredClone(old);
    for (const l of fresh.letters) l.sealedAt = old.lastCheckInAt; // same vault, no old letters
    const at = scheduleOf(old).reminderAt;
    const a = step(old, { type: 'tick' }, ctxAt(at));
    const b = step(fresh, { type: 'tick' }, ctxAt(at));
    const strip = (v: typeof a.vault) => ({ ...v, letters: [] });
    expect(strip(a.vault)).toEqual(strip(b.vault));
    expect(scheduleOf(a.vault)).toEqual(scheduleOf(b.vault));
    expect(a.effects.map((e) => [e.template, e.to.email])).toEqual(b.effects.map((e) => [e.template, e.to.email]));
    expect(a.vault.state).toBe('reminder');
    expect(a.effects.every((e) => e.to.email === old.author.email)).toBe(true);
  });

  it('is idempotent at the same instant (Founder Req 5.10)', () => {
    const v = yearOld();
    v.lastCheckInAt = T0 + 360 * DAY;
    const at = scheduleOf(v).reminderAt;
    const once = step(v, { type: 'tick' }, ctxAt(at));
    const twice = step(once.vault, { type: 'tick' }, ctxAt(at));
    expect(once.effects).toHaveLength(1);
    expect(twice.effects).toHaveLength(0);
    expect(twice.changed).toBe(false);
  });

  it('does not read the system clock (Founder Req 5.11)', () => {
    const v = makeVault();
    expect(reviewOf(v, T0 + 400 * DAY)).toEqual(reviewOf(v, T0 + 400 * DAY));
    expect(reviewOf(v, T0 + 400 * DAY)!.ageDays).toBe(400);
  });
});

describe('the reminder email (Founder Req 5.3, 5.4)', () => {
  const effect = { type: 'email' as const, vaultId: 'v', template: 'reminder' as const, to: { name: 'Mara', email: 'mara@example.com' }, dueAt: T0 };

  it('asks for a review when the effect carries an age', () => {
    const m = renderEmail({ ...effect, reviewAgeDays: 368 }, BASE);
    expect(m.text).toContain('Your oldest letter was sealed 1 year and 3 days ago. Please open your vigil and review your letters');
    expect(m.html).toContain('review your letters');
    expect(m.subject).toBe('Your candle burns low: please check in');
  });

  it('is unchanged without one', () => {
    const m = renderEmail(effect, BASE);
    expect(m.text).not.toMatch(/review your letters/i);
  });
});

describe('the vigil view (Founder Req 5.7, 5.8, 5.12)', () => {
  it('carries the note only when due', () => {
    const v = makeVault();
    expect(viewOf(v, T0 + 100 * DAY).review).toBeNull();
    expect(viewOf(v, T0 + 366 * DAY).review).toMatchObject({ ageDays: 366, years: 1, days: 1 });
    v.letters = [];
    expect(viewOf(v, T0 + 900 * DAY).review).toBeNull();
  });
});
