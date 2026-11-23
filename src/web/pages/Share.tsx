import { useEffect, useMemo } from 'react';
import { parseShareFragment, shareStore } from '../lib/api';
import { Shell } from '../components/Chrome';
import { WaxSeal } from '../components/WaxSeal';

/** Where a witness lands from a share link. The share is kept in this browser and never sent from here. */
export function Share({ hash }: { hash: string }) {
  const shares = useMemo(() => parseShareFragment(hash), [hash]);

  useEffect(() => {
    for (const s of shares) shareStore.save(s.letterId, s.share);
    // Keep the shares out of the address bar and history once they are stored.
    if (shares.length) window.history.replaceState({}, '', window.location.pathname);
  }, [shares]);

  return (
    <Shell>
      <section className="keepsake" aria-labelledby="share-title">
        <WaxSeal size={110} tone="ink" mark="S" />
        <p className="eyebrow">A séance share</p>
        <h1 id="share-title" className="display display--md">
          {shares.length ? 'You hold a share of a sealed letter' : 'This share link is incomplete'}
        </h1>
        {shares.length ? (
          <div role="status" data-testid="share-saved">
            <p className="lede">
              The share is kept on this device and is never sent anywhere from this page. It opens nothing alone.
            </p>
            <p>
              If you are later asked to confirm that the author can no longer check in, open that email on this same device and your
              share goes with your answer. A letter opens only when enough witnesses have each sent theirs. Do not share this link.
            </p>
          </div>
        ) : (
          <p className="lede" role="status">
            Ask the author to send the whole link again, including everything after the # sign.
          </p>
        )}
      </section>
    </Shell>
  );
}
