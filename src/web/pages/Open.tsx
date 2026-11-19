import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { keepsakeTagOf, openLetter } from '../../core/crypto';
import { fromBase32, toBase64Url } from '../../core/encoding';
import type { LetterContent } from '../../core/types';
import { api, keepsakes, type OpenInfo } from '../lib/api';
import { longDate } from '../lib/format';
import { useRoom } from '../lib/room';
import { sound } from '../lib/sound';
import { tour } from '../lib/tour';
import { Shell } from '../components/Chrome';
import { WaxSeal } from '../components/WaxSeal';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'div', 'span'];

/** Accepts a whole keepsake link, a bare base64url half, or a printed base32 code. */
export function parseKeepsake(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fragment = text.includes('#') ? text.slice(text.indexOf('#') + 1) : null;
  if (fragment) {
    const k = new URLSearchParams(fragment).get('k');
    if (k) return k;
  }
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) return text;
  try {
    return toBase64Url(fromBase32(text, 32));
  } catch {
    return null;
  }
}

function download(content: LetterContent, info: OpenInfo, safeHtml: string): void {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(content.title || `A letter from ${info.authorName}`)}</title>
<style>body{font-family:Georgia,serif;max-width:640px;margin:48px auto;padding:0 20px;line-height:1.7;color:#2b1d12;background:#f4ead4}h1{font-weight:normal}blockquote{border-left:3px solid #8e1b1b;margin-left:0;padding-left:16px;font-style:italic}.from{margin-top:40px;font-style:italic}</style></head>
<body><h1>${escape(content.title || `A letter from ${info.authorName}`)}</h1>${safeHtml}<p class="from">${escape(content.from || info.authorName)}</p>
<p style="color:#7a6a55;font-size:13px;margin-top:48px">Sealed ${escape(longDate(info.sealedAt))}. Opened ${escape(longDate(Date.now()))}.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `letter-from-${info.authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function Open({ token, hash }: { token: string; hash: string }) {
  const fromLink = useMemo(() => new URLSearchParams(hash.replace(/^#/, '')).get('k'), [hash]);
  const [info, setInfo] = useState<OpenInfo | null>(null);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const [half, setHalf] = useState<string | null>(fromLink);
  const [stage, setStage] = useState<'sealed' | 'breaking' | 'open'>('sealed');
  const [letter, setLetter] = useState<LetterContent | null>(null);

  useEffect(() => {
    // Keep the key half out of browser history once it has been read.
    if (fromLink) window.history.replaceState({}, '', window.location.pathname);
    api.openInfo(token).then(
      (i) => {
        setInfo(i);
        if (fromLink) keepsakes.save(i.letterId, fromLink);
        else {
          const remembered = keepsakes.get(i.letterId);
          if (remembered) setHalf(remembered);
        }
      },
      (err) => setError(err instanceof Error ? err.message : 'This link could not be read.'),
    );
  }, [token, fromLink]);

  const safeHtml = useMemo(
    () => (letter ? DOMPurify.sanitize(letter.html, { ALLOWED_TAGS, ALLOWED_ATTR: [] }) : ''),
    [letter],
  );

  const breakSeal = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!info) return;
    setError('');
    const k = half ?? parseKeepsake(typed);
    if (!k) {
      setError('That does not look like a keepsake. Paste the whole keepsake link, or type the code exactly as printed.');
      return;
    }
    if (info.keepsakeTag && (await keepsakeTagOf(k)) !== info.keepsakeTag) {
      setError('That keepsake belongs to a different letter. Nothing has been opened, so you can try another.');
      setHalf(null);
      return;
    }
    setStage('breaking');
    sound.crack();
    try {
      const sealed = await api.breakSeal(token);
      const content = await openLetter(sealed.letterId, sealed, k);
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      await new Promise((r) => setTimeout(r, reduce ? 0 : 1300));
      setLetter(content);
      setStage('open');
    } catch (err) {
      setStage('sealed');
      setError(err instanceof Error ? err.message : 'The seal would not break.');
    }
  };

  if (!info) {
    return (
      <Shell>
        {error ? (
          <section className="notice">
            <WaxSeal size={96} tone="ink" cracked />
            <h1 className="display display--md">This link is not valid</h1>
            <p className="lede">{error}</p>
          </section>
        ) : (
          <p className="loading" role="status">
            Fetching the envelope…
          </p>
        )}
      </Shell>
    );
  }

  if (stage === 'open' && letter) return <OpenedLetter info={info} letter={letter} safeHtml={safeHtml} />;

  if (info.opened) {
    return (
      <Shell>
        <section className="notice">
          <WaxSeal size={110} cracked mark={info.authorName.trim()[0]} />
          <h1 className="display display--md">This seal has already been broken</h1>
          <p className="lede">
            The letter from {info.authorName} was opened on {info.openedAt ? longDate(info.openedAt) : 'an earlier day'}. Each letter opens
            once, and the vault forgot its copy afterwards. If you saved or printed it then, that copy is the letter.
          </p>
        </section>
      </Shell>
    );
  }

  const needsKeepsake = info.custody === 'keepsake' && !half;

  return (
    <Shell>
      <section className={`envelope-stage envelope-stage--${stage}`} aria-labelledby="open-title">
        <div className="big-envelope" aria-hidden="true">
          <div className="big-envelope__back" />
          <div className="big-envelope__flap" />
          <div className="big-envelope__seal">
            <WaxSeal size={120} mark={info.authorName.trim()[0]} cracked={stage === 'breaking'} />
          </div>
        </div>
        <p className="eyebrow">For {info.recipientName}</p>
        <h1 id="open-title" className="display display--md">
          A letter from {info.authorName}
        </h1>
        <p className="lede">
          Sealed {longDate(info.sealedAt)}. {info.authorName.split(' ')[0]} asked that it reach you only if they could no longer check in.
          We are sorry to be the ones to bring it.
        </p>

        <form className="form open-form" onSubmit={breakSeal}>
          {needsKeepsake ? (
            <div className="field">
              <label htmlFor="keepsake-input">Your keepsake</label>
              <input
                id="keepsake-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Paste the keepsake link, or type the code"
                aria-describedby="keepsake-hint"
                autoComplete="off"
                spellCheck={false}
              />
              <p id="keepsake-hint" className="hint">
                {info.authorName.split(' ')[0]} gave you a keepsake ahead of time: a link, or a code on a printed card. It is the other
                half of this letter’s key.
              </p>
            </div>
          ) : (
            <p className="hint" data-testid="keepsake-ready">
              {info.custody === 'vault' ? 'This link carries its own key.' : 'Your keepsake was found on this device.'} The letter is
              decrypted here, in your browser.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--wax btn--large" disabled={stage === 'breaking'} data-testid="break-seal">
            {stage === 'breaking' ? 'The wax gives way…' : 'Break the seal'}
          </button>
          <p className="hint">The link opens once. When the letter appears, save a copy.</p>
        </form>
      </section>
    </Shell>
  );
}

/**
 * "Read by their last candle": the opened letter starts in darkness and a circle of candlelight
 * follows the pointer or finger to reveal it; the signature writes itself in ink once the light
 * reaches it. The text is always in the page for assistive technology, "Light the room" shows it
 * all at once, and under reduced motion the letter simply opens fully lit.
 */
/** How long the letter takes to burn when motion is allowed. */
const BURN_MS = 3400;

function OpenedLetter({ info, letter, safeHtml }: { info: OpenInfo; letter: LetterContent; safeHtml: string }) {
  const [dark, setDark] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  // "Let it go": the parchment chars from the edges and the words fade to ash, then only a notice is left.
  const [fate, setFate] = useState<'kept' | 'burning' | 'ash'>('kept');
  const [signed, setSigned] = useState(!dark);
  const pageRef = useRef<HTMLDivElement>(null);
  const signRef = useRef<HTMLParagraphElement>(null);
  // A letter opened during the demo guide is the end of the story; the guide closes here.
  const [storyDone] = useState(() => tour.isOn());
  useEffect(() => {
    if (storyDone) tour.end();
  }, [storyDone]);
  useRoom('released');

  const follow = (e: PointerEvent<HTMLDivElement>) => {
    if (!dark) return;
    const page = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - page.left;
    const y = e.clientY - page.top;
    e.currentTarget.style.setProperty('--x', `${Math.round(x)}px`);
    e.currentTarget.style.setProperty('--y', `${Math.round(y)}px`);
    const sign = signRef.current?.getBoundingClientRect();
    if (!signed && sign && e.clientY > sign.top - 120) setSigned(true);
  };

  const lightRoom = () => {
    setDark(false);
    setSigned(true);
  };

  const letItGo = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setDark(false);
    setFate('burning');
    window.setTimeout(() => setFate('ash'), reduce ? 0 : BURN_MS);
  };

  if (fate === 'ash') {
    return (
      <Shell>
        <section className="notice ash" aria-labelledby="ash-title" data-testid="ash">
          <WaxSeal size={96} cracked mark={info.authorName.trim()[0]} />
          <h1 id="ash-title" className="display display--md" tabIndex={-1} ref={(el) => el?.focus()}>
            It is ash now
          </h1>
          <p className="lede">
            The vault has forgotten its copy, and so has this page. If you kept or printed the letter from {info.authorName}, that copy
            is the only one.
          </p>
          <p role="status" className="sr-only">
            The letter has burned to ash.
          </p>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <article className="letter" aria-labelledby="letter-title" data-testid="opened-letter">
        <div className="letter__seal-halves" aria-hidden="true">
          <WaxSeal size={84} cracked mark={info.authorName.trim()[0]} />
        </div>
        <div
          ref={pageRef}
          className={`letter__page parchment ${dark ? 'letter__page--dark' : 'letter__page--lit'} ${fate === 'burning' ? 'letter__page--burning' : ''}`}
          onPointerMove={follow}
          onPointerDown={follow}
          data-testid="letter-page"
        >
          <p className="letter__eyebrow">
            From {info.authorName} · sealed {longDate(info.sealedAt)}
          </p>
          <h1 id="letter-title" className="letter__title">
            {letter.title || `For ${info.recipientName}`}
          </h1>
          <div className="letter__body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          {letter.from && (
            <p ref={signRef} className={`letter__from ${signed ? 'letter__from--signed' : ''}`}>
              {letter.from}
            </p>
          )}
          <div className="letter__shade" aria-hidden="true" />
          <div className="letter__flame" aria-hidden="true" />
          <div className="letter__char" aria-hidden="true" />
        </div>
        <div className="letter__after">
          {dark ? (
            <p className="hint" data-testid="candle-hint">
              Read by their last candle: move your cursor or finger over the page.{' '}
              <button type="button" className="btn btn--ghost btn--small" onClick={lightRoom} data-testid="light-room">
                Light the room
              </button>
            </p>
          ) : null}
          {storyDone && (
            <p className="story-done" data-testid="story-done">
              The story is complete. That is the whole vigil, from a lit candle to a letter read.
            </p>
          )}
          <p className="hint">This link opened once. The vault has now forgotten its copy, so keep your own.</p>
          <div className="letter__actions">
            <button type="button" className="btn btn--wax" onClick={() => download(letter, info, safeHtml)}>
              Keep this letter (download)
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
              Print
            </button>
          </div>
          <p className="hint letter__release">
            Kept a copy? Then, if you wish, let this one go.{' '}
            <button type="button" className="btn btn--ghost btn--small" onClick={letItGo} disabled={fate !== 'kept'} data-testid="let-it-go">
              {fate === 'burning' ? 'Burning…' : 'Let it go'}
            </button>
          </p>
        </div>
      </article>
    </Shell>
  );
}
