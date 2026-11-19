import type { ReactNode } from 'react';
import { Link } from '../lib/router';
import { useRoom } from '../lib/room';
import { Candle } from './Candle';
import { Shell } from './Chrome';
import { WaxSeal } from './WaxSeal';

/** Words that only say which kind of link it was; dropped when checking whether two lines say the same thing. */
const KINDS = /\b(letter|witness|check-in|keepsake|this|that|the)\b/g;
const words = (s: string) => s.toLowerCase().replace(KINDS, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** True when the server's message only repeats the heading, as in "This letter link is not valid." */
export function repeats(title: string, message: string): boolean {
  return words(title) === words(message);
}

function Ways() {
  return (
    <p className="notice__actions">
      <Link href="/" className="btn btn--brass">
        Return to the threshold
      </Link>
      <Link href="/how-it-works" className="btn btn--ghost">
        How the seal works
      </Link>
    </p>
  );
}

/**
 * The one page every spent, mistyped or unknown link lands on: a heading, what the server said
 * (unless it only repeats the heading), what to do next, and two ways out.
 */
export function LinkNotice({
  title,
  message,
  detail,
  cracked = false,
  testId,
}: {
  title: string;
  message?: string;
  detail: ReactNode;
  cracked?: boolean;
  testId?: string;
}) {
  return (
    <Shell>
      <section className="notice" data-testid={testId} aria-labelledby="notice-title">
        <WaxSeal size={96} tone="ink" cracked={cracked} />
        <h1 id="notice-title" className="display display--md">
          {title}
        </h1>
        {message && !repeats(title, message) && <p className="lede">{message}</p>}
        <p className="notice__detail">{detail}</p>
        <Ways />
      </section>
    </Shell>
  );
}

/** Any address the app does not know: an unlit candle in a cold room. */
export function NotFound() {
  useRoom('confirm');
  return (
    <Shell>
      <section className="notice notice--lost" data-testid="not-found" aria-labelledby="lost-title">
        <Candle remaining={0} state="confirm" size={200} />
        <h1 id="lost-title" className="display display--md">
          No vigil is kept here
        </h1>
        <p className="lede">This address leads nowhere. No candle burns at it, and no letter waits behind it.</p>
        <p className="notice__detail">
          If it came from an email, check that the whole link was copied. Letter, witness and check-in links all begin with
          /open, /witness or /check-in.
        </p>
        <Ways />
      </section>
    </Shell>
  );
}
