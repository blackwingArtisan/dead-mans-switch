import { describe, expect, it } from 'vitest';
import { step, SwitchError, type Effect } from '../../src/core/machine';
import { DAY, HOUR, nextEventAt, scheduleOf } from '../../src/core/time';
import type { Vault } from '../../src/core/types';
import { ctxAt, makeVault, T0 } from './helpers';

// Defaults: cadence 30d, grace 7d, reminder lead 3d, 1 witness required, silence release 14d.
const at = (days: number) => T0 + days * DAY;
const tick = (v: Vault, days: number) => step(v, { type: 'tick' }, ctxAt(at(days)));
const templates = (effects: Effect[]) => effects.map((e) => e.template);

/** Walks a fresh vault to the confirm stage. */
function toConfirm(v = makeVault()) {
  return tick(v, 37).vault;
}

describe('schedule', () => {
  it('derives every deadline from the last check-in', () => {
    const s = scheduleOf(makeVault());
    expect(s.reminderAt).toBe(at(27));
    expect(s.dueAt).toBe(at(30));
    expect(s.lastCallAt).toBe(at(36));
    expect(s.graceEndsAt).toBe(at(37));
    expect(s.silenceReleaseAt).toBeNull();
  });

  it('never schedules the reminder before the last check-in', () => {
    const s = scheduleOf(makeVault({ cadenceDays: 2, reminderLeadDays: 5 }));
    expect(s.reminderAt).toBe(T0);
  });
});

describe('the happy path to release', () => {
  it('stays alive and silent before the reminder lead', () => {
    const r = tick(makeVault(), 26);
    expect(r.vault.state).toBe('alive');
    expect(r.effects).toEqual([]);
  });

  it('alive -> reminder sends one reminder to the author', () => {
    const r = tick(makeVault(), 27);
    expect(r.vault.state).toBe('reminder');
    expect(templates(r.effects)).toEqual(['reminder']);
    expect(r.effects[0]!.to.email).toBe('mara@example.com');
  });

  it('reminder -> grace at the deadline', () => {
    const r = tick(tick(makeVault(), 27).vault, 30);
    expect(r.vault.state).toBe('grace');
    expect(templates(r.effects)).toEqual(['grace']);
  });

  it('sends a last call one day before grace ends', () => {
    const v = tick(tick(makeVault(), 27).vault, 30).vault;
    const r = tick(v, 36);
    expect(r.vault.state).toBe('grace');
    expect(templates(r.effects)).toEqual(['last-call']);
  });

  it('grace -> confirm asks every witness with a fresh token and tells the author', () => {
    const r = tick(tick(makeVault(), 30).vault, 37);
    expect(r.vault.state).toBe('confirm');
    expect(templates(r.effects)).toEqual(['witness-ask', 'witness-ask', 'witnesses-asked']);
    expect(r.vault.witnesses.every((w) => w.tokenHash !== null)).toBe(true);
    expect(r.vault.confirmStartedAt).toBe(at(37));
  });

  it('confirm -> released when enough witnesses confirm, minting one open link per letter', () => {
    const v = toConfirm(makeVault({}, 2, 2));
    const r = step(v, { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38)));
    expect(r.vault.state).toBe('released');
    expect(templates(r.effects)).toEqual(['release', 'release']);
    const [keepsake, vault] = r.effects as Extract<Effect, { template: 'release' }>[];
    expect(keepsake!.to.email).toBe('theo@example.com');
    expect(keepsake!.keepsakeHalf).toBeUndefined();
    expect(vault!.keepsakeHalf).toBe('YQ');
    expect(r.vault.letters.every((l) => l.openTokenHash !== null && l.releasedAt === at(38))).toBe(true);
    expect(r.vault.witnesses.every((w) => w.tokenHash === null)).toBe(true);
  });

  it('waits for k of n confirmations', () => {
    const v = toConfirm(makeVault({ witnessesRequired: 2 }, 3));
    const one = step(v, { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38)));
    expect(one.vault.state).toBe('confirm');
    expect(one.effects).toEqual([]);
    const two = step(one.vault, { type: 'witnessConfirm', witnessId: 'w3' }, ctxAt(at(39)));
    expect(two.vault.state).toBe('released');
  });

  it('cascades a long silence through every stage in one tick', () => {
    const r = tick(makeVault(), 60);
    expect(r.vault.state).toBe('confirm');
    expect(templates(r.effects)).toEqual(['reminder', 'grace', 'witness-ask', 'witness-ask', 'witnesses-asked']);
  });

  it('releases on silence only after the silence window, counted from when witnesses were asked', () => {
    const v = toConfirm();
    expect(tick(v, 37 + 13).vault.state).toBe('confirm');
    const r = tick(v, 37 + 14);
    expect(r.vault.state).toBe('released');
    expect(r.vault.history.at(-1)!.note).toMatch(/silence window/);
  });

  it('never releases on silence when the author turned it off', () => {
    const v = toConfirm(makeVault({ silenceReleaseDays: null }));
    expect(tick(v, 400).vault.state).toBe('confirm');
  });

  it('caps required confirmations at the number of witnesses', () => {
    const v = toConfirm(makeVault({ witnessesRequired: 5 }, 1));
    const r = step(v, { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38)));
    expect(r.vault.state).toBe('released');
  });

  it('with no witnesses, only the silence window can release', () => {
    const v = toConfirm(makeVault({}, 0));
    expect(v.state).toBe('confirm');
    expect(tick(v, 40).vault.state).toBe('confirm');
    expect(tick(v, 51).vault.state).toBe('released');
  });
});

