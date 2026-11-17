import type { MachineContext } from '../../src/core/machine';
import { DEFAULT_SETTINGS, type Letter, type Settings, type Vault } from '../../src/core/types';
import { newVault } from '../../src/core/vault';

export const T0 = Date.UTC(2026, 9, 31, 12, 0, 0); // 31 Oct 2026, noon UTC

export function ctxAt(now: number): MachineContext {
  let n = 0;
  return { now, mint: () => ({ token: `tok-${++n}`, hash: `hash-${now}-${n}` }) };
}

export function makeVault(settings: Partial<Settings> = {}, witnesses = 2, letters = 1): Vault {
  const v = newVault({
    id: 'vault-1',
    ownerTokenHash: 'owner-hash',
    author: { name: 'Mara Whitlock', email: 'mara@example.com' },
    settings: { ...DEFAULT_SETTINGS, ...settings },
    now: T0,
  });
  const people = [
    { name: 'Silas Crane', email: 'silas@example.com' },
    { name: 'Ada Penhallow', email: 'ada@example.com' },
    { name: 'Rowan Ashby', email: 'rowan@example.com' },
  ];
  for (let i = 0; i < witnesses; i++) {
    v.witnesses.push({ id: `w${i + 1}`, ...people[i]!, tokenHash: null, response: 'pending', respondedAt: null, addedAt: T0 });
  }
  for (let i = 0; i < letters; i++) {
    const letter: Letter = {
      id: `letter-${i + 1}`,
      recipient: { name: i === 0 ? 'Theo Whitlock' : 'June Okafor', email: i === 0 ? 'theo@example.com' : 'june@example.com' },
      custody: i === 0 ? 'keepsake' : 'vault',
      sealedAt: T0,
      sealed: { ciphertext: 'Y3Q', iv: 'aXY', vaultHalf: 'Yg', keepsakeTag: 'dGFn', ...(i === 0 ? {} : { keepsakeHalf: 'YQ' }) },
      openTokenHash: null,
      releasedAt: null,
      openedAt: null,
    };
    v.letters.push(letter);
  }
  return v;
}
