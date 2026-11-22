import { describe, expect, it } from 'vitest';
import type { Vault } from '../../src/core/types';
import { MachineClock } from '../../src/server/adapters/clocks';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { StoreConflictError } from '../../src/server/ports';
import { HttpError, MAX_SAVE_ATTEMPTS, SwitchService } from '../../src/server/service';
import { T0 } from './helpers';

/** Throws StoreConflictError on the first `conflicts` saves of an existing vault (not on creation). */
class ConflictingStore extends MemoryStore {
  armed = false;
  attempts = 0;
  constructor(public conflicts: number) {
    super();
  }
  override async put(vault: Vault): Promise<void> {
    if (this.armed && this.attempts++ < this.conflicts) throw new StoreConflictError();
    return super.put(vault);
  }
}

async function setup(conflicts: number) {
  const clock = new MachineClock(() => T0);
  const store = new ConflictingStore(conflicts);
  const mailer = new OutboxMailer(clock);
  const service = new SwitchService({ store, mailer, clock, baseUrl: 'http://switch.test' });
  const { vault } = await service.createVault({ author: { name: 'Mara Whitlock', email: 'mara@example.com' } });
  store.armed = true;
  return { service, store, mailer, id: vault.id };
}

const silas = { name: 'Silas Crane', email: 'silas@example.com' };

describe('SwitchService save conflicts', () => {
  it('retries once and the change wins, sending its mail once (AWS Req 4.1)', async () => {
    const { service, store, mailer, id } = await setup(1);
    const view = await service.addWitness(id, silas);
    expect(view.witnesses).toHaveLength(1);
    expect(store.attempts).toBe(2);
    expect(mailer.list()).toHaveLength(1);
  });

  it('re-applies the change to a fresh read, so it is not added twice (AWS Req 4.1)', async () => {
    const { service, id } = await setup(2);
    await service.addWitness(id, silas);
    expect((await service.view(id)).witnesses).toHaveLength(1);
  });

  it('answers 409 after the third conflict and keeps the limit at 3 (AWS Req 4.2)', async () => {
    const { service, store, id } = await setup(Infinity);
    expect(MAX_SAVE_ATTEMPTS).toBe(3);
    const err = await service.addWitness(id, silas).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect((err as HttpError).message).toMatch(/try again/i);
    expect(store.attempts).toBe(3);
  });

  it('sends none of the emails of a discarded attempt (AWS Req 4.3)', async () => {
    const { service, mailer, id } = await setup(Infinity);
    await service.addWitness(id, silas).catch(() => undefined);
    expect(mailer.list()).toEqual([]);
  });

  it('does not change a store that never conflicts: one save, errors pass through (AWS Req 4.4)', async () => {
    const { service, store, id } = await setup(0);
    await service.addWitness(id, silas);
    expect(store.attempts).toBe(1);
    const err = await service.addWitness(id, silas).then(() => null, (e: unknown) => e);
    expect(err).not.toBeInstanceOf(HttpError);
    expect(store.attempts).toBe(1);
  });
});
