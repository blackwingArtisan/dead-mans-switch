import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fromBase64Url, groupCode, toBase32 } from '../../core/encoding';
import { findLikelySecrets, htmlToPlainText, newRunbook, runbookHtml, runbookIsBlank, type RunbookSection } from '../../core/runbook';
import type { Custody } from '../../core/types';
import type { VaultView } from '../../core/vault';
import { api } from '../lib/api';
import { Link, navigate } from '../lib/router';
import { sealAndStore, type SealedResult } from '../lib/seal';
import { useFieldErrors, type FieldMessages } from '../lib/validate';
import { Shell } from '../components/Chrome';
import { Editor } from '../components/Editor';
import { FieldError } from '../components/FieldError';
import { KeepsakeQr } from '../components/KeepsakeQr';
import { KeySplit } from '../components/KeySplit';
import { RunbookBuilder } from '../components/RunbookBuilder';
import { SecretWarning } from '../components/SecretWarning';
import { SealCeremony } from '../components/SealCeremony';
import { WaxSeal } from '../components/WaxSeal';

const LETTER_MESSAGES: Record<string, FieldMessages> = {
  'r-name': { missing: 'Who is this letter for?' },
  'r-email': { missing: 'Add their email, so the one-time link can reach them.', type: 'That email does not look complete.' },
};

