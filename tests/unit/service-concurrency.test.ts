import { describe, expect, it } from 'vitest';
import { sealLetter } from '../../src/core/crypto';
import type { Vault } from '../../src/core/types';
import { MachineClock } from '../../src/server/adapters/clocks';
import { OutboxMailer } from '../../src/server/adapters/mailers';
import { MemoryStore } from '../../src/server/adapters/memory-store';
import { SwitchService } from '../../src/server/service';
import { T0 } from './helpers';

/** A store that answers reads a moment late, the way a remote store or a busy machine would. */
class SlowStore extends MemoryStore {
  override async get(id: string): Promise<Vault | null> {
    const v = await super.get(id);
    await new Promise((r) => setTimeout(r, 5));
    return v;
  }
}

async function letter(id: string, name: string) {
  const { sealed, keepsakeHalf } = await sealLetter(id, { title: 'Sealed words', html: '<p>The garden key is in the blue jar.</p>', from: 'Mara' });
  return { id, recipient: { name, email: `${name.split(' ')[0]!.toLowerCase()}@example.com` }, custody: 'vault', sealed, keepsakeHalf };
}

describe('changes to one vault', () => {
  it('never lose a letter when the background tick runs while letters are added', async () => {
    const clock = new MachineClock(() => T0);
    const service = new SwitchService({ store: new SlowStore(), mailer: new OutboxMailer(clock), clock, baseUrl: 'http://switch.test' });
    const { vault } = await service.createVault({ author: { name: 'Mara Whitlock', email: 'mara@example.com' } });
    const [theo, june] = await Promise.all([letter('letter-theo-0001', 'Theo Whitlock'), letter('letter-june-0001', 'June Okafor')]);

    await Promise.all([service.tickAll(), service.addLetter(vault.id, theo), service.tickAll(), service.addLetter(vault.id, june), service.tickAll()]);

    const after = await service.view(vault.id);
    expect(after.letters.map((l) => l.recipient.name).sort()).toEqual(['June Okafor', 'Theo Whitlock']);
  });

  it('keep going after a change fails', async () => {
    const clock = new MachineClock(() => T0);
    const service = new SwitchService({ store: new SlowStore(), mailer: new OutboxMailer(clock), clock, baseUrl: 'http://switch.test' });
    const { vault } = await service.createVault({ author: { name: 'Mara Whitlock', email: 'mara@example.com' } });
    const results = await Promise.allSettled([
      service.addLetter(vault.id, { id: 'bad' }),
      service.addWitness(vault.id, { name: 'Silas Crane', email: 'silas@example.com' }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect((await service.view(vault.id)).witnesses).toHaveLength(1);
  });
});
