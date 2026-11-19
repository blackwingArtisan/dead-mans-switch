import { useEffect } from 'react';
import { Shell } from '../components/Chrome';
import { Comparison, Stakes } from '../components/Comparison';
import { KeyDiagram } from '../components/KeyDiagram';

export function HowItWorks() {
  // The landing teaser links to the table by its anchor; the page renders after load, so scroll once it exists.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return (
    <Shell>
      <article className="prose" aria-labelledby="how-title">
        <p className="eyebrow">The honest page</p>
        <h1 id="how-title" className="display display--md">
          How the seal works
        </h1>
        <Stakes />

        <KeyDiagram />

        <h2>Two halves of one key</h2>
        <p>
          Every letter gets its own random 256-bit key, <strong>K</strong>, made in your browser. Your letter is encrypted with
          AES-GCM using that key and a fresh random IV, and the ciphertext is bound to the letter’s id so it cannot be swapped onto
          another letter.
        </p>
        <p>
          K is then split in two. <strong>A</strong>, the keepsake half, is 32 random bytes. <strong>B</strong>, the vault half, is
          K xor A. Either half alone is pure noise. The vault stores B and the ciphertext. In keepsake custody, A goes to your
          recipient ahead of time, by a link or a printed code you hand over yourself.
        </p>
        <p>
          When your witnesses confirm, the recipient receives a one-time link. Their browser fetches B and the ciphertext, joins
          them with A, and decrypts the letter on their own device. The vault then forgets its copy.
        </p>

        <h2>What we can and cannot see</h2>
        <ul>
          <li>
            <strong>We cannot read keepsake-custody letters</strong>, before or after release, because we never hold A.
          </li>
          <li>
            <strong>Vault custody is a convenience, not a secret.</strong> The vault holds both halves so nothing has to be handed over,
            which means whoever runs the server could read those letters. The writing desk says so before you choose it.
          </li>
          <li>
            <strong>We do see metadata:</strong> your name and email, your witnesses, each recipient’s name and email, when letters
            were sealed, and the size of each letter.
          </li>
        </ul>

        <h2>Limits, plainly</h2>
        <ul>
          <li>
            If your device is compromised while you write, the letter can be read there. Encryption protects the letter after it
            leaves your browser, not before.
          </li>
          <li>
            Anyone who gets the release email and the keepsake can open the letter. Keep keepsakes somewhere only your recipient can
            reach, and ask them to keep the code safe.
          </li>
          <li>
            Witnesses who agree with each other could release letters early. Choose people who would never do that, and require more
            than one if it matters.
          </li>
          <li>
            The site’s code is what does the encryption. If the server were made to serve malicious code, it could leak letters as you
            write them. This is true of every web app that encrypts in the browser.
          </li>
          <li>
            Each link opens once. If a recipient loses the letter after opening it, there is no second copy.
          </li>
          <li>
            Reminder emails carry a one-tap check-in link. It can only check you in, and each one works once, but someone reading
            your email could use it to keep your candle lit. Your witnesses are still asked if you go quiet for good.
          </li>
        </ul>

        <Comparison headingId="how-compare-title" />

        <h2>If this service ends before you do</h2>
        <p>
          A vigil can last years, longer than many web services. So the code is MIT-licensed and runs on a free hosting plan, and
          the policy is plain: if Dead Man’s Switch ever closes, every author gets at least 90 days’ notice and a sealed export of
          their letters, released letters stay openable until the notice ends, and nothing is deleted silently.
        </p>
        <p>
          You need not wait for that. <strong>Export the sealed letters</strong>, on your vigil, downloads each unopened letter
          exactly as the vault holds it. With that file and a keepsake, <a href="/offline-open.html" download="offline-open.html">one
          saved page</a> breaks the seal in any browser, offline, with no server at all. A keepsake-custody letter in the export is
          still unreadable without its keepsake.
        </p>

        <h2>False alarms</h2>
        <p>
          Missing a check-in only starts a grace period with reminders. When grace ends, your witnesses are asked first, and any one
          of them can say “they still live” to stop the release and start a new grace period. Checking in at any stage cancels
          everything and tells your witnesses to stand down. You can also pause the vigil for a trip or a hospital stay.
        </p>
      </article>
    </Shell>
  );
}
