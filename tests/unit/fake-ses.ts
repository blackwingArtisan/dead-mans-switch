/** An in-memory stand-in for the SES v2 client: records requests, can be told to refuse. */
import type { SesClientLike, SesSendEmailInput } from '../../src/server/adapters/ses-mailer';

export class FakeSes implements SesClientLike {
  readonly sent: SesSendEmailInput[] = [];
  failWith: Error | null = null;

  async sendEmail(input: SesSendEmailInput): Promise<unknown> {
    if (this.failWith) throw this.failWith;
    this.sent.push(structuredClone(input));
    return { MessageId: `fake-${this.sent.length}` };
  }
}
