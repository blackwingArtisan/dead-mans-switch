/**
 * Letter sealing with WebCrypto.
 *
 * Scheme ("two halves of the seal"):
 *   K  = 32 random bytes, the AES-GCM-256 content key for one letter.
 *   A  = 32 random bytes, the keepsake half, held by the recipient.
 *   B  = K xor A, the vault half, stored by the server.
 * Either half alone is uniformly random and reveals nothing about K.
 * The ciphertext is bound to the letter id with additional authenticated data,
 * so a sealed copy cannot be swapped onto another letter.
 */
import type { LetterContent, SealedLetter } from './types';
import { combineShares, splitSecret, ShamirError } from './shamir';
import { fromBase64Url, fromUtf8, randomBytes, sha256, toBase64Url, utf8, xorBytes } from './encoding';

export const KEY_BYTES = 32;
const IV_BYTES = 12;
const FORMAT = 'dms-letter-v1';

export class SealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealError';
  }
}

export interface SealResult {
  sealed: SealedLetter;
  /** base64url keepsake half A. Give it to the recipient; never send it to the server in keepsake custody. */
  keepsakeHalf: string;
  /** Séance custody only: one base64url share of B per witness, in witness order. Never send these to the server. */
  shares?: string[];
}

function aad(letterId: string): BufferSource {
  return utf8(`${FORMAT}:${letterId}`) as BufferSource;
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function keepsakeTagOf(keepsakeHalf: string): Promise<string> {
  return sha256(`${FORMAT}:keepsake:${keepsakeHalf}`);
}

/** With `split`, B is cut into `n` Shamir shares (any `k` rebuild it) and the sealed copy carries no vault half. */
export async function sealLetter(letterId: string, content: LetterContent, split?: { k: number; n: number }): Promise<SealResult> {
  const k = randomBytes(KEY_BYTES);
  const a = randomBytes(KEY_BYTES);
  const b = xorBytes(k, a);
  const iv = randomBytes(IV_BYTES);
  try {
    const key = await importKey(k);
    const plaintext = utf8(JSON.stringify({ format: FORMAT, ...content }));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(letterId) }, key, plaintext as BufferSource);
    const keepsakeHalf = toBase64Url(a);
    const shares = split ? splitSecret(b, split.k, split.n).map(toBase64Url) : undefined;
    return {
      keepsakeHalf,
      ...(shares ? { shares } : {}),
      sealed: {
        ciphertext: toBase64Url(new Uint8Array(ct)),
        iv: toBase64Url(iv),
        vaultHalf: shares ? '' : toBase64Url(b),
        keepsakeTag: await keepsakeTagOf(keepsakeHalf),
      },
    };
  } finally {
    k.fill(0);
    a.fill(0);
    b.fill(0);
  }
}

export async function openLetter(
  letterId: string,
  sealed: Pick<SealedLetter, 'ciphertext' | 'iv' | 'vaultHalf'>,
  keepsakeHalf: string,
): Promise<LetterContent> {
  let a: Uint8Array;
  let b: Uint8Array;
  try {
    a = fromBase64Url(keepsakeHalf);
    b = fromBase64Url(sealed.vaultHalf);
  } catch {
    throw new SealError('The keepsake is not in a form this letter recognises.');
  }
  if (a.length !== KEY_BYTES || b.length !== KEY_BYTES) {
    throw new SealError('The keepsake is the wrong length for this letter.');
  }
  const k = xorBytes(a, b);
  try {
    // An AES-GCM IV here is always 96 bits. Refuse anything else before decrypting.
    let iv: Uint8Array | null = null;
    try {
      iv = fromBase64Url(sealed.iv);
    } catch {
      iv = null; // undecodable: fall through to the generic failure below
    }
    if (iv && iv.length !== IV_BYTES) {
      throw new SealError('The letter is damaged: its seal is the wrong length.');
    }
    const key = await importKey(k);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(sealed.iv) as BufferSource, additionalData: aad(letterId) },
      key,
      fromBase64Url(sealed.ciphertext) as BufferSource,
    );
    const parsed = JSON.parse(fromUtf8(new Uint8Array(pt))) as Partial<LetterContent> & { format?: string };
    if (parsed.format !== FORMAT || typeof parsed.html !== 'string') {
      throw new SealError('The letter opened but its contents are not readable.');
    }
    return { title: parsed.title ?? '', html: parsed.html, from: parsed.from ?? '' };
  } catch (err) {
    if (err instanceof SealError) throw err;
    throw new SealError('The seal will not break: the keepsake does not match, or the letter was altered.');
  } finally {
    k.fill(0);
  }
}

/** Opens a séance letter: rebuilds B from the witnesses' shares, then K = A xor B. */
export async function openSeanceLetter(
  letterId: string,
  sealed: Pick<SealedLetter, 'ciphertext' | 'iv'>,
  keepsakeHalf: string,
  shares: string[],
  needed: number,
): Promise<LetterContent> {
  if (shares.length < needed) {
    throw new SealError(
      `This letter needs ${needed} witnesses to have spoken, and only ${shares.length} share${shares.length === 1 ? ' was' : 's were'} sent. It cannot be opened yet.`,
    );
  }
  let b: Uint8Array;
  try {
    b = combineShares(shares.map(fromBase64Url));
  } catch (err) {
    if (err instanceof ShamirError) throw new SealError('The witnesses\' shares do not fit together, so the seal cannot be rebuilt.');
    throw new SealError('A witness share is not in a form this letter recognises.');
  }
  try {
    return await openLetter(letterId, { ...sealed, vaultHalf: toBase64Url(b) }, keepsakeHalf);
  } finally {
    b.fill(0);
  }
}