export function Write() {
  const fields = useFieldErrors(LETTER_MESSAGES);
  const [vault, setVault] = useState<VaultView | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [mode, setMode] = useState<'blank' | 'runbook'>('blank');
  const [sections, setSections] = useState<RunbookSection[]>(newRunbook);
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

  const n = vault?.witnesses.length ?? 0;
  const k = Math.min(vault?.settings.witnessesRequired ?? 1, n);
  const body = mode === 'runbook' ? runbookHtml(sections) : html;
  // The check runs here in the browser on the draft as it stands, and never sends or stores it.
  const findings = useMemo(() => findLikelySecrets(htmlToPlainText(body)), [body]);

  const seal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fields.validate(e)) return;
    const blank = mode === 'runbook' ? runbookIsBlank(sections) : !html.replace(/<[^>]*>/g, '').trim();
    if (blank) {
      setError(
        mode === 'runbook'
          ? 'The page is still blank. Write where one account lives before sealing.'
          : 'The page is still blank. Write a few words before sealing.',
      );
      return;
    }
    if (!vault) return;
    setSealing(true);
    setError('');
    try {
      const r = await sealAndStore({
        recipient: { name: recipientName, email: recipientEmail },
        custody,
        content: { title: title.trim(), html: body, from: from.trim() },
        authorName: vault.author.name,
        ...(custody === 'witnesses' ? { seance: { k, n } } : {}),
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

  if (result) return <Sealed result={result} custody={custody} seance={custody === 'witnesses' ? { k, n } : null} recipient={recipientName} author={vault?.author.name ?? ''} />;

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

        <form className={`form desk__form ${sealing ? 'desk__form--sealing' : ''}`} onSubmit={seal} onInput={fields.onInput} noValidate>
          <div className="field-row">
            <div className="field">
              <label htmlFor="r-name">For</label>
              <input
                id="r-name"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Their name"
                {...fields.aria('r-name')}
              />
              <FieldError id="r-name" errors={fields.errors} />
            </div>
            <div className="field">
              <label htmlFor="r-email">Their email</label>
              <input
                id="r-email"
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                {...fields.aria('r-email', 'r-email-hint')}
              />
              <FieldError id="r-email" errors={fields.errors} />
              <p id="r-email-hint" className="hint">
                Where the one-time link is sent if your candle goes out.
              </p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="l-title">Title (optional, sealed with the letter)</label>
            <input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For when the lights go out" />
          </div>

          <div role="group" aria-label="How to start" className="desk__modes">
            <button type="button" className={`btn btn--small ${mode === 'blank' ? 'btn--wax' : 'btn--ghost'}`} aria-pressed={mode === 'blank'} onClick={() => setMode('blank')}>
              Start from a blank page
            </button>
            <button type="button" className={`btn btn--small ${mode === 'runbook' ? 'btn--wax' : 'btn--ghost'}`} aria-pressed={mode === 'runbook'} onClick={() => setMode('runbook')}>
              Start from the Founder runbook
            </button>
          </div>

          {mode === 'runbook' && <RunbookBuilder sections={sections} onChange={setSections} />}
          <div hidden={mode === 'runbook'}>
            <Editor label="Your letter" onChange={setHtml} />
          </div>
          <SecretWarning findings={findings} />

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
            {n > 0 && (
              <label className={`custody__option ${custody === 'witnesses' ? 'custody__option--on' : ''}`}>
                <input type="radio" name="custody" value="witnesses" checked={custody === 'witnesses'} onChange={() => setCustody('witnesses')} />
                <span className="custody__title">Séance seal (no one opens it alone)</span>
                <span className="custody__text">
                  The vault half is split into {n} shares, one for each witness. Any {k} of them must send theirs when they confirm, and the
                  recipient still needs the keepsake.
                </span>
              </label>
            )}
          </fieldset>
          {custody === 'witnesses' && (
            <div className="hint" data-testid="seance-honesty">
              <p>
                Before enough witnesses confirm, the server holds fewer than {k} shares, so it cannot rebuild the vault half. After they
                confirm it has seen {k}. A stays with the recipient, so the server never has both halves.
              </p>
              <p>You hand each witness a share link yourself, now. The shares never pass through the server when you seal.</p>
              {vault?.settings.silenceReleaseDays != null && (
                <p data-testid="seance-silence">
                  Your silence window will not open this letter: if it releases the vigil by silence, this letter stays sealed because no
                  witness has sent a share. Turn the window off in the terms if you want no release without witnesses.
                </p>
              )}
            </div>
          )}

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

function Sealed({ result, custody, seance, recipient, author }: { result: SealedResult; custody: Custody; seance: { k: number; n: number } | null; recipient: string; author: string }) {
  const authorFirst = author.trim().split(/\s+/)[0] || 'the writer';
  const [copied, setCopied] = useState(false);
  const code = groupCode(toBase32(fromBase64Url(result.keepsakeHalf)));
  const mailto = `mailto:?subject=${encodeURIComponent('A keepsake to hold for me')}&body=${encodeURIComponent(
    `Please keep this link somewhere safe. It opens nothing today. If I ever stop checking in, you will receive a letter from me, and this keepsake is the other half of its key.\n\n${result.keepsakeLink}\n\nKeepsake code: ${code}`,
  )}`;

  // The fold and the pressed seal play at the top of the page; the desk was scrolled down to the
  // Seal button, so bring the ceremony into view and move focus to its heading.
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' });
    document.getElementById('sealed-title')?.focus({ preventScroll: true });
  }, []);

  return (
    <Shell>
      <section className="sealed" aria-labelledby="sealed-title">
        <SealCeremony mark={recipient.trim()[0]?.toUpperCase()} />
        <h1 id="sealed-title" className="display display--md" data-testid="sealed-title" tabIndex={-1}>
          The letter is sealed
        </h1>
        {custody === 'witnesses' && result.shares && seance && (
          <div data-testid="share-links">
            <p className="lede">
              Give each witness their own share link, and give {recipient} the keepsake below. Any {seance.k} of {seance.n} shares rebuild
              the vault half; one alone is noise.
            </p>
            <ul className="share-links">
              {result.shares.map((share, i) => {
                const name = result.vault.witnesses[i]?.name ?? `Witness ${i + 1}`;
                return (
                  <li key={i}>
                    <label htmlFor={`share-link-${i}`}>Share link for {name}</label>
                    <input
                      id={`share-link-${i}`}
                      className="keepsake-card__link"
                      readOnly
                      data-testid="share-link"
                      value={`${window.location.origin}/share#s=${result.letterId}.${share}`}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="hint">Send each one yourself and keep none of them. Whoever holds a share link holds that witness's share.</p>
          </div>
        )}
        {custody !== 'vault' ? (
          <>
            <p className="lede">
              Now give {recipient} their keepsake. Without it, this letter cannot be opened by anyone, including us.
            </p>
            <KeySplit recipient={recipient} custody="keepsake" />
            <div className="keepsake-card parchment" data-testid="keepsake-card">
              <p className="keepsake-card__eyebrow">A keepsake for {recipient}</p>
              <div className="keepsake-card__body">
                <KeepsakeQr value={result.keepsakeLink} label={`QR code of the keepsake link for ${recipient}`} />
                <div>
                  <p className="keepsake-card__code" aria-label="Keepsake code">
                    {code}
                  </p>
                  <p className="keepsake-card__note">
                    Keep this card somewhere safe. It opens nothing today. If {authorFirst} ever stops checking in, you will receive a
                    letter; scan this or type the code to open it.
                  </p>
                </div>
              </div>
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
          <>
            <p className="lede">The vault holds both halves. If your candle goes out and your witnesses confirm, {recipient} gets a link that opens it.</p>
            <KeySplit recipient={recipient} custody="vault" />
          </>
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
