// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_KINDS,
  addSection,
  findLikelySecrets,
  newRunbook,
  removeSection,
  runbookHtml,
  runbookIsBlank,
  RUNBOOK_WARNING,
} from '../../src/core/runbook';
import { sanitizeLetterHtml } from '../../src/web/lib/sanitize';

const text = (html: string) => html.replace(/<\/(p|li|h2)>/g, '\n').replace(/<[^>]*>/g, '');

describe('founder runbook template', () => {
  it('has one section per account kind, in order (Founder Req 1.2)', () => {
    expect(ACCOUNT_KINDS.map((k) => k.id)).toEqual(['cloud', 'registrar', 'payments', 'bank', 'password-manager']);
    expect(ACCOUNT_KINDS.map((k) => k.title)).toEqual([
      'Cloud root account',
      'Domain registrar',
      'Payments and contractor payouts',
      'Bank',
      'The password manager itself',
    ]);
    expect(newRunbook().map((s) => s.kind)).toEqual(ACCOUNT_KINDS.map((k) => k.id));
  });

  it('asks each section for where, who and when (Founder Req 1.3)', () => {
    for (const s of newRunbook()) expect(Object.keys(s).sort()).toEqual(['due', 'kind', 'where', 'who']);
  });

  it('adds only absent kinds and removes a section from the letter (Founder Req 1.4, 1.5)', () => {
    const base = removeSection(newRunbook(), 'bank');
    expect(base.map((s) => s.kind)).not.toContain('bank');
    expect(runbookHtml(base.map((s) => ({ ...s, where: 'the safe' })))).not.toContain('Bank');
    const again = addSection(base, 'bank');
    expect(again.at(-1)).toEqual({ kind: 'bank', where: '', who: '', due: '' });
    expect(addSection(again, 'bank')).toHaveLength(again.length);
  });

  it('writes a heading and a list of filled fields, omitting empty ones (Founder Req 1.6)', () => {
    const s = newRunbook().slice(0, 2);
    s[0]!.where = 'the office safe';
    s[1]!.who = 'Noor on 555-0142';
    const html = runbookHtml(s);
    expect(html).toContain('<h2>Cloud root account</h2>');
    expect(html).toContain('the office safe');
    expect(html).toContain('Noor on 555-0142');
    expect(html).not.toContain('Renews or is due');
    expect(html.match(/<li>/g)).toHaveLength(2);
  });

  it('is blank only when every field is empty (Founder Req 1.7)', () => {
    const s = newRunbook();
    expect(runbookIsBlank(s)).toBe(true);
    s[3]!.due = '  ';
    expect(runbookIsBlank(s)).toBe(true);
    s[3]!.due = 'June';
    expect(runbookIsBlank(s)).toBe(false);
  });

  it('writes markup typed into a field as plain text (Founder Req 1.8)', () => {
    const s = newRunbook();
    s[0]!.where = '<img src=x onerror=alert(1)> & "q"';
    const html = runbookHtml(s);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&amp;');
  });

  it('survives the sanitiser unchanged, so it opens as written (Founder Req 3.4)', () => {
    const s = newRunbook().map((x) => ({ ...x, where: 'safe', who: 'Noor', due: 'March' }));
    const html = runbookHtml(s);
    expect(sanitizeLetterHtml(html)).toBe(html);
    expect(html).not.toMatch(/<[a-z0-9]+\s[^>]*=/i);
  });

  it('says in plain words never to paste a password or recovery code (Founder Req 2.1)', () => {
    expect(RUNBOOK_WARNING).toMatch(/never paste a password or recovery code/i);
    expect(RUNBOOK_WARNING).toMatch(/where to find it/i);
  });
});

describe('likely-secret check', () => {
  it('flags a labelled value (Founder Req 2.2)', () => {
    for (const line of ['password: hunter2', 'Recovery code = 1234', 'API key: sk-live', 'PIN:4821', 'secret= abc']) {
      expect(findLikelySecrets(line), line).toHaveLength(1);
    }
    const f = findLikelySecrets('hello\nPassword: correct-horse');
    expect(f[0]).toMatchObject({ line: 2, kind: 'labelled' });
  });

  it('flags a long mixed string but not a URL or an email (Founder Req 2.3)', () => {
    expect(findLikelySecrets('key k3J9xQ2mP8vL5nR7tW1zA')).toHaveLength(1);
    expect(findLikelySecrets('see https://example.com/a/k3J9xQ2mP8vL5nR7tW1zA')).toHaveLength(0);
    expect(findLikelySecrets('mail priya.raman.2026.long.address@example.com')).toHaveLength(0);
    expect(findLikelySecrets('contractor-payouts-schedule-pinned')).toHaveLength(0);
  });

  it('flags grouped recovery codes (Founder Req 2.4)', () => {
    expect(findLikelySecrets('ABCD-EF12-GH34-JK56')).toHaveLength(1);
    expect(findLikelySecrets('one-two-three-four')).toHaveLength(0);
  });

  it('masks the preview to three characters (Founder Req 2.5)', () => {
    const [f] = findLikelySecrets('k3J9xQ2mP8vL5nR7tW1zA');
    expect(f!.preview).toBe('k3J…');
    expect(JSON.stringify(f)).not.toContain('mP8vL5');
  });

  it('does not warn when the text only says where something is kept (Founder Req 2.9)', () => {
    const prose =
      'The recovery codes are in the sealed envelope in the office safe. The login is in the password manager under Registrar. Renewal is due every March. Call Noor on 555-0142.';
    expect(findLikelySecrets(prose)).toEqual([]);
    const s = newRunbook().map((x) => ({
      ...x,
      where: 'the recovery codes are in the office safe',
      who: 'Noor, 555-0142',
      due: 'every March',
    }));
    expect(findLikelySecrets(text(runbookHtml(s)))).toEqual([]);
  });
});
