/** Email templates. Every message has a plain-text body and a matching HTML body. */
import type { EmailEffect } from '../core/machine';
import { describeAge, REVIEW_AFTER_DAYS } from '../core/review';
import type { MailMessage } from './ports';

export function formatDate(at: number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(at));
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface Draft {
  subject: string;
  lines: string[];
  link?: { href: string; label: string };
}

/** Emails to the author that carry a one-tap check-in link. */
export const CHECK_IN_TEMPLATES: ReadonlySet<EmailEffect['template']> = new Set(['reminder', 'grace', 'last-call', 'witnesses-asked', 'denied']);

function draft(effect: EmailEffect, baseUrl: string, checkInToken?: string): Draft {
  const checkIn = checkInToken
    ? { href: `${baseUrl}/check-in/${checkInToken}`, label: 'Check in now' }
    : { href: `${baseUrl}/`, label: 'Check in now' };
  switch (effect.template) {
    case 'reminder':
      return {
        subject: 'Your candle burns low: please check in',
        lines: [
          `Your next check-in is due by ${formatDate(effect.dueAt)}.`,
          'One tap is enough to tell us you still walk among the living.',
          ...(effect.reviewAgeDays !== undefined && effect.reviewAgeDays >= REVIEW_AFTER_DAYS
            ? [
                `Your oldest letter was sealed ${describeAge({ years: Math.floor(effect.reviewAgeDays / REVIEW_AFTER_DAYS), days: effect.reviewAgeDays % REVIEW_AFTER_DAYS })} ago. Please open your vigil and review your letters: accounts, phone numbers and renewal dates change.`,
              ]
            : []),
        ],
        link: checkIn,
      };
    case 'grace':
      return {
        subject: 'You missed your check-in: the grace period has begun',
        lines: [
          `Your check-in was due on ${formatDate(effect.dueAt)}.`,
          `If you do not check in by ${formatDate(effect.graceEndsAt)}, your witnesses will be asked to confirm before any letter is released.`,
        ],
        link: checkIn,
      };
    case 'last-call':
      return {
        subject: 'Last call: your witnesses will be asked tomorrow',
        lines: [
          `Your grace period ends on ${formatDate(effect.graceEndsAt)}.`,
          'If this is a mistake, check in now and nothing will be sent.',
        ],
        link: checkIn,
      };
    case 'witness-ask':
      return {
        subject: `${effect.authorName} named you a witness: please confirm`,
        lines: [
          `${effect.authorName} asked us to deliver some letters if they could no longer check in.`,
          `They last checked in on ${formatDate(effect.lastCheckInAt)} and have missed their grace period.`,
          'Before anything is released we need someone who knows them to confirm. If they are well, you can stop the release.',
        ],
        link: { href: `${baseUrl}/witness/${effect.witnessToken}`, label: 'Answer as a witness' },
      };
    case 'witnesses-asked':
      return {
        subject: 'Your witnesses have been asked to confirm',
        lines: [
          effect.witnessCount
            ? `Your grace period ended, so ${effect.witnessCount} witness${effect.witnessCount === 1 ? '' : 'es'} were asked to confirm.`
            : 'Your grace period ended. You have no witnesses named.',
          'If you are reading this, check in now: it cancels everything and your witnesses will be told to stand down.',
        ],
        link: checkIn,
      };
    case 'stand-down':
      return {
        subject: `${effect.authorName} checked in: no action needed`,
        lines: [`Good news. ${effect.authorName} has checked in, so there is nothing to confirm. Thank you for watching over them.`],
      };
    case 'denied':
      return {
        subject: `${effect.witnessName} says you still live: please check in`,
        lines: [
          `${effect.witnessName} stopped the release of your letters.`,
          ...(effect.witnessNote ? [`${effect.witnessName} left you a note: “${effect.witnessNote}”`] : []),
          `A new grace period runs until ${formatDate(effect.graceEndsAt)}. Check in to reset your candle.`,
        ],
        link: checkIn,
      };
    case 'witness-named':
      return {
        subject: `${effect.authorName} named you a witness`,
        lines: [
          `${effect.authorName} uses Last Candle to keep letters for the people they love, sealed until they can no longer check in.`,
          `They named you as a witness. You do not need to do anything now. If they ever miss a check-in and their grace period, we will ask you to confirm before anything is released${effect.witnessesRequired > 1 ? ` (${effect.witnessesRequired} witnesses must agree)` : ''}.`,
          'You cannot read their letters, and neither can we.',
        ],
      };
    case 'candle-lit':
      return {
        subject: `${effect.from} lit a candle for ${effect.authorName}`,
        lines: [
          `${effect.from} read the letter ${effect.authorName} left them, and lit a candle back:`,
          `"${effect.line}"`,
          'Nothing is needed from you. We thought you would want to know.',
        ],
      };
    case 'release': {
      const fragment = effect.keepsakeHalf ? `#k=${effect.keepsakeHalf}` : '';
      return {
        subject: `A letter from ${effect.authorName}`,
        lines: [
          `${effect.authorName} wrote you a letter and asked us to keep it sealed until they could no longer check in. We are sorry to be the ones to send it.`,
          'The link below opens once. The letter is decrypted in your browser; we cannot read it.',
          effect.keepsakeHalf
            ? 'Open it somewhere quiet, and save a copy when it opens.'
            : 'You will need the keepsake they gave you (a link or a printed code). Open it somewhere quiet, and save a copy when it opens.',
        ],
        link: { href: `${baseUrl}/open/${effect.openToken}${fragment}`, label: 'Open the letter' },
      };
    }
  }
}

export function renderEmail(effect: EmailEffect & { vaultId: string; checkInToken?: string }, baseUrl: string): MailMessage {
  const d = draft(effect, baseUrl.replace(/\/$/, ''), effect.checkInToken);
  if (effect.checkInToken) d.lines.push('The button checks you in once and does nothing else: it cannot open your vault, read or change anything.');
  const greeting = `Dear ${effect.to.name},`;
  const sign = "Last Candle";
  const text = [greeting, '', ...d.lines.flatMap((l) => [l, '']), d.link ? `${d.link.label}: ${d.link.href}\n` : '', sign]
    .join('\n')
    .trim();
  const html = `<!doctype html><html><body style="margin:0;background:#0d0a09;padding:32px 16px;font-family:Georgia,serif;color:#e9dcc0">
<div style="max-width:520px;margin:0 auto;background:#1a1411;border:1px solid #4a3426;border-radius:6px;padding:28px">
<p style="margin:0 0 16px;font-size:17px">${escapeHtml(greeting)}</p>
${d.lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55">${escapeHtml(l)}</p>`).join('\n')}
${d.link ? `<p style="margin:24px 0"><a href="${escapeHtml(d.link.href)}" style="background:#8e1b1b;color:#fff4e0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(d.link.label)}</a></p><p style="font-size:12px;color:#a89880;word-break:break-all">${escapeHtml(d.link.href)}</p>` : ''}
<p style="margin:24px 0 0;color:#a89880;font-style:italic">${sign}</p>
</div></body></html>`;
  return { to: effect.to, subject: d.subject, text, html, kind: effect.template, vaultId: effect.vaultId };
}
