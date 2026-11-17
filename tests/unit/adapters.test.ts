import { afterEach, describe, expect, it, vi } from 'vitest';
import { sealLetter } from '../../src/core/crypto';
import { newVault } from '../../src/core/vault';
import { DEFAULT_SETTINGS } from '../../src/core/types';
import { KvStore, type KvLike } from '../../src/server/adapters/kv-store';
import { ResendMailer } from '../../src/server/adapters/mailers';
import { renderEmail } from '../../src/server/emails';
import worker, { type Env } from '../../src/worker/index';
import { T0 } from './helpers';

/** A Map-backed stand-in for a Workers KV namespace. */
class FakeKv implements KvLike {
  data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.data.set(key, value);
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async list({ prefix, cursor }: { prefix: string; cursor?: string }) {
    const keys = [...this.data.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + 2); // tiny pages to exercise the cursor loop
    const done = start + 2 >= keys.length;
    return { keys: page.map((name) => ({ name })), list_complete: done, cursor: done ? undefined : String(start + 2) };
  }
}

const vault = (id: string) =>
  newVault({ id, ownerTokenHash: `owner-${id}`, author: { name: 'Mara Whitlock', email: 'mara@example.com' }, settings: DEFAULT_SETTINGS, now: T0 });

describe('KvStore', () => {
  it('stores vaults and keeps the token index in step', async () => {
    const kv = new FakeKv();
    const store = new KvStore(kv);
    const v = vault('v1');
    v.witnesses.push({ id: 'w1', name: 'Silas', email: 'silas@example.com', tokenHash: 'wit-1', response: 'pending', respondedAt: null, addedAt: T0 });
    await store.put(v);
    expect(await store.findByToken('owner', 'owner-v1')).toBe('v1');
    expect(await store.findByToken('witness', 'wit-1')).toBe('v1');

    v.witnesses[0]!.tokenHash = 'wit-2';
    await store.put(v);
    expect(await store.findByToken('witness', 'wit-1')).toBeNull();
    expect(await store.findByToken('witness', 'wit-2')).toBe('v1');
    expect((await store.get('v1'))?.witnesses[0]?.tokenHash).toBe('wit-2');
  });

  it('lists every vault across pages', async () => {
    const store = new KvStore(new FakeKv());
    for (const id of ['a', 'b', 'c', 'd', 'e']) await store.put(vault(id));
    expect((await store.listIds()).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('ResendMailer', () => {
  it('posts the rendered email to the Resend API', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"id":"x"}', { status: 200 });
    }) as unknown as typeof fetch;
    const mailer = new ResendMailer('re_test_key', "Dead Man's Switch <switch@example.com>", fakeFetch);
    await mailer.send(renderEmail({ vaultId: 'v1', template: 'reminder', to: { name: 'Mara', email: 'mara@example.com' }, dueAt: T0 }, 'https://switch.example.com'));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.to).toEqual(['Mara <mara@example.com>']);
    expect(body.subject).toMatch(/check in/);
  });

  it('throws when Resend refuses, so the service can log the failure', async () => {
    const fakeFetch = (async () => new Response('nope', { status: 422 })) as unknown as typeof fetch;
    const mailer = new ResendMailer('re_test_key', 'x@example.com', fakeFetch);
    await expect(
      mailer.send({ to: { name: 'A', email: 'a@example.com' }, subject: 's', text: 't', html: 'h', kind: 'reminder', vaultId: 'v' }),
    ).rejects.toThrow(/HTTP 422/);
  });

  it('refuses to start without a key', () => {
    expect(() => new ResendMailer('', 'x@example.com')).toThrow(/API key/);
  });
});

describe('email templates', () => {
  it('puts the keepsake half in the fragment only for vault custody, and escapes HTML', async () => {
    const base = { vaultId: 'v', template: 'release' as const, to: { name: 'Theo <b>', email: 'theo@example.com' }, authorName: 'Mara', letterId: 'L1', openToken: 'tok' };
    const keepsake = renderEmail(base, 'https://switch.example.com/');
    expect(keepsake.text).toContain('https://switch.example.com/open/tok\n');
    expect(keepsake.text).not.toContain('#k=');
    expect(keepsake.html).toContain('Theo &lt;b&gt;');
    const vaulted = renderEmail({ ...base, keepsakeHalf: 'HALF' }, 'https://switch.example.com');
    expect(vaulted.text).toContain('/open/tok#k=HALF');
  });
});

describe('Cloudflare Worker entry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves the API from KV, falls back to static assets, and ticks on the cron', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)).subject);
      return new Response('{}', { status: 200 });
    });
    const kv = new FakeKv();
    const env = {
      DMS_KV: kv,
      ASSETS: { fetch: async () => new Response('<!doctype html>static', { status: 200 }) },
      RESEND_API_KEY: 're_test_key',
      DMS_MAIL_FROM: 'switch@example.com',
      DMS_BASE_URL: 'https://switch.example.com',
    } as unknown as Env;

    const page = await worker.fetch(new Request('https://switch.example.com/write'), env);
    expect(await page.text()).toContain('static');
    expect(page.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(page.headers.get('X-Frame-Options')).toBe('DENY');

    const created = await worker.fetch(
      new Request('https://switch.example.com/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: { name: 'Mara Whitlock', email: 'mara@example.com' }, settings: { cadenceDays: 1, reminderLeadDays: 1 } }),
      }),
      env,
    );
    expect(created.status).toBe(201);
    const { ownerToken } = (await created.json()) as { ownerToken: string };
    const { sealed } = await sealLetter('letter-worker-1', { title: 't', html: '<p>hi</p>', from: 'M' });
    const added = await worker.fetch(
      new Request('https://switch.example.com/api/vault/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ id: 'letter-worker-1', recipient: { name: 'Theo', email: 'theo@example.com' }, custody: 'keepsake', sealed }),
      }),
      env,
    );
    expect(added.status).toBe(201);

    // With a one-day cadence and a one-day lead, the reminder is already due.
    const waits: Promise<unknown>[] = [];
    await worker.scheduled({} as ScheduledController, env, { waitUntil: (p: Promise<unknown>) => waits.push(p) } as unknown as ExecutionContext);
    await Promise.all(waits);
    expect(sent).toEqual(['Your candle burns low: please check in']);
  });
});
