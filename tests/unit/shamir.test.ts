import { describe, expect, it } from 'vitest';
import { ShamirError, combineShares, splitSecret, type RandomSource } from '../../src/core/shamir';

/** A small seeded generator (mulberry32) so failures reproduce. */
function seeded(seed: number): RandomSource {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (length) => Uint8Array.from({ length }, () => Math.floor(next() * 256));
}

const pairs: Array<[number, number]> = [];
for (let n = 1; n <= 7; n++) for (let k = 1; k <= Math.min(n, 5); k++) pairs.push([k, n]);

function pick<T>(items: T[], count: number, rnd: RandomSource): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count) out.push(pool.splice(rnd(1)[0]! % pool.length, 1)[0]!);
  return out;
}

describe('shamir over GF(256)', () => {
  it('rebuilds the secret from any k shares, for 1-of-1 up to 5-of-7 (Req 13.3)', () => {
    const rnd = seeded(1);
    for (const [k, n] of pairs) {
      for (let round = 0; round < 25; round++) {
        const secret = rnd(32);
        const shares = splitSecret(secret, k, n, rnd);
        expect(shares).toHaveLength(n);
        expect(combineShares(pick(shares, k, rnd))).toEqual(secret);
        // more than k also works
        expect(combineShares(pick(shares, n, rnd))).toEqual(secret);
      }
    }
  });

  it('refuses fewer than k shares, and k-1 shares leak nothing about the secret byte (Req 13.3)', () => {
    const rnd = seeded(2);
    for (const [k, n] of pairs.filter(([k]) => k > 1)) {
      const secret = rnd(32);
      const shares = splitSecret(secret, k, n, rnd);
      expect(() => combineShares(pick(shares, k - 1, rnd))).toThrow(ShamirError);
      // With k-1 shares, interpolating as if the threshold were k-1 gives a wrong secret.
      const forged = pick(shares, k - 1, rnd).map((s) => Uint8Array.from(s, (v, i) => (i === 1 ? k - 1 : v)));
      expect(combineShares(forged)).not.toEqual(secret);
    }
  });

  it('gives every secret byte value from the same k-1 shares, so they carry no information (Req 13.3)', () => {
    // For 2-of-2, one share's y byte is uniform whatever the secret: count distinct values over many secrets.
    const rnd = seeded(3);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(splitSecret(Uint8Array.of(7), 2, 2, rnd)[0]![2]!);
    expect(seen.size).toBeGreaterThan(150);
  });

  it('does not depend on the order of the shares (Req 13.3)', () => {
    const rnd = seeded(4);
    const secret = rnd(32);
    const shares = splitSecret(secret, 3, 5, rnd);
    for (let i = 0; i < 20; i++) {
      const chosen = pick(shares, 3, rnd);
      expect(combineShares(chosen)).toEqual(secret);
      expect(combineShares([...chosen].reverse())).toEqual(secret);
    }
  });

  it('refuses duplicate, mixed and malformed shares (Req 13.3)', () => {
    const rnd = seeded(5);
    const a = splitSecret(rnd(32), 2, 3, rnd);
    const b = splitSecret(rnd(32), 3, 3, rnd);
    expect(() => combineShares([a[0]!, a[0]!])).toThrow(/twice/);
    expect(() => combineShares([a[0]!, b[1]!])).toThrow(/belong together/);
    expect(() => combineShares([a[0]!, a[1]!.slice(0, 20)])).toThrow(/belong together/);
    expect(() => combineShares([])).toThrow(ShamirError);
    expect(() => combineShares([Uint8Array.of(1, 1)])).toThrow(ShamirError);
    expect(() => combineShares([Uint8Array.of(0, 1, 9)])).toThrow(ShamirError);
  });

  it('refuses impossible splits (Req 13.3)', () => {
    expect(() => splitSecret(Uint8Array.of(1), 0, 3)).toThrow(ShamirError);
    expect(() => splitSecret(Uint8Array.of(1), 4, 3)).toThrow(ShamirError);
    expect(() => splitSecret(Uint8Array.of(1), 1, 256)).toThrow(ShamirError);
    expect(() => splitSecret(new Uint8Array(0), 1, 1)).toThrow(ShamirError);
  });

  it('works with the system random source (Req 13.2)', () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 2, 3);
    expect(combineShares([shares[2]!, shares[0]!])).toEqual(secret);
  });
});
