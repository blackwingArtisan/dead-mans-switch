import { useEffect, useState } from 'react';
import { api, type CheckInLinkInfo, type CheckInLinkResult } from '../lib/api';
import { longDate } from '../lib/format';
import { relight, RELIGHT_MS, useRoom } from '../lib/room';
import { LinkNotice } from '../components/Lost';
import { Candle } from '../components/Candle';
import { Shell } from '../components/Chrome';
import { WaxSeal } from '../components/WaxSeal';

/**
 * The page behind the "Check in now" button in the author's emails. Opening it changes nothing;
 * pressing the seal checks in. The link works once and can do nothing else.
 */
export function CheckIn({ token }: { token: string }) {
  const [info, setInfo] = useState<CheckInLinkInfo | null>(null);
  const [done, setDone] = useState<CheckInLinkResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [relighting, setRelighting] = useState(false);
  useRoom(done ? 'alive' : (info?.state ?? null));

  useEffect(() => {
    api.checkInLink(token).then(setInfo, (err) => setError(err instanceof Error ? err.message : 'This link could not be read.'));
  }, [token]);

  const checkIn = async () => {
    setBusy(true);
    try {
      const r = await api.checkInByLink(token);
      relight();
      setRelighting(true);
      window.setTimeout(() => setRelighting(false), RELIGHT_MS + 100);
      setDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check-in could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !info) {
    return (
      <LinkNotice
        title="This link is spent"
        message={error}
        testId="checkin-link-error"
        detail="Each check-in link works once, and any check-in spends every link from that reminder. The next reminder brings a fresh one, or check in from the vigil itself."
      />
    );
  }
  if (!info) {
    return (
      <Shell>
        <p className="loading" role="status">
          Finding your candle…
        </p>
      </Shell>
    );
  }

  const first = info.authorName.split(' ')[0];
  const state = done ? 'alive' : info.state;

  return (
    <Shell>
      <section className="checkin-link" aria-labelledby="checkin-link-title">
        <div className="checkin-link__candle">
          <Candle remaining={done ? 1 : 0.05} state={state} size={240} relighting={relighting} />
        </div>
        <div>
          <p className="eyebrow">The vigil of {info.authorName}</p>
          {done ? (
            <div role="status" data-testid="checkin-link-done">
              <h1 id="checkin-link-title" className="display display--md">
                The candle is lit again
              </h1>
              <p className="lede">
                Thank you, {first}. Nothing will be sent. Your next check-in is due by {longDate(done.nextDueAt)}.
              </p>
              <p className="hint">This link is now spent. The next reminder will bring a new one.</p>
            </div>
          ) : info.state === 'released' ? (
            <>
              <h1 id="checkin-link-title" className="display display--md">
                Your letters have been delivered
              </h1>
              <p className="lede">A released vigil cannot be checked in.</p>
            </>
          ) : (
            <>
              <h1 id="checkin-link-title" className="display display--md">
                Are you still with us, {first}?
              </h1>
              <p className="lede">
                {info.state === 'confirm'
                  ? 'Your witnesses have been asked to confirm. Checking in stops everything and tells them to stand down.'
                  : 'Press the seal to check in. Nothing else happens: this link cannot open your vigil or read your letters.'}
              </p>
              <div className="checkin">
                <button type="button" className="checkin__button" onClick={checkIn} disabled={busy} data-testid="checkin-link-button">
                  <WaxSeal size={120} tone="ember" />
                  <span className="checkin__label">I still walk among the living</span>
                </button>
              </div>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </Shell>
  );
}
