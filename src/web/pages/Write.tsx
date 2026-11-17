import { useEffect, useState, type FormEvent } from 'react';
import { fromBase64Url, groupCode, toBase32 } from '../../core/encoding';
import type { Custody } from '../../core/types';
import type { VaultView } from '../../core/vault';
import { api } from '../lib/api';
import { Link, navigate } from '../lib/router';
import { sealAndStore, type SealedResult } from '../lib/seal';
import { Shell } from '../components/Chrome';
import { Editor } from '../components/Editor';
import { WaxSeal } from '../components/WaxSeal';

export function Write() {
  const [vault, setVault] = useState<VaultView | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [from, setFrom] = useState('');
  const [custody, setCustody] = useState<Custody>('keepsake');
  const [error, setError] = useState('');
  const [sealing, setSealing] = useState(false);
  const [result, setResult] = useState<SealedResult | null>(null);

  useEffect(() => {
    api
      .vault()
      .then((v) => {
        setVault(v);
        setFrom((f) => f || v.author.name.split(' ')[0] || v.author.name);
      })
      .catch(() => navigate('/'));
  }, []);

  const seal = async (e: FormEvent) => {
    e.preventDefault();
    const text = html.replace(/<[^>]*>/g, '').trim();
    if (!text) {
      setError('The page is still blank. Write a few words before sealing.');
      return;
    }
    if (!vault) return;
    setSealing(true);
    setError('');
    try {
      const r = await sealAndStore({
        recipient: { name: recipientName, email: recipientEmail },
        custody,
        content: { title: title.trim(), html, from: from.trim() },
        authorName: vault.author.name,
      });
      // Let the seal finish pressing before the keepsake appears.
      await new Promise((res) => setTimeout(res, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900));
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The wax would not take.');
    } finally {
      setSealing(false);
    }
  };

  if (result) return <Sealed result={result} custody={custody} recipient={recipientName} />;

  return (
    <Shell wide>
      <div className="desk">
        <div className="desk__intro">
          <p className="eyebrow">The writing desk</p>
          <h1 className="display display--md">Write a letter</h1>
          <p className="lede">Write as if they are reading it at the kitchen table. It is encrypted in this browser before it goes anywhere.</p>
          <Link href="/" className="back-link">
            ← Back to the vigil
          </Link>
        </div>

        <form className={`form desk__form ${sealing ? 'desk__form--sealing' : ''}`} onSubmit={seal}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="r-name">For</label>
              <input id="r-name" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Their name" />
            </div>
            <div className="field">
              <label htmlFor="r-email">Their email</label>
              <input
                id="r-email"
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                aria-describedby="r-email-hint"
              />
              <p id="r-email-hint" className="hint">
                Where the one-time link is sent if your candle goes out.
              </p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="l-title">Title (optional, sealed with the letter)</label>
            <input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For when the lights go out" />
          </div>

          <Editor label="Your letter" onChange={setHtml} />

          <div className="field field--signoff">
            <label htmlFor="l-from">Signed</label>
            <input id="l-from" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <fieldset className="custody">
            <legend>Who keeps the other half of the key?</legend>
            <label className={`custody__option ${custody === 'keepsake' ? 'custody__option--on' : ''}`}>
              <input type="radio" name="custody" value="keepsake" checked={custody === 'keepsake'} onChange={() => setCustody('keepsake')} />
              <span className="custody__title">Keepsake custody (recommended)</span>
              <span className="custody__text">
                You give the recipient a keepsake now: a link or a printed code. The vault alone can never read this letter.
              </span>
            </label>
            <label className={`custody__option ${custody === 'vault' ? 'custody__option--on' : ''}`}>
              <input type="radio" name="custody" value="vault" checked={custody === 'vault'} onChange={() => setCustody('vault')} />
              <span className="custody__title">Vault custody (convenient)</span>
              <span className="custody__text">
                The vault holds both halves and puts the key in the release link. Nothing to hand over, but whoever runs the server
                could read this letter.
              </span>
            </label>
          </fieldset>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="desk__seal">
            <button type="submit" className="btn btn--wax btn--large" disabled={sealing} data-testid="seal-letter">
              {sealing ? 'Pressing the wax…' : 'Seal the letter'}
            </button>
            <div className="desk__stamp" aria-hidden="true">
              <WaxSeal size={110} mark={recipientName.trim()[0]?.toUpperCase()} />
            </div>
          </div>
        </form>
      </div>
    </Shell>
  );
}

function Sealed({ result, custody, recipient }: { result: SealedResult; custody: Custody; recipient: string }) {
  const [copied, setCopied] = useState(false);
  const code = groupCode(toBase32(fromBase64Url(result.keepsakeHalf)));
  const mailto = `mailto:?subject=${encodeURIComponent('A keepsake to hold for me')}&body=${encodeURIComponent(
    `Please keep this link somewhere safe. It opens nothing today. If I ever stop checking in, you will receive a letter from me, and this keepsake is the other half of its key.\n\n${result.keepsakeLink}\n\nKeepsake code: ${code}`,
  )}`;

  return (
    <Shell>
      <section className="sealed" aria-labelledby="sealed-title">
        <WaxSeal size={150} mark={recipient.trim()[0]?.toUpperCase()} className="sealed__seal" />
        <h1 id="sealed-title" className="display display--md" data-testid="sealed-title">
          The letter is sealed
        </h1>
        {custody === 'keepsake' ? (
          <>
            <p className="lede">
              Now give {recipient} their keepsake. Without it, this letter cannot be opened by anyone, including us.
            </p>
            <div className="keepsake-card parchment" data-testid="keepsake-card">
              <p className="keepsake-card__eyebrow">A keepsake for {recipient}</p>
              <p className="keepsake-card__code" aria-label="Keepsake code">
                {code}
              </p>
              <label className="sr-only" htmlFor="keepsake-link">
                Keepsake link
              </label>
              <input id="keepsake-link" className="keepsake-card__link" readOnly value={result.keepsakeLink} data-testid="keepsake-link" />
              <div className="keepsake-card__actions">
                <button
                  type="button"
                  className="btn btn--wax btn--small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.keepsakeLink);
                      setCopied(true);
                    } catch {
                      (document.getElementById('keepsake-link') as HTMLInputElement | null)?.select();
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a className="btn btn--ghost btn--small" href={mailto}>
                  Email it from your own account
                </a>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => window.print()}>
                  Print the card
                </button>
              </div>
            </div>
            <p className="hint">
              Send it yourself so it never passes through our servers. This device also remembers it, so you can copy it again from the vigil.
            </p>
          </>
        ) : (
          <p className="lede">The vault holds both halves. If your candle goes out and your witnesses confirm, {recipient} gets a link that opens it.</p>
        )}
        <div className="sealed__actions">
          <a className="btn btn--ghost" href="/write">
            Write another
          </a>
          <Link className="btn btn--wax" href="/" data-testid="back-to-vigil">
            Return to the vigil
          </Link>
        </div>
      </section>
    </Shell>
  );
}
