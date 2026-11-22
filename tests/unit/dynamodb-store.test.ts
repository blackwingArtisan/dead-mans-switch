import { describe, expect, it } from 'vitest';
import { newVault } from '../../src/core/vault';
import { DEFAULT_SETTINGS } from '../../src/core/types';
import { DynamoDBStore, MAX_VAULT_BYTES } from '../../src/server/adapters/dynamodb-store';
import { StoreConflictError } from '../../src/server/ports';
import { FakeDynamo } from './fake-dynamo';
import { T0 } from './helpers';

const TABLE = 'last-candle-test';
const vault = (id: string) =>
  newVault({ id, ownerTokenHash: `owner-${id}`, author: { name: 'Mara Whitlock', email: 'mara@example.com' }, settings: DEFAULT_SETTINGS, now: T0 });
const witness = (id: string, tokenHash: string | null) => ({
  id,
  name: 'Silas Ward',
  email: 'silas@example.com',
  tokenHash,
  response: 'pending' as const,
  respondedAt: null,
  addedAt: T0,
});
const versionOf = (db: FakeDynamo, id: string) => db.items.get(`vault#${id}`)?.version;

describe('DynamoDBStore reads (AWS Req 1)', () => {
  it('returns null for an unknown id and the vault for a known one (1.2, 1.3)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    expect(await store.get('nope')).toBeNull();
    await store.put(vault('v1'));
    expect((await store.get('v1'))?.author.name).toBe('Mara Whitlock');
  });

  it('keeps one item per vault with a version, and the vault JSON in data (1.1)', async () => {
    const db = new FakeDynamo();
    await new DynamoDBStore(db, TABLE).put(vault('v1'));
    const item = db.items.get('vault#v1')!;
    expect(item).toMatchObject({ kind: 'vault', version: 1 });
    expect(JSON.parse(String(item.data)).id).toBe('v1');
  });

  it('lists every vault across scan pages and skips token index items (1.4)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    for (const id of ['a', 'b', 'c', 'd', 'e']) await store.put(vault(id));
    expect(db.items.size).toBeGreaterThan(5); // owner index items exist too
    expect((await store.listIds()).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(db.calls.scan).toBeGreaterThan(1);
  });

  it('refuses a vault over the item size limit and writes nothing (1.5)', async () => {
    const db = new FakeDynamo();
    const v = vault('big');
    v.history.push({ at: T0, kind: 'settings', note: 'x'.repeat(MAX_VAULT_BYTES) });
    await expect(new DynamoDBStore(db, TABLE).put(v)).rejects.toThrow(/400 KB/);
    expect(db.calls.transactWrite).toBe(0);
  });

  it('puts no vault content or token in its error messages (1.6)', async () => {
    const db = new FakeDynamo();
    const v = vault('v1');
    await new DynamoDBStore(db, TABLE).put(v);
    const err = await new DynamoDBStore(db, TABLE).put(v).catch((e: Error) => e);
    expect(err).toBeInstanceOf(StoreConflictError);
    expect((err as Error).message).not.toMatch(/owner-v1|Mara|mara@/);
  });
});

