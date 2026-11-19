import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { api, session } from '../lib/api';
import { navigate } from '../lib/router';
import { DEMO, FOUNDER_DEMO, sealAndStore } from '../lib/seal';
import { playStory, useStoryAvailable } from '../lib/story';
import { tour } from '../lib/tour';
import { useFieldErrors, type FieldMessages } from '../lib/validate';
import { Candle } from '../components/Candle';
import { Flourish, Shell } from '../components/Chrome';
import { ComparisonTeaser, MARKET, Stakes } from '../components/Comparison';
import { FieldError } from '../components/FieldError';
import { WaxSeal } from '../components/WaxSeal';

const BEGIN_MESSAGES: Record<string, FieldMessages> = {
  'author-name': { missing: 'Write your name, as your witnesses and recipients know you.' },
  'author-email': { missing: 'Add an email for your reminders.', type: 'That email does not look complete. Check it for an @ and a domain.' },
};

/**
 * The landing candle answers the visitor: the flame leans toward the pointer and its glow follows,
 * scrolling down the page burns the wax down, and a click snuffs it and strikes it alight again.
 * Decorative only; under reduced motion the flame stays upright.
 */
function HeroCandle() {
  const ref = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(0.92);
  const [snuffed, setSnuffed] = useState(false);
  const [relighting, setRelighting] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        setRemaining(0.92 - 0.7 * Math.min(1, window.scrollY / max));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const lean = (e: globalThis.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const dx = (e.clientX - (box.left + box.width / 2)) / Math.max(240, window.innerWidth / 3);
      el.style.setProperty('--lean', `${(Math.max(-1, Math.min(1, dx)) * 14).toFixed(1)}deg`);
      el.style.setProperty('--glow-x', `${Math.round(e.clientX)}px`);
      el.style.setProperty('--glow-y', `${Math.round(e.clientY)}px`);
    };
    window.addEventListener('pointermove', lean, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', lean);
    };
  }, []);

  const snuff = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || snuffed) return;
    setSnuffed(true);
    window.setTimeout(() => {
      setSnuffed(false);
      setRelighting(true);
      window.setTimeout(() => setRelighting(false), 950);
    }, 1400);
  };

  return (
    <div ref={ref} className="hero__candle" aria-hidden="true" onPointerDown={snuff} data-testid="hero-candle">
      <Candle remaining={remaining} state={snuffed ? 'confirm' : 'alive'} size={340} relighting={relighting} />
    </div>
  );
}

