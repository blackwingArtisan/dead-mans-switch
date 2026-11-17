import { describe, expect, it } from 'vitest';
import { keepsakeTagOf, openLetter, sealLetter, SealError } from '../../src/core/crypto';
import { fromBase32, fromBase64Url, groupCode, toBase32, toBase64Url, xorBytes } from '../../src/core/encoding';

const content = {
  title: 'For Theo, when the lights go out',
  html: '<p>The spare key is under the <strong>third</strong> stone. I love you. 🕯️</p>',
  from: 'Mum',
};

describe('letter sealing', () => {
  it('round-trips a letter with the two halves', async () => {
    const { sealed, keepsakeHalf } = await sealLetter('letter-abc123', content);
    expect(await openLetter('letter-abc123', sealed, keepsakeHalf)).toEqual(content);
  });

  it('never puts plaintext or the full key in what the server stores', async () => {
    const { sealed, keepsakeHalf } = await sealLetter('letter-abc123', content);
    const stored = JSON.stringify(sealed);
    expect(stored).not.toContain('third');
    expect(stored).not.toContain(keepsakeHalf);
    expect(sealed.keepsakeHalf).toBeUndefined();
    expect(fromBase64Url(sealed.vaultHalf)).toHaveLength(32);
    expect(fromBase64Url(sealed.iv)).toHaveLength(12);
  });

  it('uses a fresh key and IV every time', async () => {
    const a = await sealLetter('letter-abc123', content);
    const b = await sealLetter('letter-abc123', content);
    expect(a.sealed.iv).not.toBe(b.sealed.iv);
    expect(a.sealed.ciphertext).not.toBe(b.sealed.ciphertext);
    expect(a.keepsakeHalf).not.toBe(b.keepsakeHalf);
  });

  it('refuses the wrong keepsake half', async () => {
    const { sealed } = await sealLetter('letter-abc123', content);
    const other = await sealLetter('letter-abc123', content);
    await expect(openLetter('letter-abc123', sealed, other.keepsakeHalf)).rejects.toBeInstanceOf(SealError);
  });

  it('refuses a vault half alone (all-zero keepsake)', async () => {
    const { sealed } = await sealLetter('letter-abc123', content);
    await expect(openLetter('letter-abc123', sealed, toBase64Url(new Uint8Array(32)))).rejects.toThrow(/does not match/);
  });

  it('detects tampering with the ciphertext', async () => {
    const { sealed, keepsakeHalf } = await sealLetter('letter-abc123', content);
    const bytes = fromBase64Url(sealed.ciphertext);
    bytes[5] = bytes[5]! ^ 1;
    await expect(openLetter('letter-abc123', { ...sealed, ciphertext: toBase64Url(bytes) }, keepsakeHalf)).rejects.toThrow(SealError);
  });

  it('binds the ciphertext to its letter id', async () => {
    const { sealed, keepsakeHalf } = await sealLetter('letter-abc123', content);
    await expect(openLetter('letter-zzz999', sealed, keepsakeHalf)).rejects.toThrow(SealError);
  });

  it('rejects malformed keepsakes clearly', async () => {
    const { sealed } = await sealLetter('letter-abc123', content);
    await expect(openLetter('letter-abc123', sealed, 'c2hvcnQ')).rejects.toThrow(/wrong length/);
    await expect(openLetter('letter-abc123', sealed, '!!!')).rejects.toThrow(/not in a form/);
  });

  it('publishes a keepsake tag that matches only the right half', async () => {
    const { sealed, keepsakeHalf } = await sealLetter('letter-abc123', content);
    expect(await keepsakeTagOf(keepsakeHalf)).toBe(sealed.keepsakeTag);
    expect(await keepsakeTagOf(toBase64Url(new Uint8Array(32)))).not.toBe(sealed.keepsakeTag);
  });
});

describe('encoding', () => {
  it('xor of the halves recovers the key and either half alone looks random', () => {
    const k = crypto.getRandomValues(new Uint8Array(32));
    const a = crypto.getRandomValues(new Uint8Array(32));
    const b = xorBytes(k, a);
    expect(xorBytes(a, b)).toEqual(k);
    expect(b).not.toEqual(k);
  });

  it('keepsake codes round-trip through Crockford base32 and forgive handwriting', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const code = toBase32(bytes);
    expect(code).toHaveLength(52);
    expect(fromBase32(groupCode(code).toLowerCase(), 32)).toEqual(bytes);
    const zeros = toBase32(new Uint8Array(32));
    expect(fromBase32(zeros.replace(/0/g, 'O'), 32)).toEqual(new Uint8Array(32));
    expect(() => fromBase32('ABC', 32)).toThrow(/too short/);
    expect(() => fromBase32('U'.repeat(52), 32)).toThrow(/not part of/);
  });

  it('base64url round-trips', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(33));
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });
});
