/**
 * Shamir's secret sharing over GF(256), byte by byte. Pure, no dependency.
 *
 * A share is [x, k, y0 .. y(len-1)]: x is 1..255, k the threshold, y the polynomial values.
 * Any k shares rebuild the secret; fewer reveal nothing about it. Randomness comes from
 * `crypto.getRandomValues` unless a source is passed (tests pass a seeded one).
 */

export class ShamirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShamirError';
  }
}

// GF(256) with the AES polynomial 0x11b, generator 3.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x ^= (x << 1) ^ (x & 0x80 ? 0x11b : 0); // x * 3
    x &= 255;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);
const div = (a: number, b: number): number => (a === 0 ? 0 : EXP[LOG[a]! + 255 - LOG[b]!]!);

export type RandomSource = (length: number) => Uint8Array;

const systemRandom: RandomSource = (length) => {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
};

export function splitSecret(secret: Uint8Array, k: number, n: number, random: RandomSource = systemRandom): Uint8Array[] {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 1 || n < k || n > 255) {
    throw new ShamirError('A split needs 1 <= k <= n <= 255.');
  }
  if (secret.length === 0) throw new ShamirError('There is nothing to split.');
  // coeffs[b] holds the k-1 random coefficients for secret byte b.
  const coeffs = random(secret.length * (k - 1));
  const shares = Array.from({ length: n }, (_, i) => {
    const share = new Uint8Array(2 + secret.length);
    share[0] = i + 1;
    share[1] = k;
    return share;
  });
  for (let b = 0; b < secret.length; b++) {
    for (const share of shares) {
      const x = share[0]!;
      // Horner: ((c_{k-1} x + ... ) x + c_1) x + secret
      let y = 0;
      for (let j = k - 2; j >= 0; j--) y = mul(y, x) ^ coeffs[b * (k - 1) + j]!;
      share[2 + b] = mul(y, x) ^ secret[b]!;
    }
  }
  coeffs.fill(0);
  return shares;
}

export function combineShares(shares: Uint8Array[]): Uint8Array {
  const first = shares[0];
  if (!first || first.length < 3) throw new ShamirError('No shares were given.');
  const k = first[1]!;
  const len = first.length;
  if (shares.length < k) {
    throw new ShamirError(`This needs ${k} shares and only ${shares.length} ${shares.length === 1 ? 'was' : 'were'} given.`);
  }
  const used = shares.slice(0, k);
  const seen = new Set<number>();
  for (const s of shares) {
    if (s.length !== len || s[0] === 0 || s[1] !== k) throw new ShamirError('These shares do not belong together.');
  }
  for (const s of used) {
    if (seen.has(s[0]!)) throw new ShamirError('The same share was given twice.');
    seen.add(s[0]!);
  }
  const out = new Uint8Array(len - 2);
  for (let b = 0; b < out.length; b++) {
    // Lagrange interpolation at x = 0.
    let acc = 0;
    for (let i = 0; i < k; i++) {
      let num = 1;
      let den = 1;
      for (let j = 0; j < k; j++) {
        if (i === j) continue;
        num = mul(num, used[j]![0]!);
        den = mul(den, used[i]![0]! ^ used[j]![0]!);
      }
      acc ^= mul(used[i]![2 + b]!, div(num, den));
    }
    out[b] = acc;
  }
  return out;
}
