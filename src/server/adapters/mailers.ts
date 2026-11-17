import type { MailMessage, Mailer } from '../ports';

export interface OutboxEntry extends MailMessage {
  id: number;
  sentAt: number;
}

/**
 * Local mailer: nothing leaves the machine. Messages land in an outbox the demo UI
 * can read. `onChange` lets the Node entry persist the outbox to a JSON file.
 */
export class OutboxMailer implements Mailer {
  private entries: OutboxEntry[] = [];
  private nextId = 1;

  constructor(
    private readonly clock: { now(): number },
    initial: OutboxEntry[] = [],
    private readonly onChange?: (entries: OutboxEntry[]) => void,
  ) {
    this.entries = [...initial];
    this.nextId = initial.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }

  async send(message: MailMessage): Promise<void> {
    this.entries.push({ ...message, id: this.nextId++, sentAt: this.clock.now() });
    this.onChange?.(this.list());
  }

  list(): OutboxEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  clear(): void {
    this.entries = [];
    this.onChange?.([]);
  }
}

/**
 * Production mailer using Resend's HTTPS API (free tier: 3,000 emails a month).
 * Written and type-checked; not called by tests or the local demo.
 */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error('ResendMailer needs an API key.');
  }

  async send(message: MailMessage): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [`${message.to.name} <${message.to.email}>`],
        subject: message.subject,
        text: message.text,
        html: message.html,
        tags: [{ name: 'kind', value: message.kind }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend refused the ${message.kind} email (HTTP ${res.status}).`);
    }
  }
}