export function Landing() {
  const fields = useFieldErrors(BEGIN_MESSAGES);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cadence, setCadence] = useState(30);
  const [grace, setGrace] = useState(7);
  const [error, setError] = useState('');
  const storyAvailable = useStoryAvailable();
  const [busy, setBusy] = useState<'' | 'create' | 'demo' | 'founder'>('');

  const begin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fields.validate(e)) return;
    setBusy('create');
    setError('');
    try {
      const r = await api.createVault({ name, email }, { cadenceDays: cadence, graceDays: grace });
      session.save(r.ownerToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The candle would not light.');
    } finally {
      setBusy('');
    }
  };

  const demo = async (which: typeof DEMO, label: 'demo' | 'founder') => {
    setBusy(label);
    setError('');
    try {
      // A fresh demo starts with an empty outbox, so an earlier run's mail never sits above this one's.
      // Without the time machine (a real deployment) there is no outbox route, and nothing to clear.
      await api.dev.clearOutbox().catch(() => undefined);
      const r = await api.createVault(which.author, { cadenceDays: 30, graceDays: 7, reminderLeadDays: 3, witnessesRequired: 1 });
      session.save(r.ownerToken);
      for (const w of which.witnesses) await api.addWitness(w);
      for (const l of which.letters) await sealAndStore({ ...l, authorName: which.author.name });
      tour.start();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The demo vigil could not be summoned.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Shell>
      <section className="hero">
        <HeroCandle />
        <div className="hero__copy">
          <p className="eyebrow">A vigil for your last words</p>
          <h1 className="display">Some words should wait.</h1>
          <p className="lede">
            Not an account handover. A letter, in your words, that nobody (not even us) can open until the people you trust
            agree you are gone. Keep a candle lit with one tap a month; if it ever goes out, your witnesses are asked first.
          </p>
          <Stakes />
          <div className="hero__actions">
            <a className="btn btn--wax" href="#begin">
              Begin your vigil
            </a>
            <button type="button" className="btn btn--ghost" onClick={() => demo(DEMO, 'demo')} disabled={busy !== ''}>
              {busy === 'demo' ? 'Summoning…' : 'Try a demo vigil'}
            </button>
            {storyAvailable && (
              <button type="button" className="btn btn--ghost" onClick={() => void playStory()} disabled={busy !== ''} data-testid="play-story">
                ▶ Play the whole story (40 s)
              </button>
            )}
            <button type="button" className="btn btn--link" onClick={() => demo(FOUNDER_DEMO, 'founder')} disabled={busy !== ''}>
              {busy === 'founder' ? 'Summoning…' : 'or a founder’s vigil'}
            </button>
          </div>
          {error && busy === '' && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <Flourish className="divider" />

      <section className="rite" aria-labelledby="rite-title">
        <h2 id="rite-title" className="section-title">
          The rite, in three parts
        </h2>
        <ol className="rite__steps">
          <li className="rite__step">
            <WaxSeal size={72} mark="I" />
            <h3>Write and seal</h3>
            <p>Each letter is encrypted in your browser. The vault keeps half a key; the other half is a keepsake you give your recipient.</p>
          </li>
          <li className="rite__step">
            <WaxSeal size={72} mark="II" tone="ember" />
            <h3>Keep the candle lit</h3>
            <p>Check in on your own cadence with one tap: “I still walk among the living.” Reminders come before the deadline and during a grace period.</p>
          </li>
          <li className="rite__step">
            <WaxSeal size={72} mark="III" tone="ink" />
            <h3>Witnesses, then letters</h3>
            <p>If the candle goes out, people you trust confirm first, so a lost phone never becomes a false alarm. Then each letter opens once, in its reader’s browser.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="rooms-title">
        <h2 id="rooms-title" className="section-title">
          One candle, three rooms
        </h2>
        <ul className="rooms-strip" data-testid="rooms-strip">
          <li className="rooms-strip__alive">
            <Candle remaining={0.8} state="alive" size={150} />
            <strong>Lit</strong>
            <span>You checked in. Nothing will be sent.</span>
          </li>
          <li className="rooms-strip__grace">
            <Candle remaining={0.05} state="grace" size={150} />
            <strong>Guttering</strong>
            <span>A check-in was missed. Reminders keep coming.</span>
          </li>
          <li className="rooms-strip__confirm">
            <Candle remaining={0} state="confirm" size={150} />
            <strong>Out</strong>
            <span>Your witnesses are asked. Any one can stop it.</span>
          </li>
        </ul>
      </section>

      <section className="personas" aria-labelledby="personas-title">
        <h2 id="personas-title" className="section-title">
          Who keeps a vigil
        </h2>
        <div className="personas__grid">
          <article className="persona">
            <h3>Mara, 58</h3>
            <p>
              Mara writes to her son Theo about the deed in the blue tin, and to her best friend June about the cat and the
              password sheet. She checks in once a month from her phone. If she ever stops, her neighbour Ada is asked first.
            </p>
            <p className="persona__plan">Free: one vigil and a few letters.</p>
          </article>
          <article className="persona">
            <h3>Priya, solo founder</h3>
            <p>
              Priya is the only person who holds the cloud root account, the domain registrar and the payroll login. Then she is in
              hospital for three weeks and payroll is due on Friday. Her accountant, her witness, confirms she cannot check in, and her
              co-founder opens the letter that says where each recovery code lives. The company keeps running.
            </p>
            <p className="persona__plan">Teams plan: $4 a seat a month, bought by the founder or an ops lead.</p>
          </article>
          <article className="persona">
            <h3>Ruth, hospice social worker</h3>
            <p>
              Ruth has the hardest conversation of a family’s life every week. Now she can hand them something: a printed keepsake kit,
              one card per person, so a mother can seal her last letters before she is too tired to write them.
            </p>
            <p className="persona__plan">Keepsake plan: $39 once, with the printed kit.</p>
          </article>
        </div>
        <p className="personas__pricing">The paid plans are planned for after Kiroween; today every vigil is free.</p>
        <p className="personas__market">
          <span className="stakes__figure">{MARKET.figure}</span> {MARKET.text}{' '}
          <a href={MARKET.href} target="_blank" rel="noopener noreferrer" className="stakes__source">
            ({MARKET.source})
          </a>
        </p>
      </section>

      <ComparisonTeaser />

      <section id="begin" className="panel panel--form" aria-labelledby="begin-title">
        <h2 id="begin-title" className="section-title">
          Light the first candle
        </h2>
        <form className="form" onSubmit={begin} onInput={fields.onInput} noValidate>
          <div className="field">
            <label htmlFor="author-name">Your name</label>
            <input id="author-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} {...fields.aria('author-name')} />
            <FieldError id="author-name" errors={fields.errors} />
          </div>
          <div className="field">
            <label htmlFor="author-email">Your email</label>
            <input
              id="author-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              {...fields.aria('author-email', 'author-email-hint')}
            />
            <FieldError id="author-email" errors={fields.errors} />
            <p id="author-email-hint" className="hint">
              Reminders go here. Use one you will still read in a year.
            </p>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="cadence">Check in every</label>
              <select id="cadence" value={cadence} onChange={(e) => setCadence(Number(e.target.value))}>
                {[7, 14, 30, 60, 90, 180].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="grace">Grace period</label>
              <select id="grace" value={grace} onChange={(e) => setGrace(Number(e.target.value))}>
                {[3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && busy === '' && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--wax btn--large" disabled={busy !== ''}>
            {busy === 'create' ? 'Lighting…' : 'Light the candle'}
          </button>
          <p className="hint">No password. This device holds your vault key, so begin on a device you keep.</p>
        </form>
      </section>
    </Shell>
  );
}

