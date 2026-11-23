import { beforeEach, describe, expect, it } from 'vitest';
import { openSeanceLetter, sealLetter } from '../../src/core/crypto';
import { createApp } from '../../src/server/app';
import { MachineClock } from '../../src/server/adapters/clocks';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { T0 } from './helpers';

const PEOPLE = [
  { name: 'Silas Crane', email: 'silas@example.com' },
  { name: 'Ada Penhallow', email: 'ada@example.com' },
  { name: 'Rowan Ashby', email: 'rowan@example.com' },
];
const THEO = { name: 'Theo Whitlock', email: 'theo@example.com' };

function setup() {
  const clock = new MachineClock(() => T0);
  const store = new MemoryStore();
  const outbox = new OutboxMailer(clock);
  const { app } = createApp({ store, mailer: outbox, clock, baseUrl: 'http://switch.test', dev: { clock, outbox, resetStore: () => store.clear() } });
  let owner = '';
  const call = async (method: string, path: string, body?: unknown, auth = true) => {
    const res = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth && owner ? { Authorization: `Bearer ${owner}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const tokenFrom = (kind: string, to: string) => {
    const msg = outbox.list().filter((m) => m.kind === kind && m.to.email === to).pop();
    if (!msg) throw new Error(`No ${kind} email to ${to}`);
    return new URL(msg.text.match(/https?:\/\/\S+/)![0]).pathname.split('/').pop()!;
  };
  return { call, outbox, store, tokenFrom, setOwner: (t: string) => (owner = t) };
}

/** A vigil with three witnesses needing two, and one séance letter sealed to them. */
async function seanceVigil(extra: Record<string, unknown> = {}) {
  const t = setup();
  const created = await t.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' }, settings: { witnessesRequired: 2, ...extra } }, false);
  t.setOwner(created.body.ownerToken);
  for (const p of PEOPLE) await t.call('POST', '/api/vault/witnesses', p);
  const id = 'Lseance0001';
  const sealed = await sealLetter(id, { title: 'Sealed words', html: '<p>The garden key is in the blue jar.</p>', from: 'Mara' }, { k: 2, n: 3 });
  const body = { id, recipient: THEO, custody: 'witnesses', sealed: sealed.sealed, seance: { k: 2, n: 3 } };
  return { t, id, sealed, body };
}

async function confirmRound(t: ReturnType<typeof setup>) {
  await t.call('POST', '/api/dev/clock', { days: 40 });
}

describe('séance seal: sealing and upload', () => {
  it('stores no vault half and no share, and exposes k of n (Req 13.2, 13.4)', async () => {
    const { t, body, sealed } = await seanceVigil();
    expect(sealed.shares).toHaveLength(3);
    expect(sealed.sealed.vaultHalf).toBe('');
    const r = await t.call('POST', '/api/vault/letters', body);
    expect(r.status).toBe(201);
    expect(r.body.letters[0].seance).toEqual({ k: 2, n: 3 });
    const vault = (await t.store.get(r.body.id))!;
    expect(vault.letters[0]!.sealed!.vaultHalf).toBe('');
    expect(JSON.stringify(vault)).not.toContain(sealed.shares![0]!);
  });

  it('refuses a vault half, a keepsake half or a share at upload (Req 13.4)', async () => {
    const { t, body, sealed } = await seanceVigil();
    const withHalf = { ...body, sealed: { ...body.sealed, vaultHalf: 'A'.repeat(43) } };
    expect((await t.call('POST', '/api/vault/letters', withHalf)).status).toBe(400);
    expect((await t.call('POST', '/api/vault/letters', { ...body, keepsakeHalf: sealed.keepsakeHalf })).status).toBe(400);
    expect((await t.call('POST', '/api/vault/letters', { ...body, shares: sealed.shares })).status).toBe(400);
  });

  it('refuses a k and n that differ from the vigil, and a letter with no witnesses (Req 13.4, 13.2)', async () => {
    const { t, body } = await seanceVigil();
    const r = await t.call('POST', '/api/vault/letters', { ...body, seance: { k: 1, n: 3 } });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/seal the letter again/);
    const bare = setup();
    const c = await bare.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' } }, false);
    bare.setOwner(c.body.ownerToken);
    const none = await bare.call('POST', '/api/vault/letters', { ...body, seance: { k: 1, n: 0 } });
    expect(none.status).toBe(400);
    expect(none.body.error).toMatch(/at least one witness/);
  });

  it('keeps other custody modes free of a seance field (Req 13.4)', async () => {
    const { t, body } = await seanceVigil();
    const r = await t.call('POST', '/api/vault/letters', { ...body, custody: 'keepsake' });
    expect(r.status).toBe(400);
  });

  it('locks the witness list and the required confirmations while a séance letter is unreleased (Req 13.14)', async () => {
    const { t, body } = await seanceVigil();
    await t.call('POST', '/api/vault/letters', body);
    expect((await t.call('PATCH', '/api/vault/settings', { witnessesRequired: 1 })).status).toBe(400);
    expect((await t.call('PATCH', '/api/vault/settings', { cadenceDays: 20 })).status).toBe(200);
    expect((await t.call('POST', '/api/vault/witnesses', { name: 'Ivy', email: 'ivy@example.com' })).status).toBe(400);
    const view = await t.call('GET', '/api/vault');
    const removed = await t.call('DELETE', `/api/vault/witnesses/${view.body.witnesses[0].id}`);
    expect(removed.status).toBe(400);
    expect(removed.body.error).toMatch(/Burn the séance letter first/);
    expect((await t.call('DELETE', `/api/vault/letters/${body.id}`)).status).toBe(200);
    expect((await t.call('PATCH', '/api/vault/settings', { witnessesRequired: 1 })).status).toBe(200);
  });
});

describe('séance seal: confirmation, veto and opening', () => {
  let ctx: Awaited<ReturnType<typeof seanceVigil>>;
  beforeEach(async () => {
    ctx = await seanceVigil();
    await ctx.t.call('POST', '/api/vault/letters', ctx.body);
    await confirmRound(ctx.t);
  });

  const confirm = (i: number, withShare: boolean) => {
    const token = ctx.t.tokenFrom('witness-ask', PEOPLE[i]!.email);
    return ctx.t.call('POST', `/api/witness/${token}`, { response: 'confirm', ...(withShare ? { shares: { [ctx.id]: ctx.sealed.shares![i]! } } : {}) }, false);
  };

  it('one confirmation is not enough, and the second releases a letter only the recipient can open (Req 13.6, 13.10, 13.12)', async () => {
    expect((await confirm(0, true)).body.state).toBe('confirm');
    expect((await confirm(2, true)).body.state).toBe('released');
    const open = ctx.t.tokenFrom('release', THEO.email);
    const info = await ctx.t.call('GET', `/api/open/${open}`, undefined, false);
    expect(info.body.seance).toEqual({ k: 2, n: 3 });
    const handed = await ctx.t.call('POST', `/api/open/${open}/break`, {}, false);
    expect(handed.status).toBe(200);
    expect(handed.body.vaultHalf).toBeUndefined();
    expect(handed.body.shares).toHaveLength(2);
    const content = await openSeanceLetter(ctx.id, handed.body, ctx.sealed.keepsakeHalf, handed.body.shares, 2);
    expect(content.html).toContain('blue jar');
    const again = await ctx.t.call('POST', `/api/open/${open}/break`, {}, false);
    expect(again.status).toBe(410);
    const vault = (await ctx.t.store.listIds().then((ids) => ctx.t.store.get(ids[0]!)))!;
    expect(vault.letters[0]!.shares).toBeUndefined();
  });

  it('a veto after one confirmation discards the shares and keeps the letter sealed (Req 13.9)', async () => {
    await confirm(0, true);
    const ada = ctx.t.tokenFrom('witness-ask', PEOPLE[1]!.email);
    const veto = await ctx.t.call('POST', `/api/witness/${ada}`, { response: 'deny' }, false);
    expect(veto.body.state).toBe('grace');
    const vault = (await ctx.t.store.listIds().then((ids) => ctx.t.store.get(ids[0]!)))!;
    expect(vault.letters[0]!.shares).toBeUndefined();
    expect(vault.letters[0]!.sealed).not.toBeNull();
    expect(vault.state).toBe('grace');
  });

  it('a check-in discards the shares (Req 13.9)', async () => {
    await confirm(0, true);
    await ctx.t.call('POST', '/api/vault/check-in', {});
    const vault = (await ctx.t.store.listIds().then((ids) => ctx.t.store.get(ids[0]!)))!;
    expect(vault.letters[0]!.shares).toBeUndefined();
  });

  it('a confirmation without a share still counts, but the break is refused and the link stays unspent (Req 13.7, 13.11)', async () => {
    await confirm(0, true);
    expect((await confirm(1, false)).body.state).toBe('released');
    const open = ctx.t.tokenFrom('release', THEO.email);
    const refused = await ctx.t.call('POST', `/api/open/${open}/break`, {}, false);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/needs 2 witnesses/);
    const info = await ctx.t.call('GET', `/api/open/${open}`, undefined, false);
    expect(info.body.opened).toBe(false);
  });

  it('refuses malformed shares, shares for another letter and a share with the wrong k (Req 13.8)', async () => {
    const token = ctx.t.tokenFrom('witness-ask', PEOPLE[0]!.email);
    const post = (shares: unknown) => ctx.t.call('POST', `/api/witness/${token}`, { response: 'confirm', shares }, false);
    expect((await post({ [ctx.id]: 'nope' })).status).toBe(400);
    expect((await post({ Lunknown0001: ctx.sealed.shares![0]! })).status).toBe(400);
    const other = await sealLetter('Lother00001', { title: '', html: '<p>x</p>', from: '' }, { k: 3, n: 3 });
    expect((await post({ [ctx.id]: other.shares![0]! })).status).toBe(400);
    expect((await post([1])).status).toBe(400);
    // Nothing changed: the witness can still answer.
    expect((await confirm(0, true)).body.response).toBe('confirmed');
  });

  it('never returns shares from the vigil view or the witness page (Req 13.5, 13.15)', async () => {
    await confirm(0, true);
    const view = JSON.stringify((await ctx.t.call('GET', '/api/vault')).body);
    expect(view).not.toContain(ctx.sealed.shares![0]!);
    const info = await ctx.t.call('GET', `/api/witness/${ctx.t.tokenFrom('witness-ask', PEOPLE[1]!.email)}`, undefined, false);
    expect(JSON.stringify(info.body)).not.toContain(ctx.sealed.shares![0]!);
    expect(info.body.seanceLetters).toEqual([{ id: ctx.id, k: 2 }]);
  });
});

describe('séance seal: opening in the browser', () => {
  it('fewer than k shares, wrong shares and a wrong keepsake fail with plain messages (Req 13.3, 13.11, 13.12)', async () => {
    const id = 'Lseance0002';
    const s = await sealLetter(id, { title: 't', html: '<p>hi</p>', from: 'm' }, { k: 3, n: 5 });
    const open = (shares: string[], a = s.keepsakeHalf) => openSeanceLetter(id, s.sealed, a, shares, 3);
    expect((await open([s.shares![0]!, s.shares![4]!, s.shares![2]!])).html).toBe('<p>hi</p>');
    await expect(open(s.shares!.slice(0, 2))).rejects.toThrow(/needs 3 witnesses/);
    await expect(open([s.shares![0]!, s.shares![0]!, s.shares![1]!])).rejects.toThrow(/do not fit/);
    const other = await sealLetter(id, { title: 't', html: '<p>no</p>', from: 'm' }, { k: 3, n: 5 });
    await expect(open([other.shares![0]!, other.shares![1]!, other.shares![2]!])).rejects.toThrow(/seal will not break/);
    await expect(open(s.shares!.slice(0, 3), other.keepsakeHalf)).rejects.toThrow(/seal will not break/);
    await expect(open(['!!!', 'x', 'y'])).rejects.toThrow(/not in a form/);
  });
});
