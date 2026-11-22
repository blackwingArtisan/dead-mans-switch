import { LinkNotice } from '../components/Lost';
import { useEffect, useState } from 'react';
import { api, type WitnessInfo } from '../lib/api';
import { longDate } from '../lib/format';
import { Shell } from '../components/Chrome';
import { DriftingEnvelopes } from '../components/SealCeremony';
import { WaxSeal } from '../components/WaxSeal';

const NOTE_MAX = 200;

export function Witness({ token }: { token: string }) {
  const [info, setInfo] = useState<WitnessInfo | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'confirmed' | 'denied'>('');
  const [released, setReleased] = useState(false);
  const [asking, setAsking] = useState<'' | 'confirm'>('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    api.witness(token).then(setInfo, (err) => setError(err instanceof Error ? err.message : 'This link could not be read.'));
  }, [token]);

  const answer = async (response: 'confirm' | 'deny') => {
    setBusy(true);
    try {
      const r = await api.witnessRespond(token, response, response === 'deny' ? note.trim() : undefined);
      setDone(response === 'confirm' ? 'confirmed' : 'denied');
      setReleased(r.state === 'released');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your answer could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !info) {
    return (
      <LinkNotice
        title="Nothing to answer"
        message={error}
        testId="witness-link-error"
        detail="A witness link is needed only while a vigil waits for its witnesses. If the author checked in, or enough witnesses have already answered, there is nothing left to do."
      />
    );
  }
  if (!info) {
    return (
      <Shell>
        <p className="loading" role="status">
          Reading the summons…
        </p>
      </Shell>
    );
  }

  const first = info.authorName.split(' ')[0];

  return (
    <Shell>
      <section className="witness" aria-labelledby="witness-title">
        <div className="witness__seal">
          <WaxSeal
            key={done || 'waiting'}
            size={110}
            tone={done === 'denied' ? 'verdigris' : 'ink'}
            mark={info.authorName.trim()[0]}
            className={done ? 'seal-press' : ''}
          />
          {done === 'confirmed' && released && <DriftingEnvelopes />}
        </div>
        <p className="eyebrow">A summons for {info.witnessName}</p>
        <h1 id="witness-title" className="display display--md">
          {info.authorName} named you a witness
        </h1>

        {done ? (
          <div className="witness__done" role="status" data-testid="witness-done">
            {done === 'confirmed' ? (
              <>
                <p className="lede">Thank you. We are sorry for your loss.</p>
                <p>
                  {released
                    ? `${first}'s letters have now been delivered to the people they wrote to.`
                    : `Your confirmation is recorded. ${first}'s letters will be released once enough witnesses agree.`}
                </p>
              </>
            ) : (
              <>
                <p className="lede">The release is stopped.</p>
                <p>
                  Thank you for watching over {first}. We have asked them to check in, and nothing will be sent while a new grace
                  period runs.
                </p>
              </>
            )}
          </div>
        ) : info.state !== 'confirm' || info.response !== 'pending' ? (
          <p className="lede">Nothing is needed from you right now. Thank you for watching over {first}.</p>
        ) : (
          <>
            <p className="lede">
              {first} keeps sealed letters for the people they love, to be delivered only if they can no longer check in. Their last
              check-in was on {longDate(info.lastCheckInAt)}, and their grace period has ended.
            </p>
            <p>
              Before anything is released, we need someone who knows {first} to tell us. {info.confirmationsRequired > 1 && `${info.confirmationsRequired} witnesses must agree; ${info.confirmations} have so far.`} If
              {' '}{first} is alive and well, stop the release: they will be asked to check in.
            </p>
            {asking === 'confirm' ? (
              <div className="witness__confirm" role="group" aria-labelledby="are-you-sure">
                <p id="are-you-sure" className="witness__sure">
                  Are you sure? Once enough witnesses confirm, the letters are delivered and this cannot be undone.
                </p>
                <div className="witness__actions">
                  <button type="button" className="btn btn--wax" disabled={busy} onClick={() => answer('confirm')} data-testid="witness-confirm-final">
                    Yes, release the letters
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setAsking('')}>
                    Go back
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div className="field witness__note">
                <label htmlFor="witness-note">A note for {first} (optional)</label>
                <input
                  id="witness-note"
                  data-testid="witness-note"
                  maxLength={NOTE_MAX}
                  autoComplete="off"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  aria-describedby="witness-note-hint"
                />
                <p id="witness-note-hint" className="hint">
                  Sent with the email that asks {first} to check in, only if you press “{first} still lives”. Up to {NOTE_MAX} characters.
                </p>
              </div>
              <div className="witness__actions">
                <button type="button" className="btn btn--wax" disabled={busy} onClick={() => setAsking('confirm')} data-testid="witness-confirm">
                  I confirm {first} has passed away or can no longer check in
                </button>
                <button type="button" className="btn btn--living" disabled={busy} onClick={() => answer('deny')} data-testid="witness-deny">
                  {first} still lives: stop the release
                </button>
              </div>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </Shell>
  );
}
