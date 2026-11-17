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

/** Invented sample people and letters for the one-click demo vigil. */
export const DEMO = {
  author: { name: 'Mara Whitlock', email: 'mara.whitlock@example.com' },
  witnesses: [
    { name: 'Silas Crane', email: 'silas.crane@example.com' },
    { name: 'Ada Penhallow', email: 'ada.penhallow@example.com' },
  ],
  letters: [
    {
      recipient: { name: 'Theo Whitlock', email: 'theo.whitlock@example.com' },
      custody: 'keepsake' as const,
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
      custody: 'vault' as const,
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
