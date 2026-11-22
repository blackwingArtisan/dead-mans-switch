import type { MailMessage, Mailer } from '../ports';

/** The part of the SES v2 `SendEmail` request this mailer uses (field names as in the API). */
export interface SesSendEmailInput {
  FromEmailAddress: string;
  Destination: { ToAddresses: string[] };
  Content: {
    Simple: {
      Subject: { Data: string; Charset: 'UTF-8' };
      Body: { Html: { Data: string; Charset: 'UTF-8' }; Text: { Data: string; Charset: 'UTF-8' } };
    };
  };
  ConfigurationSetName?: string;
}

/** A small client interface; a later task wraps `@aws-sdk/client-sesv2` to fit it. */
export interface SesClientLike {
  sendEmail(input: SesSendEmailInput): Promise<unknown>;
}

/**
 * Production mailer on AWS: Amazon SES v2 `SendEmail`, one call per message.
 * Written and type-checked; not called by tests or the local demo.
 */
export class SesMailer implements Mailer {
  constructor(
    private readonly client: SesClientLike,
    private readonly from: string,
    private readonly configurationSet?: string,
  ) {
    if (!from) throw new Error('SesMailer needs a sender address.');
  }

  async send(message: MailMessage): Promise<void> {
    const input: SesSendEmailInput = {
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [address(message.to.name, message.to.email)] },
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: { Html: { Data: message.html, Charset: 'UTF-8' }, Text: { Data: message.text, Charset: 'UTF-8' } },
        },
      },
    };
    if (this.configurationSet) input.ConfigurationSetName = this.configurationSet;
    try {
      await this.client.sendEmail(input);
    } catch (err) {
      // Name only: the message could echo the address or body.
      const name = err instanceof Error && err.name && err.name !== 'Error' ? err.name : 'UnknownError';
      throw new Error(`SES refused the ${message.kind} email (${name}).`);
    }
  }
}

/** `Name <email>`, with control characters and quotes removed from the name so it cannot add headers. */
function address(name: string, email: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f"<>\\]/g, '').trim();
  if (!clean) return email;
  return /^[\p{L}\p{N} .'-]+$/u.test(clean) ? `${clean} <${email}>` : `"${clean}" <${email}>`;
}
