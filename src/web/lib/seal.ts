/** Browser-side sealing: encrypt, upload only what the vault may hold, remember the keepsake. */
import { sealLetter } from '../../core/crypto';
import { randomId } from '../../core/encoding';
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
        html:
          '<p>Tomás,</p><p>If this reached you, I have been quiet for too long, and Noor has confirmed it. Here is everything only I could open.</p>' +
          '<ul><li><strong>Domain registrar:</strong> the login is in the company password manager under “Registrar”. Renewal is due every March; auto-renew is on.</li>' +
          '<li><strong>Cloud root account:</strong> the recovery codes are in the sealed envelope in the office safe. The safe code is in the same password manager entry.</li>' +
          '<li><strong>Contractor payouts:</strong> you are already a second admin on the payments account. Pay the open invoices yourself; the schedule is pinned in the finance channel.</li>' +
          '<li><strong>The password manager itself:</strong> its emergency kit is in the same envelope.</li></ul>' +
          '<blockquote>Rotate every one of these the week you read this. Then keep shipping.</blockquote>',
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
