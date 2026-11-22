/** Browser-side sealing: encrypt, upload only what the vault may hold, remember the keepsake. */
import { sealLetter } from '../../core/crypto';
import { randomId } from '../../core/encoding';
import { newRunbook, runbookHtml } from '../../core/runbook';
import type { Custody, LetterContent, Person } from '../../core/types';
import type { VaultView } from '../../core/vault';
import { api, authored } from './api';

export interface SealedResult {
  letterId: string;
  keepsakeHalf: string;
  keepsakeLink: string;
  vault: VaultView;
}

export function keepsakeLinkFor(letterId: string, half: string, from: string, to: string): string {
  const params = new URLSearchParams({ k: half, from, to });
  return `${window.location.origin}/keepsake/${letterId}#${params.toString()}`;
}

export async function sealAndStore(args: {
  recipient: Person;
  custody: Custody;
  content: LetterContent;
  authorName: string;
}): Promise<SealedResult> {
  const letterId = `L${randomId(9)}`;
  const { sealed, keepsakeHalf } = await sealLetter(letterId, args.content);
  const vault = await api.addLetter({
    id: letterId,
    recipient: args.recipient,
    custody: args.custody,
    sealed,
    ...(args.custody === 'vault' ? { keepsakeHalf } : {}),
  });
  authored.save(letterId, keepsakeHalf);
  return {
    letterId,
    keepsakeHalf,
    keepsakeLink: keepsakeLinkFor(letterId, keepsakeHalf, args.authorName, args.recipient.name),
    vault,
  };
}

/**
 * Invented sample people and letters for the one-click demo vigil. Theo's letter is in vault custody (his link opens on its
 * own); June's is in keepsake custody (she brings half the key), so the demo shows both modes and the story can show the card.
 */
export const DEMO = {
  author: { name: 'Mara Whitlock', email: 'mara.whitlock@example.com' },
  witnesses: [
    { name: 'Silas Crane', email: 'silas.crane@example.com' },
    { name: 'Ada Penhallow', email: 'ada.penhallow@example.com' },
  ],
  letters: [
    {
      recipient: { name: 'Theo Whitlock', email: 'theo.whitlock@example.com' },
      custody: 'vault' as const,
      content: {
        title: 'For Theo, when the lights go out',
        from: 'Mum',
        html:
          '<p>My dearest Theo,</p><p>If you are reading this, I could not say it in person, so I am saying it here: <strong>I am so proud of you.</strong></p>' +
          '<p>The deed to the cottage is in the blue tin on the top shelf of the pantry. The spare key is under the third stone by the gate. Mrs. Abernathy at 14 Hollow Lane has the other one.</p>' +
          '<blockquote>Be gentle with yourself. Grief is only love with nowhere to go.</blockquote>' +
          '<p>Plant the foxgloves this spring. They always came back for me.</p>',
      },
    },
    {
      recipient: { name: 'June Okafor', email: 'june.okafor@example.com' },
      custody: 'keepsake' as const,
      content: {
        title: 'June, the passwords and the cat',
        from: 'Mara',
        html:
          '<p>June,</p><p>You were always the practical one, so you get the practical letter.</p>' +
          '<ul><li>The password manager recovery sheet is in the fireproof box. The code is our old locker number.</li><li>Biscuit eats twice a day and lies about it.</li><li>Please cancel the newspaper.</li></ul>' +
          '<p>Thank you for thirty years of answering the phone at 3 a.m.</p>',
      },
    },
  ],
};

/**
 * Priya's letter to Tomás, written from the Founder runbook template. Two people, no employees: no payroll, and no bank
 * section. Each field says where something is kept, never the secret itself.
 */
function founderRunbookHtml(): string {
  const wanted = ['cloud', 'registrar', 'payments', 'password-manager'];
  const sections = newRunbook().filter((s) => wanted.includes(s.kind));
  const fill = (kind: string, fields: { where?: string; who?: string; due?: string }) => Object.assign(sections.find((s) => s.kind === kind)!, fields);
  fill('cloud', {
    where: 'The recovery codes are in the sealed envelope in the office safe.',
    who: 'Noor Haddad, 555-0142, knows the safe is in the back office',
  });
  fill('registrar', {
    where: 'The login is in the company password manager under “Registrar”.',
    who: 'The registrar’s support line, 555-0143',
    due: 'Renews every March; auto-renew is on',
  });
  fill('payments', {
    where: 'You are already a second admin on the payments account; the payout schedule is pinned in the finance channel.',
    who: 'The contractors are paid by invoice: pay the open ones yourself',
    due: 'Invoices fall due on the 1st of each month',
  });
  fill('password-manager', {
    where: 'Its emergency kit is in the same envelope as the cloud recovery codes.',
    who: 'Noor Haddad, 555-0142',
  });
  return (
    '<p>Tomás,</p><p>If this reached you, I have been quiet for too long, and Noor has confirmed it. Below is everything only I could open. It says where things are kept, never the secrets themselves.</p>' +
    runbookHtml(sections) +
    '<blockquote>Rotate every one of these the week you read this. Then keep shipping.</blockquote>'
  );
}

/** A second invented demo: a solo founder whose letters are about the accounts only she holds. */
export const FOUNDER_DEMO: typeof DEMO = {
  author: { name: 'Priya Raman', email: 'priya.raman@example.com' },
  witnesses: [{ name: 'Noor Haddad', email: 'noor.haddad@example.com' }],
  letters: [
    {
      recipient: { name: 'Tomás Rivera', email: 'tomas.rivera@example.com' },
      custody: 'vault' as const,
      content: {
        title: 'Tomás, the keys to the company',
        from: 'Priya',
        html: founderRunbookHtml(),
      },
    },
    {
      recipient: { name: 'Anika Raman', email: 'anika.raman@example.com' },
      custody: 'keepsake' as const,
      content: {
        title: 'For Anika',
        from: 'Your big sister',
        html:
          '<p>Anika,</p><p>The company letter went to Tomás. This one is just for you.</p>' +
          '<p>Thank you for every late-night call when the servers were down and I was too. You were right about taking the weekends.</p>',
      },
    },
  ],
};