describe('every cancel path', () => {
  for (const [label, days] of [
    ['alive', 5],
    ['reminder', 28],
    ['grace', 32],
    ['confirm', 38],
  ] as const) {
    it(`check-in from ${label} returns to alive with a fresh candle`, () => {
      const v = tick(makeVault(), days).vault;
      expect(v.state).toBe(label);
      const r = step(v, { type: 'checkIn' }, ctxAt(at(days)));
      expect(r.vault.state).toBe('alive');
      expect(r.vault.lastCheckInAt).toBe(at(days));
      expect(r.vault.cycle).toBe(v.cycle + 1);
      expect(scheduleOf(r.vault).dueAt).toBe(at(days + 30));
      expect(r.vault.witnesses.every((w) => w.response === 'pending' && w.tokenHash === null)).toBe(true);
    });
  }

  it('check-in during confirm tells asked witnesses to stand down', () => {
    const r = step(toConfirm(), { type: 'checkIn' }, ctxAt(at(38)));
    expect(templates(r.effects)).toEqual(['stand-down', 'stand-down']);
  });

  it('a witness denial stops the release and restarts a full grace window', () => {
    const v = toConfirm();
    const r = step(v, { type: 'witnessDeny', witnessId: 'w2' }, ctxAt(at(38)));
    expect(r.vault.state).toBe('grace');
    expect(templates(r.effects)).toEqual(['denied']);
    expect(scheduleOf(r.vault).graceEndsAt).toBe(at(45));
    expect(r.vault.witnesses.every((w) => w.tokenHash === null)).toBe(true);
    // Still silent: witnesses are asked again in a new round with new tokens.
    const again = tick(r.vault, 45);
    expect(again.vault.state).toBe('confirm');
    expect(again.vault.confirmRound).toBe(2);
    expect(again.vault.witnesses.every((w) => w.response === 'pending')).toBe(true);
  });

  it('a denial sends a new last call before the restarted grace ends', () => {
    const denied = step(toConfirm(), { type: 'witnessDeny', witnessId: 'w1' }, ctxAt(at(38))).vault;
    expect(templates(tick(denied, 44).effects)).toEqual(['last-call']);
  });

  it('pause stops every timer; resume lights a fresh candle', () => {
    const paused = step(tick(makeVault(), 29).vault, { type: 'pause' }, ctxAt(at(29)));
    expect(paused.vault.state).toBe('paused');
    expect(tick(paused.vault, 500).vault.state).toBe('paused');
    expect(tick(paused.vault, 500).effects).toEqual([]);
    const resumed = step(paused.vault, { type: 'resume' }, ctxAt(at(500)));
    expect(resumed.vault.state).toBe('alive');
    expect(scheduleOf(resumed.vault).dueAt).toBe(at(530));
  });

  it('check-in while paused also resumes', () => {
    const paused = step(makeVault(), { type: 'pause' }, ctxAt(at(1))).vault;
    expect(step(paused, { type: 'checkIn' }, ctxAt(at(2))).vault.state).toBe('alive');
  });

  it('pausing from confirm stands witnesses down', () => {
    const r = step(toConfirm(), { type: 'pause' }, ctxAt(at(38)));
    expect(r.vault.state).toBe('paused');
    expect(templates(r.effects)).toEqual(['stand-down', 'stand-down']);
  });
});

describe('idempotence and guards', () => {
  it('ticking twice at the same instant sends nothing new', () => {
    const first = tick(makeVault(), 27);
    const second = tick(first.vault, 27);
    expect(second.effects).toEqual([]);
    expect(second.changed).toBe(false);
  });

  it('a long-delayed tick in grace still sends the last call only once', () => {
    const v = tick(makeVault(), 36).vault;
    expect(tick(v, 36.5).effects).toEqual([]);
  });

  it('released is final', () => {
    const released = step(toConfirm(), { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38))).vault;
    expect(() => step(released, { type: 'checkIn' }, ctxAt(at(39)))).toThrow(SwitchError);
    expect(() => step(released, { type: 'pause' }, ctxAt(at(39)))).toThrow(/already been released/);
    expect(tick(released, 900).effects).toEqual([]);
  });

  it('witnesses can only answer during confirm, once each', () => {
    expect(() => step(makeVault(), { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(1)))).toThrow(/Nothing is waiting/);
    const v = toConfirm(makeVault({ witnessesRequired: 2 }));
    const once = step(v, { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38))).vault;
    expect(() => step(once, { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38)))).toThrow(/already recorded/);
    expect(() => step(once, { type: 'witnessDeny', witnessId: 'nobody' }, ctxAt(at(38)))).toThrow(/no longer on the list/);
  });

  it('does not mutate its input', () => {
    const v = makeVault();
    const copy = structuredClone(v);
    tick(v, 60);
    expect(v).toEqual(copy);
  });

  it('a released letter is not released twice', () => {
    const v = toConfirm(makeVault({}, 1, 1));
    const r = step(v, { type: 'witnessConfirm', witnessId: 'w1' }, ctxAt(at(38)));
    expect(r.effects.filter((e) => e.template === 'release')).toHaveLength(1);
  });
});

describe('nextEventAt', () => {
  it('points at the next threshold in each live stage', () => {
    const v = makeVault();
    expect(nextEventAt(v, T0)).toBe(at(27));
    const reminder = tick(v, 27).vault;
    expect(nextEventAt(reminder, at(27))).toBe(at(30));
    const grace = tick(reminder, 30).vault;
    expect(nextEventAt(grace, at(30))).toBe(at(36));
    const confirm = tick(grace, 37).vault;
    expect(nextEventAt(confirm, at(37))).toBe(at(51));
  });

  it('is null when nothing can happen', () => {
    const paused = step(makeVault(), { type: 'pause' }, ctxAt(T0 + HOUR)).vault;
    expect(nextEventAt(paused, T0 + HOUR)).toBeNull();
  });
});
