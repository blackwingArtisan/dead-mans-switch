import { describe, expect, it } from 'vitest';
import type { MailMessage } from '../../src/server/ports';
import { SesMailer } from '../../src/server/adapters/ses-mailer';
import { FakeSes } from './fake-ses';

const message: MailMessage = {
  to: { name: 'Silas Crane', email: 'silas@example.com' },
  subject: 'Mara has gone quiet',
  text: 'plain body with https://switch.test/witness/SECRETLINK',
  html: '<p>html body SECRETLINK</p>',
  kind: 'witness-asked',
  vaultId: 'vault-1',
};

describe('SesMailer', () => {
  it('calls SendEmail once with a Simple message, subject, HTML and text, all UTF-8 (AWS Req 5.1)', async () => {
    const ses = new FakeSes();
    await new SesMailer(ses, 'Last Candle <hello@example.com>').send(message);
    expect(ses.sent).toHaveLength(1);
    expect(ses.sent[0]!.Content.Simple).toEqual({
      Subject: { Data: message.subject, Charset: 'UTF-8' },
      Body: { Html: { Data: message.html, Charset: 'UTF-8' }, Text: { Data: message.text, Charset: 'UTF-8' } },
    });
  });

  it('addresses Name <email> and takes the sender from configuration (AWS Req 5.2)', async () => {
    const ses = new FakeSes();
    await new SesMailer(ses, 'Last Candle <hello@example.com>').send(message);
    expect(ses.sent[0]!.Destination.ToAddresses).toEqual(['Silas Crane <silas@example.com>']);
    expect(ses.sent[0]!.FromEmailAddress).toBe('Last Candle <hello@example.com>');
  });

  it('cannot be given extra headers through a recipient name (AWS Req 5.2)', async () => {
    const ses = new FakeSes();
    await new SesMailer(ses, 'hello@example.com').send({ ...message, to: { name: 'Eve"\r\nBcc: x@example.com', email: 'eve@example.com' } });
    const to = ses.sent[0]!.Destination.ToAddresses[0]!;
    expect(to).not.toMatch(/[\r\n]/);
    expect(to.endsWith('<eve@example.com>')).toBe(true);
  });

  it('passes the configuration set only when one is configured (AWS Req 5.5)', async () => {
    const ses = new FakeSes();
    await new SesMailer(ses, 'hello@example.com', 'candle-events').send(message);
    await new SesMailer(ses, 'hello@example.com').send(message);
    expect(ses.sent[0]!.ConfigurationSetName).toBe('candle-events');
    expect('ConfigurationSetName' in ses.sent[1]!).toBe(false);
  });

  it('throws with the SES error name and no body or link when SES refuses (AWS Req 5.4)', async () => {
    const ses = new FakeSes();
    const e = new Error(`bad: ${message.html} ${message.text} silas@example.com`);
    e.name = 'MessageRejected';
    ses.failWith = e;
    const err = await new SesMailer(ses, 'hello@example.com').send(message).then(() => null, (x: Error) => x);
    expect(err?.message).toBe('SES refused the witness-asked email (MessageRejected).');
    expect(err?.message).not.toContain('SECRETLINK');
  });

  it('writes nothing to the console, not the body or a link (AWS Req 5.3)', async () => {
    const seen: unknown[] = [];
    const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => void seen.push(a);
    try {
      const ses = new FakeSes();
      await new SesMailer(ses, 'hello@example.com').send(message);
      ses.failWith = new Error('x');
      await new SesMailer(ses, 'hello@example.com').send(message).catch(() => undefined);
    } finally {
      Object.assign(console, orig);
    }
    expect(seen).toEqual([]);
  });
});