describe('DynamoDBStore versioned writes (AWS Req 2)', () => {
  it('creates at version 1, then increments by one per save (2.1, 2.2, 2.6)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    const v = vault('v1');
    await store.put(v);
    expect(versionOf(db, 'v1')).toBe(1);
    const got = (await store.get('v1'))!;
    await store.put(got);
    expect(versionOf(db, 'v1')).toBe(2);
    await store.put(got); // no re-read needed: the version is remembered
    expect(versionOf(db, 'v1')).toBe(3);
  });

  it('refuses to create over an existing vault it has not read (2.2, 2.4)', async () => {
    const db = new FakeDynamo();
    await new DynamoDBStore(db, TABLE).put(vault('v1'));
    await expect(new DynamoDBStore(db, TABLE).put(vault('v1'))).rejects.toBeInstanceOf(StoreConflictError);
    expect(versionOf(db, 'v1')).toBe(1);
  });

  it('two writers race: exactly one wins and the table holds the winner (2.3, 2.4)', async () => {
    const db = new FakeDynamo();
    await new DynamoDBStore(db, TABLE).put(vault('v1'));

    // Two Lambda containers, each with its own store, both read version 1 before either writes.
    let arrived = 0;
    let release!: () => void;
    const both = new Promise<void>((r) => (release = r));
    db.beforeGet = async () => {
      if (++arrived >= 2) release();
      await both;
    };
    const a = new DynamoDBStore(db, TABLE);
    const b = new DynamoDBStore(db, TABLE);
    const [va, vb] = await Promise.all([a.get('v1'), b.get('v1')]);
    db.beforeGet = null;
    expect(versionOf(db, 'v1')).toBe(1);

    va!.history.push({ at: T0, kind: 'settings', note: 'writer A' });
    vb!.history.push({ at: T0, kind: 'settings', note: 'writer B' });
    const results = await Promise.allSettled([a.put(va!), b.put(vb!)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(StoreConflictError);
    expect(lost.reason.message).toMatch(/try again/i);

    const stored = JSON.parse(String(db.items.get('vault#v1')!.data));
    const winner = results[0]!.status === 'fulfilled' ? 'writer A' : 'writer B';
    const notes = stored.history.map((h: { note: string }) => h.note);
    expect(notes).toContain(winner);
    expect(notes).not.toContain(winner === 'writer A' ? 'writer B' : 'writer A');
    expect(versionOf(db, 'v1')).toBe(2);
  });

  it('a retry after a conflict re-reads and then succeeds (2.5, 2.8)', async () => {
    const db = new FakeDynamo();
    const a = new DynamoDBStore(db, TABLE);
    const b = new DynamoDBStore(db, TABLE);
    await a.put(vault('v1'));
    const va = (await a.get('v1'))!;
    const vb = (await b.get('v1'))!;
    await a.put(va);
    await expect(b.put(vb)).rejects.toBeInstanceOf(StoreConflictError);
    // The remembered version was dropped, so a blind save cannot overwrite.
    await expect(b.put(vb)).rejects.toBeInstanceOf(StoreConflictError);

    const fresh = (await b.get('v1'))!;
    fresh.history.push({ at: T0, kind: 'settings', note: 'retried' });
    await b.put(fresh);
    expect(versionOf(db, 'v1')).toBe(3);
    expect((await a.get('v1'))?.history.at(-1)?.note).toBe('retried');
  });

  it('rethrows an error that is not a conflict unchanged (2.7)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    const boom = Object.assign(new Error('Throughput exceeded'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'ThrottlingError' }],
    });
    db.failNext = { method: 'transactWrite', error: boom };
    await expect(store.put(vault('v1'))).rejects.toBe(boom);
    const other = new Error('network');
    db.failNext = { method: 'transactWrite', error: other };
    await expect(store.put(vault('v1'))).rejects.toBe(other);
  });

  it('treats a clash with another transaction as a conflict (2.4)', async () => {
    const db = new FakeDynamo();
    db.failNext = {
      method: 'transactWrite',
      error: Object.assign(new Error('x'), { name: 'TransactionCanceledException', CancellationReasons: [{ Code: 'TransactionConflict' }] }),
    };
    await expect(new DynamoDBStore(db, TABLE).put(vault('v1'))).rejects.toBeInstanceOf(StoreConflictError);
  });
});

describe('DynamoDBStore token index (AWS Req 3)', () => {
  it('writes the vault and every token in one transaction of at most 100 actions (3.1, 3.2)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    const v = vault('v1');
    v.witnesses.push(witness('w1', 'wit-1'));
    await store.put(v);
    expect(db.calls.transactWrite).toBe(1);
    expect(db.transactSizes[0]).toBe(3); // vault + owner + witness
    expect(Math.max(...db.transactSizes)).toBeLessThanOrEqual(100);
    expect(await store.findByToken('owner', 'owner-v1')).toBe('v1');
    expect(await store.findByToken('witness', 'wit-1')).toBe('v1');
    expect(await store.findByToken('witness', 'unknown')).toBeNull();
    expect(await store.findByToken('open', 'wit-1')).toBeNull();
  });

  it('deletes an index item the vault no longer holds, after the write (3.4)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    const v = vault('v1');
    v.witnesses.push(witness('w1', 'wit-1'));
    await store.put(v);
    const got = (await store.get('v1'))!;
    got.witnesses[0]!.tokenHash = 'wit-2';
    await store.put(got);
    expect(await store.findByToken('witness', 'wit-1')).toBeNull();
    expect(await store.findByToken('witness', 'wit-2')).toBe('v1');
  });

  it('still reports success when a stale index delete fails (3.5)', async () => {
    const db = new FakeDynamo();
    const store = new DynamoDBStore(db, TABLE);
    const v = vault('v1');
    v.witnesses.push(witness('w1', 'wit-1'));
    await store.put(v);
    const got = (await store.get('v1'))!;
    got.witnesses[0]!.tokenHash = null;
    db.failNext = { method: 'delete', error: new Error('throttled') };
    await expect(store.put(got)).resolves.toBeUndefined();
    expect(versionOf(db, 'v1')).toBe(2);
  });

  it('writes no index item when the condition fails (3.6)', async () => {
    const db = new FakeDynamo();
    const a = new DynamoDBStore(db, TABLE);
    const b = new DynamoDBStore(db, TABLE);
    await a.put(vault('v1'));
    const va = (await a.get('v1'))!;
    const vb = (await b.get('v1'))!;
    await a.put(va);
    vb.witnesses.push(witness('w1', 'wit-loser'));
    await expect(b.put(vb)).rejects.toBeInstanceOf(StoreConflictError);
    expect(await b.findByToken('witness', 'wit-loser')).toBeNull();
  });
});
