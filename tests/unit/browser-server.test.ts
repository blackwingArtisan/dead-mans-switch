import { describe, expect, it } from 'vitest';
import { openLetter, sealLetter } from '../../src/core/crypto';
import { createBrowserServer, STATIC_DEMO_KEY, type KeyValueStorage } from '../../src/web/lib/browser-server';
import { T0 } from './helpers';

const BASE = 'https://switch.example.com';

function fakeStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** One browser tab: its own server instance over the shared storage. */
function tab(storage: KeyValueStorage | null, now = () => T0) {
  const server = createBrowserServer({ storage, baseUrl: BASE, now });
  let owner = '';
  const call = async (method: string, path: string, body?: unknown, auth = true) => {
    const res = await server.handle(
      new Request(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(auth && owner ? { Authorization: `Bearer ${owner}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: res.status, body: (await res.json()) as any };
  };
  return { server, call, setOwner: (t: string) => (owner = t) };
}

const outboxOf = async (t: ReturnType<typeof tab>) => (await t.call('GET', '/api/dev/outbox')).body.messages as any[];
const tokenIn = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).pathname.split('/').pop()!;

describe('static demo: the API in the browser', () => {
  it('reports the time machine, so the demo tools and the story show', async () => {
    const health = await tab(fakeStorage()).call('GET', '/api/health');
    expect(health.body).toMatchObject({ ok: true, dev: true });
  });

  it('runs the whole lifecycle across tabs, with state kept in storage', async () => {
    const storage = fakeStorage();
    const author = tab(storage);
    const created = await author.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' } }, false);
    expect(created.status).toBe(201);
    author.setOwner(created.body.ownerToken);
    expect((await author.call('POST', '/api/vault/witnesses', { name: 'Silas Crane', email: 'silas@example.com' })).status).toBe(201);
    const { sealed, keepsakeHalf } = await sealLetter('letter-june-01', { title: 'For June', html: '<p>The key is in the blue jar.</p>', from: 'Mara' });
    const recipient = { name: 'June Okafor', email: 'june@example.com' };
    expect((await author.call('POST', '/api/vault/letters', { id: 'letter-june-01', recipient, custody: 'vault', sealed, keepsakeHalf })).status).toBe(201);
    expect(storage.data.has(STATIC_DEMO_KEY)).toBe(true);

    // The time machine moves forward and the clock offset survives a new tab.
    const travel = await author.call('POST', '/api/dev/clock', { days: 38 });
    expect(travel.body.tick.emails).toBeGreaterThan(0);
    const later = tab(storage);
    expect((await later.call('GET', '/api/dev/clock')).body.offsetMs).toBe(38 * 86_400_000);

    // A witness in another tab confirms from the link in the outbox.
    const ask = (await outboxOf(later)).find((m) => m.kind === 'witness-ask');
    expect(ask.text).toContain(`${BASE}/`);
    const witness = tab(storage);
    expect((await witness.call('POST', `/api/witness/${tokenIn(ask.text)}`, { response: 'confirm' }, false)).body.state).toBe('released');

    // The author's tab sees the release, and the recipient opens the letter once.
    expect((await author.call('GET', '/api/vault')).body.state).toBe('released');
    const release = (await outboxOf(author)).find((m) => m.kind === 'release');
    const reader = tab(storage);
    const broken = await reader.call('POST', `/api/open/${tokenIn(release.text)}/break`, undefined, false);
    expect(broken.status).toBe(200);
    const fragment = new URL(release.text.match(/https?:\/\/\S+/)![0]).hash.replace(/^#k=/, '');
    expect((await openLetter('letter-june-01', broken.body, fragment)).html).toContain('blue jar');
    expect((await reader.call('POST', `/api/open/${tokenIn(release.text)}/break`, undefined, false)).status).toBe(410);
  });

  it('delivers due mail on the tick, like the server cron', async () => {
    let now = T0;
    const storage = fakeStorage();
    const author = tab(storage, () => now);
    await author.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' }, settings: { cadenceDays: 10 } }, false);
    now = T0 + 11 * 86_400_000;
    const tick = await author.server.tick();
    expect(tick.emails).toBeGreaterThan(0);
    expect((await outboxOf(author)).map((m) => m.kind)).toContain('grace');
  });

  it('serialises concurrent requests so none overwrites another', async () => {
    const storage = fakeStorage();
    const t = tab(storage);
    const created = await t.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' } }, false);
    t.setOwner(created.body.ownerToken);
    const names = ['Silas Crane', 'Ada Penhallow', 'Rowan Ashby'];
    await Promise.all(names.map((name, i) => t.call('POST', '/api/vault/witnesses', { name, email: `w${i}@example.com` })));
    expect((await t.call('GET', '/api/vault')).body.witnesses).toHaveLength(3);
  });

  it('keeps working in memory when storage is unavailable', async () => {
    const t = tab(null);
    const created = await t.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' } }, false);
    t.setOwner(created.body.ownerToken);
    expect((await t.call('GET', '/api/vault')).status).toBe(200);
  });

  it('wipes everything on demo reset', async () => {
    const storage = fakeStorage();
    const t = tab(storage);
    await t.call('POST', '/api/vaults', { author: { name: 'Mara Whitlock', email: 'mara@example.com' } }, false);
    await t.call('POST', '/api/dev/clock', { days: 5 });
    await t.call('POST', '/api/dev/reset', {});
    const state = JSON.parse(storage.data.get(STATIC_DEMO_KEY)!);
    expect(state).toMatchObject({ vaults: { vaults: [] }, outbox: [], offsetMs: 0 });
  });
});
