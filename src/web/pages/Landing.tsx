import { useState, type FormEvent } from 'react';
import { api, session } from '../lib/api';
import { navigate } from '../lib/router';
import { DEMO, sealAndStore } from '../lib/seal';
import { Candle } from '../components/Candle';
import { Flourish, Shell } from '../components/Chrome';
import { Comparison, Stakes } from '../components/Comparison';
import { WaxSeal } from '../components/WaxSeal';

export function Landing() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cadence, setCadence] = useState(30);
  const [grace, setGrace] = useState(7);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'create' | 'demo'>('');

  const begin = async (e: FormEvent) => {
    e.preventDefault();
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

  const demo = async () => {
    setBusy('demo');
    setError('');
    try {
      const r = await api.createVault(DEMO.author, { cadenceDays: 30, graceDays: 7, reminderLeadDays: 3, witnessesRequired: 1 });
      session.save(r.ownerToken);
      for (const w of DEMO.witnesses) await api.addWitness(w);
      for (const l of DEMO.letters) await sealAndStore({ ...l, authorName: DEMO.author.name });
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
        <div className="hero__candle">
          <Candle remaining={0.92} state="alive" size={340} />
        </div>
        <div className="hero__copy">
          <p className="eyebrow">A vigil for your last words</p>
          <h1 className="display">Some words should wait.</h1>
          <p className="lede">
            Write letters for the people you love, sealed until you can no longer check in. Keep a candle lit with one
            tap a month. If it ever goes out, your witnesses are asked first, and only then are your letters delivered.
          </p>
          <Stakes />
          <div className="hero__actions">
            <a className="btn btn--wax" href="#begin">
              Begin your vigil
            </a>
            <button type="button" className="btn btn--ghost" onClick={demo} disabled={busy !== ''}>
              {busy === 'demo' ? 'Summoning…' : 'Try a demo vigil'}
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

      <section className="personas" aria-labelledby="personas-title">
        <h2 id="personas-title" className="section-title">
          Two people keeping a vigil
        </h2>
        <div className="personas__grid">
          <article className="persona">
            <h3>Mara, 58</h3>
            <p>
              Mara writes to her son Theo about the deed in the blue tin, and to her best friend June about the cat and the
              password sheet. She checks in once a month from her phone. If she ever stops, her neighbour Ada is asked first.
            </p>
          </article>
          <article className="persona">
            <h3>Priya, solo founder</h3>
            <p>
              Priya is the only person who holds the cloud root account, the domain registrar and the payroll login. Her letter
              to her co-founder says where each recovery code lives. If she goes quiet for two weeks, the company keeps running.
            </p>
          </article>
        </div>
      </section>

      <Comparison headingId="compare-title" />

      <section id="begin" className="panel panel--form" aria-labelledby="begin-title">
        <h2 id="begin-title" className="section-title">
          Light the first candle
        </h2>
        <form className="form" onSubmit={begin}>
          <div className="field">
            <label htmlFor="author-name">Your name</label>
            <input id="author-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
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
              aria-describedby="author-email-hint"
            />
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

