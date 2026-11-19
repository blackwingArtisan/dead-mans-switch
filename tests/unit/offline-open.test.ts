import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sealLetter } from '../../src/core/crypto';
import { fromBase64Url, groupCode, toBase32 } from '../../src/core/encoding';
import { EXPORT_FORMAT, type SealedExport } from '../../src/core/export';

// offline-open.html carries its own copy of the opening code so it works with nothing else. Load that
// script exactly as shipped (it only wires the page when a document is present) and check it against
// letters sealed by the app's own crypto.
const html = readFileSync('src/web/public/offline-open.html', 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));
const offline = new Function(`${script}\nreturn { openFromExport, parseKeepsake };`)() as {
  openFromExport: (json: unknown, id: string, keepsake: string) => Promise<{ title: string; html: string; from: string }>;
  parseKeepsake: (input: string) => string | null;
};

async function exportWith(custody: 'keepsake' | 'vault') {
  const id = `L-${custody}`;
  const { sealed, keepsakeHalf } = await sealLetter(id, { title: 'For June', html: '<p>The password sheet is in the atlas.</p>', from: 'Mara' });
  const data: SealedExport = {
    format: EXPORT_FORMAT,
    exportedAt: 0,
    authorName: 'Mara Whitlock',
    letters: [
      {
        id,
        recipientName: 'June Okafor',
        custody,
        sealedAt: 0,
        releasedAt: null,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        vaultHalf: sealed.vaultHalf,
        keepsakeTag: sealed.keepsakeTag,
        ...(custody === 'vault' ? { keepsakeHalf } : {}),
      },
    ],
  };
  return { id, data, keepsakeHalf };
}

describe('offline-open.html', () => {
  it('opens a keepsake-custody letter from the export with the keepsake link, the printed code or the bare half', async () => {
    const { id, data, keepsakeHalf } = await exportWith('keepsake');
    const link = `https://vigil.example.com/keepsake/${id}#k=${keepsakeHalf}&from=Mara&to=June`;
    const code = groupCode(toBase32(fromBase64Url(keepsakeHalf)));
    for (const keepsake of [link, code, code.toLowerCase(), keepsakeHalf]) {
      const letter = await offline.openFromExport(JSON.stringify(data), id, keepsake);
      expect(letter).toEqual({ title: 'For June', html: '<p>The password sheet is in the atlas.</p>', from: 'Mara' });
    }
  });

  it('refuses without the right keepsake, and refuses an altered export', async () => {
    const { id, data } = await exportWith('keepsake');
    await expect(offline.openFromExport(data, id, '')).rejects.toThrow('does not look like a keepsake');
    const other = (await sealLetter('x', { title: '', html: '', from: '' })).keepsakeHalf;
    await expect(offline.openFromExport(data, id, other)).rejects.toThrow('The seal will not break');
    const tampered = structuredClone(data);
    const ct = tampered.letters[0]!.ciphertext;
    tampered.letters[0]!.ciphertext = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    const { keepsakeHalf } = await exportWith('keepsake');
    await expect(offline.openFromExport(tampered, id, keepsakeHalf)).rejects.toThrow('The seal will not break');
  });

  it('opens a vault-custody letter from the export alone', async () => {
    const { id, data } = await exportWith('vault');
    expect((await offline.openFromExport(data, id, '')).html).toContain('atlas');
  });

  it('rejects anything that is not a sealed export', async () => {
    await expect(offline.openFromExport('{"format":"something-else","letters":[]}', 'L', 'x')).rejects.toThrow('not a sealed export');
    expect(offline.parseKeepsake('not a keepsake at all')).toBeNull();
  });

  it('uses the same letter and export formats as the app', () => {
    expect(script).toContain("const FORMAT = 'dms-letter-v1'");
    expect(script).toContain(`const EXPORT_FORMAT = '${EXPORT_FORMAT}'`);
    // Nothing in the page reaches the network.
    expect(html).not.toMatch(/\bfetch\(|XMLHttpRequest|<script src|<link [^>]*href="http/);
  });
});
