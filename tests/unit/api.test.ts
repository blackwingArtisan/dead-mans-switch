import { beforeEach, describe, expect, it } from 'vitest';
import { openLetter, sealLetter } from '../../src/core/crypto';
import { createApp } from '../../src/server/app';
import { MachineClock } from '../../src/server/adapters/clocks';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { T0 } from './helpers';

const BASE = 'http://switch.test';

function setup() {
  const clock = new MachineClock(() => T0);
  const store = new MemoryStore();
  const outbox = new OutboxMailer(clock);
  const { app } = createApp({ store, mailer: outbox, clock, baseUrl: BASE, dev: { clock, outbox, resetStore: () => store.clear() } });
  let owner = '';
  const call = async (method: string, path: string, body?: unknown, auth = true) => {
    const res = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth && owner ? { Authorization: `Bearer ${owner}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const createVault = async (settings: Record<string, unknown> = {}) => {
    const r = await call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' }, settings }, false);
    owner = r.body.ownerToken;
    return r;
  };
  const linkFrom = (kind: string, to: string) => {
    const msg = outbox.list().find((m) => m.kind === kind && m.to.email === to);
    if (!msg) throw new Error(`No ${kind} email to ${to}`);
    const url = new URL(msg.text.match(/https?:\/\/\S+/)![0]);
    return { path: url.pathname, token: url.pathname.split('/').pop()!, fragment: url.hash.replace(/^#k=/, '') };
  };
  return { app, call, createVault, outbox, linkFrom };
}

async function sealFor(recipient: { name: string; email: string }, custody: 'keepsake' | 'vault', id: string) {
  const { sealed, keepsakeHalf } = await sealLetter(id, { title: 'Sealed words', html: '<p>The garden key is in the blue jar.</p>', from: 'Mara' });
  return {
    keepsakeHalf,
    body: { id, recipient, custody, sealed, ...(custody === 'vault' ? { keepsakeHalf } : {}) },
  };
}

describe('API lifecycle', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it('runs the full lifecycle: seal, go silent, witness confirms, recipient opens once', async () => {
    const created = await t.createVault({ cadenceDays: 30, graceDays: 7 });
    expect(created.status).toBe(201);
    expect(created.body.vault.state).toBe('alive');

    expect((await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' })).status).toBe(201);
    expect(t.outbox.list().map((m) => m.kind)).toEqual(['witness-named']);

    const theo = { name: 'Theo Whitlock', email: 'theo@example.com' };
    const june = { name: 'June Okafor', email: 'june@example.com' };
    const keep = await sealFor(theo, 'keepsake', 'letter-theo-01');
    const vaulted = await sealFor(june, 'vault', 'letter-june-01');
    expect((await t.call('POST', '/api/vault/letters', keep.body)).status).toBe(201);
    const view = await t.call('POST', '/api/vault/letters', vaulted.body);
    expect(view.body.letters).toHaveLength(2);
    expect(JSON.stringify(view.body)).not.toContain('ciphertext');

    // Fast-forward past the deadline and the grace period.
    const travel = await t.call('POST', '/api/dev/clock', { days: 38 });
    expect(travel.body.tick.emails).toBeGreaterThan(0);
    expect((await t.call('GET', '/api/vault')).body.state).toBe('confirm');
    const kinds = t.outbox.list().map((m) => m.kind);
    expect(kinds).toEqual(['witness-named', 'reminder', 'grace', 'witness-ask', 'witnesses-asked']);

    // The witness answers.
    const witness = t.linkFrom('witness-ask', 'silas@example.com');
    const info = await t.call('GET', `/api/witness/${witness.token}`, undefined, false);
    expect(info.body).toMatchObject({ authorName: 'Mara Whitlock', witnessName: 'Silas Crane', state: 'confirm' });
    const answer = await t.call('POST', `/api/witness/${witness.token}`, { response: 'confirm' }, false);
    expect(answer.body.state).toBe('released');

    // Theo opens his keepsake-custody letter with the half he was given.
    const theoLink = t.linkFrom('release', 'theo@example.com');
    expect(theoLink.fragment).toBe('');
    const meta = await t.call('GET', `/api/open/${theoLink.token}`, undefined, false);
    expect(meta.body).toMatchObject({ authorName: 'Mara Whitlock', recipientName: 'Theo Whitlock', custody: 'keepsake', opened: false });
    const broken = await t.call('POST', `/api/open/${theoLink.token}/break`, undefined, false);
    expect(broken.status).toBe(200);
    const letter = await openLetter(broken.body.letterId, broken.body, keep.keepsakeHalf);
    expect(letter.html).toContain('blue jar');

    // One time only: the server has forgotten the sealed copy.
    const again = await t.call('POST', `/api/open/${theoLink.token}/break`, undefined, false);
    expect(again.status).toBe(410);
    expect((await t.call('GET', `/api/open/${theoLink.token}`, undefined, false)).body.opened).toBe(true);

    // June's vault-custody link carries the keepsake half in its fragment.
    const juneLink = t.linkFrom('release', 'june@example.com');
    expect(juneLink.fragment).toBe(vaulted.keepsakeHalf);
    const juneSealed = await t.call('POST', `/api/open/${juneLink.token}/break`, undefined, false);
    expect((await openLetter('letter-june-01', juneSealed.body, juneLink.fragment)).html).toContain('blue jar');

    // Released is final.
    expect((await t.call('POST', '/api/vault/check-in')).status).toBe(409);
  });

  it('a check-in during confirm cancels and stands witnesses down', async () => {
    await t.createVault();
    await t.call('POST', '/api/vault/witnesses', { name: 'Ada Penhallow', email: 'ada@example.com' });
    await t.call('POST', '/api/dev/clock', { days: 40 });
    const witness = t.linkFrom('witness-ask', 'ada@example.com');
    const r = await t.call('POST', '/api/vault/check-in');
    expect(r.body.state).toBe('alive');
    expect(t.outbox.list().some((m) => m.kind === 'stand-down')).toBe(true);
    expect((await t.call('GET', `/api/witness/${witness.token}`, undefined, false)).status).toBe(404);
  });

  it('a witness denial returns the vigil to grace and warns the author', async () => {
    await t.createVault();
    await t.call('POST', '/api/vault/witnesses', { name: 'Ada Penhallow', email: 'ada@example.com' });
    await t.call('POST', '/api/dev/clock', { days: 40 });
    const witness = t.linkFrom('witness-ask', 'ada@example.com');
    const r = await t.call('POST', `/api/witness/${witness.token}`, { response: 'deny' }, false);
    expect(r.body.state).toBe('grace');
    expect(t.outbox.list().find((m) => m.kind === 'denied')?.to.email).toBe('mara@example.com');
  });

  it('"to next event" jumps straight to the next threshold', async () => {
    await t.createVault({ cadenceDays: 10, reminderLeadDays: 2 });
    const r = await t.call('POST', '/api/dev/clock', { to: 'next' });
    expect(r.body.now).toBe(T0 + 8 * 86_400_000);
    expect((await t.call('GET', '/api/vault')).body.state).toBe('reminder');
  });

  it('pause and resume', async () => {
    await t.createVault();
    expect((await t.call('POST', '/api/vault/pause')).body.state).toBe('paused');
    await t.call('POST', '/api/dev/clock', { days: 100 });
    expect((await t.call('GET', '/api/vault')).body.state).toBe('paused');
    expect((await t.call('POST', '/api/vault/resume')).body.state).toBe('alive');
  });

  it('rejects bad input with clear messages', async () => {
    expect((await t.call('POST', '/api/vaults', { author: { name: '', email: 'x' } }, false)).body.error).toMatch(/name/);
    await t.createVault();
    expect((await t.call('PATCH', '/api/vault/settings', { cadenceDays: 0 })).body.error).toMatch(/cadence/);
    expect((await t.call('POST', '/api/vault/witnesses', { name: 'Me', email: 'mara@example.com' })).body.error).toMatch(/own witness/);
    const keep = await sealFor({ name: 'Theo', email: 'theo@example.com' }, 'keepsake', 'letter-bad-001');
    const leaked = await t.call('POST', '/api/vault/letters', { ...keep.body, keepsakeHalf: keep.keepsakeHalf });
    expect(leaked.status).toBe(400);
    expect(leaked.body.error).toMatch(/must stay with the recipient/);
    const vaulted = await sealFor({ name: 'June', email: 'june@example.com' }, 'vault', 'letter-bad-002');
    const mismatched = await t.call('POST', '/api/vault/letters', { ...vaulted.body, keepsakeHalf: keep.keepsakeHalf });
    expect(mismatched.body.error).toMatch(/does not match/);
  });

  it('requires the owner token for vault routes', async () => {
    await t.createVault();
    const res = await t.app.request('/api/vault', { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(res.status).toBe(401);
    expect((await t.app.request('/api/vault')).status).toBe(401);
  });

  it('burns a letter so it can never be released', async () => {
    await t.createVault();
    const keep = await sealFor({ name: 'Theo', email: 'theo@example.com' }, 'keepsake', 'letter-burn-01');
    await t.call('POST', '/api/vault/letters', keep.body);
    const r = await t.call('DELETE', '/api/vault/letters/letter-burn-01');
    expect(r.body.letters).toHaveLength(0);
  });

  describe('one-tap check-in links in the author\'s emails', () => {
    it('checks in once from the grace email, with no owner token, and every link from that cycle is then spent', async () => {
      await t.createVault({ cadenceDays: 30, graceDays: 7, reminderLeadDays: 3 });
      await t.call('POST', '/api/dev/clock', { days: 28 });
      await t.call('POST', '/api/dev/clock', { days: 3 });
      const reminder = t.linkFrom('reminder', 'mara@example.com');
      const grace = t.linkFrom('grace', 'mara@example.com');
      expect(reminder.path).toMatch(/^\/check-in\/[\w-]{43}$/);
      expect(grace.token).not.toBe(reminder.token);
      expect(t.outbox.list().find((m) => m.kind === 'grace')!.text).toContain('checks you in once and does nothing else');

      const info = await t.call('GET', `/api/check-in/${grace.token}`, undefined, false);
      expect(info.status).toBe(200);
      expect(info.body).toMatchObject({ authorName: 'Mara Whitlock', state: 'grace' });
      expect(info.body).not.toHaveProperty('letters');
      expect(info.body).not.toHaveProperty('witnesses');

      const done = await t.call('POST', `/api/check-in/${grace.token}`, undefined, false);
      expect(done.status).toBe(200);
      expect(done.body.state).toBe('alive');
      expect(done.body.nextDueAt).toBeGreaterThan(done.body.lastCheckInAt);

      for (const link of [grace, reminder]) {
        const again = await t.call('POST', `/api/check-in/${link.token}`, undefined, false);
        expect(again.status).toBe(404);
        expect(again.body.error).toMatch(/used or has expired/);
      }
    });

    it('a check-in from the vigil also spends the emailed links', async () => {
      await t.createVault({ cadenceDays: 30, graceDays: 7 });
      await t.call('POST', '/api/dev/clock', { days: 31 });
      const grace = t.linkFrom('grace', 'mara@example.com');
      await t.call('POST', '/api/vault/check-in', {});
      expect((await t.call('GET', `/api/check-in/${grace.token}`, undefined, false)).status).toBe(404);
    });

    it('cannot check in a released vigil, and letter or witness emails never carry a check-in link', async () => {
      await t.createVault({ cadenceDays: 30, graceDays: 7, witnessesRequired: 1 });
      await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
      const letter = await sealFor({ name: 'June Okafor', email: 'june@example.com' }, 'vault', 'letter-june-001');
      await t.call('POST', '/api/vault/letters', letter.body);
      await t.call('POST', '/api/dev/clock', { days: 38 });
      const asked = t.linkFrom('witnesses-asked', 'mara@example.com');
      const witness = t.linkFrom('witness-ask', 'silas@example.com');
      expect(witness.path).toMatch(/^\/witness\//);
      await t.call('POST', `/api/witness/${witness.token}`, { response: 'confirm' }, false);
      expect(t.linkFrom('release', 'june@example.com').path).toMatch(/^\/open\//);
      expect((await t.call('POST', `/api/check-in/${asked.token}`, undefined, false)).status).toBe(404);
    });

    it('rejects a made-up token', async () => {
      expect((await t.call('POST', `/api/check-in/${'x'.repeat(43)}`, undefined, false)).status).toBe(404);
    });
  });
});
