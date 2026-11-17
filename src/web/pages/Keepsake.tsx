import { useEffect, useMemo } from 'react';
import { fromBase64Url, groupCode, toBase32 } from '../../core/encoding';
import { keepsakes } from '../lib/api';
import { Shell } from '../components/Chrome';
import { WaxSeal } from '../components/WaxSeal';

/** Where a recipient lands from a keepsake link. Nothing here talks to the server. */
export function Keepsake({ letterId, hash }: { letterId: string; hash: string }) {
  const params = useMemo(() => new URLSearchParams(hash.replace(/^#/, '')), [hash]);
  const half = params.get('k') ?? '';
  const from = params.get('from') ?? 'Someone who loves you';
  const to = params.get('to') ?? '';
  const code = useMemo(() => {
    try {
      const bytes = fromBase64Url(half);
      return bytes.length === 32 ? groupCode(toBase32(bytes)) : null;
    } catch {
      return null;
    }
  }, [half]);

  useEffect(() => {
    if (code) keepsakes.save(letterId, half);
  }, [code, half, letterId]);

  return (
    <Shell>
      <section className="keepsake" aria-labelledby="keepsake-title">
        <WaxSeal size={120} tone="gold" mark={from.trim()[0]} />
        <p className="eyebrow">{to ? `For ${to}` : 'For you'}</p>
        <h1 id="keepsake-title" className="display display--md">
          {code ? `${from} entrusted you with a keepsake` : 'This keepsake is incomplete'}
        </h1>
        {code ? (
          <>
            <p className="lede">
              It opens nothing today. It is one half of a key. If {from.split(' ')[0]} can no longer check in, you will receive an
              email with a one-time link, and this keepsake will open the letter waiting behind it.
            </p>
            <div className="keepsake-card parchment">
              <p className="keepsake-card__eyebrow">Your keepsake code</p>
              <p className="keepsake-card__code" data-testid="keepsake-code">
                {code}
              </p>
              <p className="keepsake-card__note">
                This browser will remember it. Write the code down or print this page too, in case you open the letter somewhere else.
              </p>
              <div className="keepsake-card__actions">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => window.print()}>
                  Print this keepsake
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="lede">The link was cut short. Ask the person who sent it to copy the whole link again.</p>
        )}
      </section>
    </Shell>
  );
}
