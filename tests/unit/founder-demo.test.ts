// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ACCOUNT_KINDS, findLikelySecrets, htmlToPlainText } from '../../src/core/runbook';
import { FOUNDER_DEMO } from '../../src/web/lib/seal';

const letter = FOUNDER_DEMO.letters[0]!;
const plain = htmlToPlainText(letter.content.html);

describe("Priya's founder demo letter", () => {
  it('is built from the template, with the template headings (Founder Req 4.1, 4.2)', () => {
    const headings = [...letter.content.html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    const title = (id: string) => ACCOUNT_KINDS.find((k) => k.id === id)!.title;
    expect(headings).toEqual([title('cloud'), title('registrar'), title('payments'), title('password-manager')]);
    expect(letter.content.html).toContain('<strong>Where the login and recovery codes live:</strong>');
  });

  it('says the domain renews every March (Founder Req 4.3)', () => {
    const registrar = plain.slice(plain.indexOf('Domain registrar'), plain.indexOf('Payments and contractor payouts'));
    expect(registrar).toMatch(/every March/);
  });

  it('never mentions payroll or a bank (Founder Req 4.4)', () => {
    expect(plain).not.toMatch(/payroll/i);
    expect(letter.content.html).not.toContain('<h2>Bank</h2>');
    expect(plain).toMatch(/contractor/i);
  });

  it('has no likely secret in it (Founder Req 4.5)', () => {
    expect(findLikelySecrets(plain)).toEqual([]);
  });

  it('keeps Tomás in vault custody and Anika in keepsake custody (Founder Req 4.6)', () => {
    expect(FOUNDER_DEMO.letters.map((l) => [l.recipient.name, l.custody])).toEqual([
      ['Tomás Rivera', 'vault'],
      ['Anika Raman', 'keepsake'],
    ]);
  });
});
