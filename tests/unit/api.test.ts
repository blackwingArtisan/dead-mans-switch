import { beforeEach, describe, expect, it } from 'vitest';
import { openLetter, sealLetter } from '../../src/core/crypto';
import { sha256 } from '../../src/core/encoding';
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
  return { app, call, createVault, outbox, linkFrom, store, getOwner: () => owner };
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
    // The recipient reads by the author's own candle, as it was last tended.
    expect(meta.body.lastCandle.wax).toBeGreaterThan(0);
    expect(meta.body.lastCandle.wax).toBeLessThanOrEqual(1);
    expect(typeof meta.body.lastCandle.keptUntil).toBe('number');
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

  it('a witness note reaches the author in the denial email and the ledger (Req 6.18)', async () => {
    await t.createVault();
    await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
    await t.call('POST', '/api/dev/clock', { days: 40 });
    const witness = t.linkFrom('witness-ask', 'silas@example.com');
    const r = await t.call('POST', `/api/witness/${witness.token}`, { response: 'deny', note: '  Mara was hiking  ' }, false);
    expect(r.body.state).toBe('grace');
    expect(t.outbox.list().find((m) => m.kind === 'denied')?.text).toContain('Mara was hiking');
    const ledger = (await t.call('GET', '/api/vault')).body.history.map((h: { note: string }) => h.note).join('\n');
    expect(ledger).toContain('Mara was hiking');
  });

  it('refuses a witness note that is not text or is over 200 characters, and changes nothing (Req 6.19)', async () => {
    await t.createVault();
    await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
    await t.call('POST', '/api/dev/clock', { days: 40 });
    const witness = t.linkFrom('witness-ask', 'silas@example.com');
    for (const note of ['x'.repeat(201), 42, { a: 1 }]) {
      const r = await t.call('POST', `/api/witness/${witness.token}`, { response: 'deny', note }, false);
      expect(r.status).toBe(400);
      expect(r.body.error).toContain('200 characters');
    }
    expect((await t.call('GET', '/api/vault')).body.state).toBe('confirm');
    // The link still works afterwards, and the longest allowed note is accepted.
    const ok = await t.call('POST', `/api/witness/${witness.token}`, { response: 'deny', note: 'x'.repeat(200) }, false);
    expect(ok.status).toBe(200);
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

  it('exports each unopened letter as the vault holds it, never with a keepsake-custody half', async () => {
    await t.createVault();
    const theo = await sealFor({ name: 'Theo Whitlock', email: 'theo@example.com' }, 'keepsake', 'letter-theo-02');
    const june = await sealFor({ name: 'June Okafor', email: 'june@example.com' }, 'vault', 'letter-june-02');
    await t.call('POST', '/api/vault/letters', theo.body);
    await t.call('POST', '/api/vault/letters', june.body);
    expect((await t.call('GET', '/api/vault/export', undefined, false)).status).toBe(401);
    const { status, body } = await t.call('GET', '/api/vault/export');
    expect(status).toBe(200);
    expect(body).toMatchObject({ format: 'dms-export-v1', authorName: 'Mara Whitlock' });
    expect(body.letters.map((l: { id: string }) => l.id)).toEqual(['letter-theo-02', 'letter-june-02']);
    const [keepsake, vault] = body.letters;
    expect(keepsake.keepsakeHalf).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(theo.keepsakeHalf);
    expect(JSON.stringify(body)).not.toContain('@example.com');
    // The export opens with the recipient's half, exactly as the release link would.
    expect((await openLetter(keepsake.id, keepsake, theo.keepsakeHalf)).html).toContain('blue jar');
    expect((await openLetter(vault.id, vault, vault.keepsakeHalf)).html).toContain('blue jar');
  });

  it('a recipient who has read their letter can light one candle back, seen by the witnesses and the others', async () => {
    await t.createVault({ cadenceDays: 30, graceDays: 7 });
    await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
    const theo = await sealFor({ name: 'Theo Whitlock', email: 'theo@example.com' }, 'keepsake', 'letter-theo-03');
    const june = await sealFor({ name: 'June Okafor', email: 'june@example.com' }, 'vault', 'letter-june-03');
    await t.call('POST', '/api/vault/letters', theo.body);
    await t.call('POST', '/api/vault/letters', june.body);
    await t.call('POST', '/api/dev/clock', { days: 38 });
    const witness = t.linkFrom('witness-ask', 'silas@example.com');
    await t.call('POST', `/api/witness/${witness.token}`, { response: 'confirm' }, false);
    const theoLink = t.linkFrom('release', 'theo@example.com').token;
    const juneLink = t.linkFrom('release', 'june@example.com').token;

    // Not before reading.
    const early = await t.call('POST', `/api/open/${theoLink}/candle`, { line: 'Thank you, Mum.' }, false);
    expect(early.status).toBe(409);
    expect((await t.call('GET', `/api/open/${theoLink}`, undefined, false)).body.candles).toEqual([]);

    await t.call('POST', `/api/open/${theoLink}/break`, undefined, false);
    expect((await t.call('POST', `/api/open/${theoLink}/candle`, { line: '   ' }, false)).status).toBe(400);
    expect((await t.call('POST', `/api/open/${theoLink}/candle`, { line: 'x'.repeat(141) }, false)).status).toBe(400);
    const lit = await t.call('POST', `/api/open/${theoLink}/candle`, { line: '  I found the\n blue tin.  ' }, false);
    expect(lit.status).toBe(201);
    expect(lit.body.candle.line).toBe('I found the blue tin.');
    // Once only.
    expect((await t.call('POST', `/api/open/${theoLink}/candle`, { line: 'Again.' }, false)).status).toBe(409);

    // June sees Theo's candle only after she has read her own letter.
    expect((await t.call('GET', `/api/open/${juneLink}`, undefined, false)).body.candles).toEqual([]);
    await t.call('POST', `/api/open/${juneLink}/break`, undefined, false);
    const juneInfo = (await t.call('GET', `/api/open/${juneLink}`, undefined, false)).body;
    expect(juneInfo.candle).toBeNull();
    expect(juneInfo.candles).toEqual([{ from: 'Theo Whitlock', line: 'I found the blue tin.', at: expect.any(Number) }]);

    // The witness and June hear of it by email (their links are spent by then); Theo is not mailed his own line.
    const told = t.outbox.list().filter((m) => m.kind === 'candle-lit');
    expect(told.map((m) => m.to.email).sort()).toEqual(['june@example.com', 'silas@example.com']);
    expect(told[0]!.subject).toBe('Theo Whitlock lit a candle for Mara Whitlock');
    expect(told[0]!.text).toContain('"I found the blue tin."');
    // And the author's released vigil shows it on the headstone.

    const vigil = (await t.call('GET', '/api/vault')).body;
    expect(vigil.letters.find((l: { id: string }) => l.id === 'letter-theo-03').candle.line).toBe('I found the blue tin.');
    expect(vigil.history.some((h: { kind: string }) => h.kind === 'candle-lit')).toBe(true);
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

describe('owner token custody and defaults', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it('stores only the SHA-256 hash of the owner token and returns the token once (Req 1.4, 1.7)', async () => {
    const created = await t.createVault();
    const token = created.body.ownerToken as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
    const id = (await t.store.listIds())[0]!;
    // Do some work so the token could leak into history or witness records.
    await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
    await t.call('POST', '/api/vault/check-in');
    const raw = (await t.store.get(id))!;
    expect(raw.ownerTokenHash).toBe(await sha256(token));
    expect(raw.ownerTokenHash).not.toBe(token);
    expect(JSON.stringify(raw)).not.toContain(token);
    expect(JSON.stringify(t.store.snapshot())).not.toContain(token);
    expect(await t.store.findByToken('owner', await sha256(token))).toBe(id);
    expect(await t.store.findByToken('owner', token)).toBeNull();
    // The token is handed over once: later views never repeat it.
    const view = await t.call('GET', '/api/vault');
    expect(JSON.stringify(view.body)).not.toContain(token);
    expect(view.body.ownerToken).toBeUndefined();
  });

  it('gives a new vigil the default settings and records the first check-in now (Req 1.1, 1.2, 1.6)', async () => {
    const created = await t.createVault();
    expect(created.status).toBe(201);
    expect(created.body.vault.state).toBe('alive');
    const raw = (await t.store.get((await t.store.listIds())[0]!))!;
    expect(raw.settings).toEqual({ cadenceDays: 30, graceDays: 7, reminderLeadDays: 3, witnessesRequired: 1, silenceReleaseDays: 14 });
    expect(raw.state).toBe('alive');
    expect(raw.lastCheckInAt).toBe(T0);
  });

  it('keeps explicit settings and fills the rest with defaults (Req 1.2)', async () => {
    await t.createVault({ cadenceDays: 10 });
    const raw = (await t.store.get((await t.store.listIds())[0]!))!;
    expect(raw.settings).toMatchObject({ cadenceDays: 10, graceDays: 7, reminderLeadDays: 3, witnessesRequired: 1, silenceReleaseDays: 14 });
  });

  it('answers 401 and changes nothing when the owner token is missing or wrong (Req 1.5, 1.8)', async () => {
    await t.createVault();
    const witness = await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
    const letterId = 'letter-auth-01';
    const sealed = await sealFor({ name: 'Theo Whitlock', email: 'theo@example.com' }, 'keepsake', letterId);
    await t.call('POST', '/api/vault/letters', sealed.body);
    const before = JSON.stringify(t.store.snapshot());
    const mailBefore = t.outbox.list().length;
    const witnessId = witness.body.witnesses[0].id;

    const attempts: [string, string, unknown?][] = [
      ['GET', '/api/vault'],
      ['POST', '/api/vault/check-in'],
      ['POST', '/api/vault/pause'],
      ['POST', '/api/vault/resume'],
      ['PATCH', '/api/vault/settings', { cadenceDays: 5 }],
      ['POST', '/api/vault/witnesses', { name: 'Ada Penhallow', email: 'ada@example.com' }],
      ['DELETE', `/api/vault/witnesses/${witnessId}`],
      ['POST', '/api/vault/letters', { ...sealed.body, id: 'letter-auth-02' }],
      ['DELETE', `/api/vault/letters/${letterId}`],
      ['GET', '/api/vault/export'],
    ];
    for (const headers of [{} as Record<string, string>, { Authorization: 'Bearer not-a-real-token' }]) {
      for (const [method, path, body] of attempts) {
        const res = await t.app.request(path, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        expect(res.status, `${method} ${path}`).toBe(401);
      }
    }
    expect(JSON.stringify(t.store.snapshot())).toBe(before);
    expect(t.outbox.list()).toHaveLength(mailBefore);
  });

  it('creates nothing when vigil creation is rejected (Req 1.3, 1.8)', async () => {
    const bad = await t.call('POST', '/api/vaults', { author: { name: 'Mara', email: 'mara@example.com' }, settings: { cadenceDays: 400 } }, false);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/cadence.*1 to 365/);
    expect(await t.store.listIds()).toEqual([]);
  });
});

describe('release emails and the released vigil', () => {
  async function release(t: ReturnType<typeof setup>) {
    await t.createVault({ cadenceDays: 30, graceDays: 7 });
    await t.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' });
    const keep = await sealFor({ name: 'Theo Whitlock', email: 'theo@example.com' }, 'keepsake', 'letter-rel-01');
    const vaulted = await sealFor({ name: 'June Okafor', email: 'june@example.com' }, 'vault', 'letter-rel-02');
    await t.call('POST', '/api/vault/letters', keep.body);
    await t.call('POST', '/api/vault/letters', vaulted.body);
    await t.call('POST', '/api/dev/clock', { days: 38 });
    const w = t.linkFrom('witness-ask', 'silas@example.com');
    const done = await t.call('POST', `/api/witness/${w.token}`, { response: 'confirm' }, false);
    expect(done.body.state).toBe('released');
    return { keep, vaulted };
  }

  it('never puts the keepsake half in a keepsake-custody release email, but does in vault custody (Req 7.11, 7.12, 7.9)', async () => {
    const t = setup();
    const { keep, vaulted } = await release(t);
    const releases = t.outbox.list().filter((m) => m.kind === 'release');
    expect(releases.map((m) => m.to.email).sort()).toEqual(['june@example.com', 'theo@example.com']);
    const theo = releases.find((m) => m.to.email === 'theo@example.com')!;
    for (const part of [theo.subject, theo.text, theo.html]) expect(part).not.toContain(keep.keepsakeHalf);
    expect(theo.text).toMatch(/\/open\/[A-Za-z0-9_-]{43}(\s|$)/);
    expect(theo.text).not.toContain('#k=');
    expect(theo.html).not.toContain('#k=');
    // No email of any kind, to anyone, carries the keepsake half.
    for (const m of t.outbox.list()) {
      expect(JSON.stringify(m)).not.toContain(keep.keepsakeHalf);
    }
    // Vault custody: the half rides in the link fragment, as the requirement says.
    const june = releases.find((m) => m.to.email === 'june@example.com')!;
    expect(june.text).toContain(`#k=${vaulted.keepsakeHalf}`);
  });

  it('refuses settings, witness and letter changes once released, and changes nothing (Req 7.9, 7.12)', async () => {
    const t = setup();
    const { keep } = await release(t);
    const before = JSON.stringify(t.store.snapshot());
    const witnessId = (await t.call('GET', '/api/vault')).body.witnesses[0].id;
    const fresh = await sealFor({ name: 'Rowan Ashby', email: 'rowan@example.com' }, 'keepsake', 'letter-rel-03');
    const attempts: [string, string, unknown?][] = [
      ['PATCH', '/api/vault/settings', { cadenceDays: 5 }],
      ['POST', '/api/vault/witnesses', { name: 'Ada Penhallow', email: 'ada@example.com' }],
      ['DELETE', `/api/vault/witnesses/${witnessId}`],
      ['POST', '/api/vault/letters', fresh.body],
      ['DELETE', '/api/vault/letters/letter-rel-01'],
      ['POST', '/api/vault/check-in'],
      ['POST', '/api/vault/pause'],
      ['POST', '/api/vault/resume'],
    ];
    for (const [method, path, body] of attempts) {
      const r = await t.call(method, path, body);
      expect(r.status, `${method} ${path}`).toBe(409);
      expect(r.body.error).toMatch(/released/i);
    }
    expect(JSON.stringify(t.store.snapshot())).toBe(before);
    expect(keep.keepsakeHalf).toBeTruthy();
  });
});
