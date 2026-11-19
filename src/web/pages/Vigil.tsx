import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { VaultView } from '../../core/vault';
import { api, ApiError, authored, REFRESH_EVENT, session } from '../lib/api';
import { longDate, relative, shortDate, STAGES, STATE_COPY } from '../lib/format';
import { Link } from '../lib/router';
import { relight, RELIGHT_MS, ROOM_LINE, useRoom } from '../lib/room';
import { keepsakeLinkFor } from '../lib/seal';
import { nextStep, tour, useTour } from '../lib/tour';
import { useFieldErrors, type FieldMessages } from '../lib/validate';
import { Candle } from '../components/Candle';
import { CandlesLit } from '../components/CandlesLit';
import { checkInCalendar, downloadCalendar } from '../lib/calendar';
import { Flourish, Shell } from '../components/Chrome';
import { FieldError } from '../components/FieldError';
import { WaxSeal } from '../components/WaxSeal';

const DAY = 86_400_000;
const TONES = ['oxblood', 'ink', 'verdigris', 'ember', 'gold'] as const;

export function Vigil({ onLost }: { onLost: () => void }) {
  const [vault, setVault] = useState<VaultView | null>(null);
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');
  const [stamping, setStamping] = useState(false);
  const [relighting, setRelighting] = useState(false);
  const lastState = useRef<string | null>(null);
  useRoom(vault?.state ?? null);

  const apply = useCallback((v: VaultView) => {
    if (lastState.current && lastState.current !== v.state) {
      setAnnounce(`${STATE_COPY[v.state].title}. ${STATE_COPY[v.state].plain} ${ROOM_LINE[v.state]}`);
    }
    lastState.current = v.state;
    setVault(v);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api.vault());
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        session.clear();
        onLost();
        return;
      }
      setError(err instanceof Error ? err.message : 'The vault could not be read.');
    }
  }, [apply, onLost]);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, 5000);
    window.addEventListener(REFRESH_EVENT, load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(REFRESH_EVENT, load);
    };
  }, [load]);

  const act = async (fn: () => Promise<VaultView>, said: (v: VaultView) => string) => {
    try {
      const v = await fn();
      apply(v);
      setAnnounce(said(v));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    }
  };

  if (!vault) {
    return (
      <Shell>
        <p className="loading" role="status">
          {error || 'Lighting the candles…'}
        </p>
      </Shell>
    );
  }

  const { schedule, now, state, settings } = vault;
  const remaining = Math.max(0, (schedule.dueAt - now) / (settings.cadenceDays * DAY));
  const copy = STATE_COPY[state];
  const live = state !== 'released';

  const checkIn = async () => {
    setStamping(true);
    window.setTimeout(() => setStamping(false), 1400);
    await act(api.checkIn, (v) => {
      relight();
      setRelighting(true);
      window.setTimeout(() => setRelighting(false), RELIGHT_MS + 100);
      return `Checked in. Your candle is relit and the room is warm again. Next check-in due by ${longDate(v.schedule.dueAt)}.`;
    });
  };

  return (
    <Shell wide>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <Guide
        state={state}
        authorName={vault.author.name}
        witness={vault.witnesses[0]?.name ?? 'your witness'}
        reader={(vault.letters.find((l) => l.custody === 'vault') ?? vault.letters[0])?.recipient.name ?? 'your reader'}
      />

      <section className={`vigil vigil--${state}`} aria-labelledby="vigil-title">
        <div className="vigil__candle">
          <Candle remaining={remaining} state={state} size={380} relighting={relighting} />
        </div>
        <div className="vigil__status">
          <p className="eyebrow">The vigil of {vault.author.name}</p>
          <h1 id="vigil-title" className={`display display--md ${state === 'released' ? 'display--epitaph' : ''}`} data-testid="state-title">
            {copy.title}
          </h1>
          {state === 'released' ? <Epitaph vault={vault} /> : <p className="lede">{copy.plain}</p>}

          {live && state !== 'paused' && (
            <div className="checkin">
              <button
                type="button"
                className={`checkin__button ${stamping ? 'checkin__button--stamp' : ''}`}
                onClick={checkIn}
                data-testid="check-in"
              >
                <WaxSeal size={132} tone={state === 'alive' ? 'oxblood' : 'ember'} />
                <span className="checkin__label">I still walk among the living</span>
                {relighting && (
                  <span className="checkin__sparks" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} style={{ ['--k' as string]: i }} />
                    ))}
                  </span>
                )}
              </button>
              <p className="hint">
                One tap checks you in and relights the candle: {Math.round(365 / settings.cadenceDays)} taps a year.{' '}
                <button
                  type="button"
                  className="btn btn--link btn--inline"
                  data-testid="add-to-calendar"
                  onClick={() =>
                    downloadCalendar(
                      checkInCalendar({
                        dueAt: schedule.dueAt,
                        cadenceDays: settings.cadenceDays,
                        appUrl: `${window.location.origin}/`,
                        now: Date.now(),
                        uid: `${vault.id}-check-in@dead-mans-switch`,
                      }),
                    )
                  }
                >
                  Add it to your calendar
                </button>
              </p>
            </div>
          )}
          <dl className="deadlines" data-testid="deadlines">
            {(state === 'alive' || state === 'reminder') && (
              <div>
                <dt>Next check-in due</dt>
                <dd>
                  {longDate(schedule.dueAt)} <span className="muted">({relative(schedule.dueAt, now)})</span>
                </dd>
              </div>
            )}
            {state === 'grace' && (
              <div>
                <dt>Witnesses will be asked</dt>
                <dd>
                  {longDate(schedule.graceEndsAt)} <span className="muted">({relative(schedule.graceEndsAt, now)})</span>
                </dd>
              </div>
            )}
            {state === 'confirm' && (
              <div>
                <dt>Witness confirmations</dt>
                <dd>
                  {vault.confirmations} of {vault.confirmationsRequired || 'none named'}
                  {schedule.silenceReleaseAt !== null && (
                    <span className="muted"> · release on silence {relative(schedule.silenceReleaseAt, now)}</span>
                  )}
                </dd>
              </div>
            )}
            {state === 'released' && vault.releasedAt !== null && (
              <div>
                <dt>Released</dt>
                <dd>{longDate(vault.releasedAt)}</dd>
              </div>
            )}
            <div>
              <dt>Last check-in</dt>
              <dd>
                {longDate(vault.lastCheckInAt)} <span className="muted">({relative(vault.lastCheckInAt, now)})</span>
              </dd>
            </div>
          </dl>

          {state === 'paused' && (
            <button type="button" className="btn btn--wax btn--large" onClick={() => act(api.resume, () => 'The vigil resumed with a fresh candle.')}>
              Lift the glass and resume
            </button>
          )}
          {live && state !== 'paused' && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => act(api.pause, () => 'The vigil is paused. Nothing will be sent until you resume.')}
            >
              Pause the vigil (travel, hospital stay)
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <ol className="stages" aria-label="Stages of the switch">
        {STAGES.map((s, i) => {
          const at = STAGES.findIndex((x) => x.state === state);
          const status = state === 'paused' ? 'upcoming' : i < at ? 'done' : i === at ? 'current' : 'upcoming';
          return (
            <li key={s.state} className={`stages__step stages__step--${status}`} aria-current={status === 'current' ? 'step' : undefined}>
              <span className="stages__dot" aria-hidden="true" />
              <span className="stages__label">{s.label}</span>
            </li>
          );
        })}
      </ol>

      <Flourish className="divider" />

      <div className="grid">
        <Letters vault={vault} onChange={apply} onError={setError} />
        <Witnesses vault={vault} onChange={apply} />
        <Terms vault={vault} onChange={apply} />
        <Ledger vault={vault} />
      </div>
    </Shell>
  );
}

function Guide({ state, authorName, witness, reader }: { state: VaultView['state']; authorName: string; witness: string; reader: string }) {
  const { on } = useTour();
  if (!on) return null;
  return (
    <div className="guide" role="note" aria-label="Demo guide" data-testid="guide">
      <p className="guide__lead">
        This is {authorName.split(' ')[0]}’s vigil. Skip ahead in time and watch the room die with the candle.
      </p>
      <p className="guide__next">
        <strong>Next:</strong> {nextStep(state, witness, reader)}
      </p>
      <button type="button" className="icon-btn guide__close" aria-label="Dismiss the demo guide" onClick={tour.end}>
        ×
      </button>
    </div>
  );
}

function Letters({ vault, onChange, onError }: { vault: VaultView; onChange: (v: VaultView) => void; onError: (m: string) => void }) {
  const [copied, setCopied] = useState('');
  const live = vault.state !== 'released';
  return (
    <section className="panel panel--letters" aria-labelledby="letters-title">
      <div className="panel__head">
        <h2 id="letters-title" className="section-title">
          Sealed letters
        </h2>
        {live && (
          <Link className="btn btn--wax btn--small" href="/write" data-testid="write-letter">
            Write a letter
          </Link>
        )}
      </div>
      {vault.letters.length === 0 && (
        <p className="empty">No letters yet. Write the first one: it can be a few lines, or the password to the shoebox.</p>
      )}
      <ul className="envelopes">
        {vault.letters.map((l, i) => {
          const half = authored.get(l.id);
          const link = half ? keepsakeLinkFor(l.id, half, vault.author.name, l.recipient.name) : null;
          return (
            <li key={l.id} className="envelope" data-testid="envelope">
              <div className="envelope__flap" aria-hidden="true" />
              <WaxSeal size={58} mark={l.recipient.name.trim()[0]?.toUpperCase()} tone={TONES[i % TONES.length]} cracked={l.openedAt !== null} />
              <div className="envelope__body">
                <p className="envelope__to">For {l.recipient.name}</p>
                <p className="envelope__meta">
                  Sealed {shortDate(l.sealedAt)} ·{' '}
                  <span className={`tag tag--${l.custody}`}>{l.custody === 'keepsake' ? 'Keepsake custody' : 'Vault custody'}</span>
                </p>
                <p className="envelope__meta">
                  {l.openedAt !== null
                    ? `Opened ${shortDate(l.openedAt)}. The vault has forgotten it.`
                    : l.releasedAt !== null
                      ? `Delivered ${shortDate(l.releasedAt)}, not yet opened.`
                      : 'Waiting, unopened.'}
                </p>
                {live && (
                  <div className="envelope__actions">
                    {l.custody === 'keepsake' && link && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(link);
                            setCopied(l.id);
                          } catch {
                            window.prompt('Copy the keepsake link:', link);
                          }
                        }}
                      >
                        {copied === l.id ? 'Keepsake link copied' : 'Copy keepsake link'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost btn--small btn--danger"
                      onClick={async () => {
                        if (!window.confirm(`Burn the letter to ${l.recipient.name}? It cannot be recovered.`)) return;
                        try {
                          onChange(await api.burnLetter(l.id));
                          authored.forget(l.id);
                        } catch (err) {
                          onError(err instanceof Error ? err.message : 'The letter would not burn.');
                        }
                      }}
                    >
                      Burn
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {vault.letters.some((l) => l.openedAt === null) && (
        <div className="letters__keep" data-testid="export">
          <p>
            <strong>If this service ends before you do.</strong> Keep your own sealed copy. Each letter still needs its keepsake to
            open, and <a href="/offline-open.html" download="offline-open.html">this one page</a> opens it with no server at all.
            {vault.letters.some((l) => l.custody === 'vault') &&
              ' Vault-custody letters open from the export alone, so keep it as safely as the letters themselves.'}
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            data-testid="export-letters"
            onClick={async () => {
              try {
                const data = await api.exportSealed();
                const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sealed-letters.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (err) {
                onError(err instanceof Error ? err.message : 'The export could not be made.');
              }
            }}
          >
            Export the sealed letters
          </button>
        </div>
      )}
    </section>
  );
}

const WITNESS_MESSAGES: Record<string, FieldMessages> = {
  'w-name': { missing: 'Name the witness.' },
  'w-email': { missing: 'Add the witness’s email.', type: 'That email does not look complete.' },
};

const TERMS_MESSAGES: Record<string, FieldMessages> = {
  't-cadence': { range: 'Choose between 1 and 365 days.', missing: 'Choose between 1 and 365 days.' },
  't-grace': { range: 'Choose between 1 and 90 days.', missing: 'Choose between 1 and 90 days.' },
  't-lead': { range: 'Choose a lead no longer than the cadence.', missing: 'Choose a lead in days.' },
  't-req': { range: 'Choose between 1 and 10 witnesses.', missing: 'Choose between 1 and 10 witnesses.' },
};

function Witnesses({ vault, onChange }: { vault: VaultView; onChange: (v: VaultView) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const live = vault.state !== 'released';
  const fields = useFieldErrors(WITNESS_MESSAGES);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fields.validate(e)) return;
    try {
      onChange(await api.addWitness({ name, email }));
      setName('');
      setEmail('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The witness could not be named.');
    }
  };

  return (
    <section className="panel" aria-labelledby="witnesses-title">
      <h2 id="witnesses-title" className="section-title">
        Witnesses
      </h2>
      <p className="hint">
        Before anything is released, {vault.settings.witnessesRequired === 1 ? 'one witness' : `${vault.settings.witnessesRequired} witnesses`} must
        confirm. Any witness can stop it.
      </p>
      {vault.witnesses.length === 0 && (
        <p className="warning">
          No witnesses yet.{' '}
          {vault.settings.silenceReleaseDays === null
            ? 'Without one, your letters can never be released.'
            : `Without one, letters release only after ${vault.settings.silenceReleaseDays} days of silence.`}
        </p>
      )}
      <ul className="people">
        {vault.witnesses.map((w) => (
          <li key={w.id} className="people__row">
            <span className="people__who">
              <span className="people__name">{w.name}</span>
              <span className="people__email">{w.email}</span>
            </span>
            {w.asked && <span className={`tag tag--${w.response}`}>{w.response === 'pending' ? 'asked' : w.response}</span>}
            {live && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${w.name} as a witness`}
                onClick={async () => onChange(await api.removeWitness(w.id))}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {live && (
        <form className="form form--inline" onSubmit={add} onInput={fields.onInput} noValidate aria-label="Name a witness">
          <div className="field">
            <label htmlFor="w-name">Name</label>
            <input id="w-name" required value={name} onChange={(e) => setName(e.target.value)} {...fields.aria('w-name')} />
            <FieldError id="w-name" errors={fields.errors} />
          </div>
          <div className="field">
            <label htmlFor="w-email">Email</label>
            <input id="w-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...fields.aria('w-email')} />
            <FieldError id="w-email" errors={fields.errors} />
          </div>
          <button type="submit" className="btn btn--ghost">
            Name witness
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function Terms({ vault, onChange }: { vault: VaultView; onChange: (v: VaultView) => void }) {
  const s = vault.settings;
  const [form, setForm] = useState({
    cadenceDays: s.cadenceDays,
    graceDays: s.graceDays,
    reminderLeadDays: s.reminderLeadDays,
    witnessesRequired: s.witnessesRequired,
    silence: s.silenceReleaseDays !== null,
    silenceReleaseDays: s.silenceReleaseDays ?? 14,
  });
  const [msg, setMsg] = useState('');
  const live = vault.state !== 'released';
  const fields = useFieldErrors(TERMS_MESSAGES);
  const num = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: Number(e.target.value) });

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fields.validate(e)) return;
    try {
      onChange(
        await api.settings({
          cadenceDays: form.cadenceDays,
          graceDays: form.graceDays,
          reminderLeadDays: form.reminderLeadDays,
          witnessesRequired: form.witnessesRequired,
          silenceReleaseDays: form.silence ? form.silenceReleaseDays : null,
        }),
      );
      setMsg('The terms are set.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'The terms could not be saved.');
    }
  };

  return (
    <section className="panel" aria-labelledby="terms-title">
      <h2 id="terms-title" className="section-title">
        Terms of the vigil
      </h2>
      <form className="form terms" onSubmit={save} onInput={fields.onInput} noValidate>
        <fieldset disabled={!live}>
          <legend className="sr-only">Timing and witnesses</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor="t-cadence">Check in every (days)</label>
              <input id="t-cadence" type="number" min={1} max={365} value={form.cadenceDays} onChange={num('cadenceDays')} {...fields.aria('t-cadence')} />
              <FieldError id="t-cadence" errors={fields.errors} />
            </div>
            <div className="field">
              <label htmlFor="t-grace">Grace period (days)</label>
              <input id="t-grace" type="number" min={1} max={90} value={form.graceDays} onChange={num('graceDays')} {...fields.aria('t-grace')} />
              <FieldError id="t-grace" errors={fields.errors} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="t-lead">First reminder (days before)</label>
              <input id="t-lead" type="number" min={0} max={form.cadenceDays} value={form.reminderLeadDays} onChange={num('reminderLeadDays')} {...fields.aria('t-lead')} />
              <FieldError id="t-lead" errors={fields.errors} />
            </div>
            <div className="field">
              <label htmlFor="t-req">Witnesses who must confirm</label>
              <input id="t-req" type="number" min={1} max={10} value={form.witnessesRequired} onChange={num('witnessesRequired')} {...fields.aria('t-req')} />
              <FieldError id="t-req" errors={fields.errors} />
            </div>
          </div>
          <div className="field field--check">
            <input id="t-silence" type="checkbox" checked={form.silence} onChange={(e) => setForm({ ...form, silence: e.target.checked })} />
            <label htmlFor="t-silence">
              If no witness answers, release after{' '}
              <input
                aria-label="Silence window in days"
                className="input--tiny"
                type="number"
                min={1}
                max={365}
                value={form.silenceReleaseDays}
                disabled={!form.silence}
                onChange={num('silenceReleaseDays')}
              />{' '}
              days of silence
            </label>
          </div>
          <button type="submit" className="btn btn--ghost">
            Set the terms
          </button>
          <p className="hint" role="status">
            {msg}
          </p>
        </fieldset>
      </form>
    </section>
  );
}

function Ledger({ vault }: { vault: VaultView }) {
  return (
    <section className="panel panel--ledger" aria-labelledby="ledger-title">
      <h2 id="ledger-title" className="section-title">
        The ledger
      </h2>
      <ol className="ledger">
        {vault.history.map((h, i) => (
          <li key={`${h.at}-${i}`} className={`ledger__row ledger__row--${h.kind}`}>
            <time dateTime={new Date(h.at).toISOString()}>{shortDate(h.at)}</time>
            <span>{h.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A released vigil reads like a stone: the dates it was kept, and what it delivered. */
function Epitaph({ vault }: { vault: VaultView }) {
  const began = Math.min(vault.lastCheckInAt, ...vault.history.map((h) => h.at), ...vault.letters.map((l) => l.sealedAt));
  const delivered = vault.letters.filter((l) => l.releasedAt !== null).length;
  const opened = vault.letters.filter((l) => l.openedAt !== null).length;
  return (
    <div className="epitaph" data-testid="epitaph">
      <p className="epitaph__dates">
        Kept from {longDate(began)} to {vault.releasedAt !== null ? longDate(vault.releasedAt) : 'today'}
      </p>
      <p className="epitaph__words">
        {delivered === 1 ? 'One letter' : `${delivered} letters`} delivered · {opened === 0 ? 'none opened yet' : `${opened} opened`}
      </p>
      <p className="epitaph__line">Your witnesses confirmed, and each recipient received a one-time link.</p>
      <CandlesLit
        testId="epitaph-candles"
        candles={vault.letters
          .filter((l) => l.candle)
          .map((l) => ({ from: l.recipient.name, line: l.candle!.line, at: l.candle!.at }))
          .sort((a, b) => a.at - b.at)}
      />
    </div>
  );
}
