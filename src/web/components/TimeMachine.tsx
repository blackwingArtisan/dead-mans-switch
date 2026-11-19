import { useCallback, useEffect, useRef, useState } from 'react';
import { api, REFRESH_EVENT, requestRefresh, type ClockInfo, type OutboxMessage } from '../lib/api';
import { longDate, relative, shortDate } from '../lib/format';
import { tour, useTour } from '../lib/tour';

const DAY = 86_400_000;

const KIND_LABEL: Record<string, string> = {
  'witness-named': 'Witness named',
  reminder: 'Reminder',
  grace: 'Grace',
  'last-call': 'Last call',
  'witness-ask': 'Witness asked',
  'witnesses-asked': 'Author notice',
  'stand-down': 'Stand down',
  denied: 'Release stopped',
  release: 'Letter released',
};

/** Splits plain text into text and link parts so outbox links are clickable. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="outbox__link">
            {p.replace(/^https?:\/\/[^/]+/, '')}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/**
 * Local demo only: moves the server clock forward and shows the mail that would have
 * been sent. It does not render at all when the server has no dev tools.
 */
export function TimeMachine() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState<ClockInfo | null>(null);
  const [mail, setMail] = useState<OutboxMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const guide = useTour();

  const load = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([api.dev.clock(), api.dev.outbox()]);
      setClock(c);
      setMail(o.messages);
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, 4000);
    window.addEventListener(REFRESH_EVENT, load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(REFRESH_EVENT, load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    tour.markOpened();
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!available) return null;

  const travel = async (body: Parameters<typeof api.dev.travel>[0], label: string) => {
    setBusy(true);
    try {
      const r = await api.dev.travel(body);
      setClock(r);
      const sent = r.tick.emails;
      setNote(`${label}. It is now ${longDate(r.now)}. ${sent ? `${sent} new email${sent === 1 ? '' : 's'} in the outbox.` : 'No new mail.'}`);
      requestRefresh();
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'The time machine jammed.');
    } finally {
      setBusy(false);
    }
  };

  const offsetDays = clock ? Math.round(clock.offsetMs / DAY) : 0;
  const unread = mail.length;

  return (
    <>
      <button
        type="button"
        className={`tm-toggle ${guide.on && !guide.opened ? 'tm-toggle--pulse' : ''}`}
        aria-expanded={open}
        aria-controls="time-machine"
        title="Time machine (demo only)"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="tm-toggle__label">Time machine</span>
        {unread > 0 && <span className="tm-toggle__count" aria-label={`${unread} emails in the outbox`}>{unread}</span>}
      </button>

      <aside
        id="time-machine"
        className={`tm ${open ? 'tm--open' : ''}`}
        aria-label="Time machine and outbox (demo only)"
        hidden={!open}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="tm__head">
          <div>
            <p className="eyebrow">Demo only</p>
            <h2 className="tm__title">The Time Machine</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close the time machine">
            ×
          </button>
        </header>
        {clock && (
          <div className="tm__clock">
            <p className="tm__date" data-testid="tm-date">{longDate(clock.now)}</p>
            <p className="tm__offset">
              {offsetDays > 0 ? `${offsetDays} day${offsetDays === 1 ? '' : 's'} after the real today` : 'The real today'}
              {clock.nextEventAt !== null && <> · next event {relative(clock.nextEventAt, clock.now)}</>}
            </p>
          </div>
        )}
        <div className="tm__buttons" role="group" aria-label="Travel forward">
          <button type="button" className="btn btn--brass" disabled={busy} onClick={() => travel({ days: 1 }, 'One day passed')}>
            +1 day
          </button>
          <button type="button" className="btn btn--brass" disabled={busy} onClick={() => travel({ days: 7 }, 'A week passed')}>
            +7 days
          </button>
          <button type="button" className="btn btn--brass" disabled={busy} onClick={() => travel({ days: 30 }, 'A month passed')}>
            +30 days
          </button>
          <button
            type="button"
            className="btn btn--brass btn--wide"
            disabled={busy || clock?.nextEventAt == null}
            onClick={() => travel({ to: 'next' }, 'Jumped to the next event')}
          >
            Skip to the next event
          </button>
        </div>
        <p className="tm__note" role="status" aria-live="polite">
          {note}
        </p>

        <h3 className="tm__subtitle">
          The outbox <span className="tm__muted">({mail.length})</span>
        </h3>
        <p className="tm__muted tm__hint">Nothing leaves this machine. Links open as the person receiving them.</p>
        <ol className="outbox" aria-label="Emails that would have been sent">
          {mail.length === 0 && <li className="outbox__empty">No mail yet. The ravens are resting.</li>}
          {mail.map((m) => (
            <li key={m.id} className={`outbox__item outbox__item--${m.kind}`} data-kind={m.kind}>
              <button
                type="button"
                className="outbox__summary"
                aria-expanded={expanded === m.id}
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              >
                <span className="outbox__kind">{KIND_LABEL[m.kind] ?? m.kind}</span>
                <span className="outbox__subject">{m.subject}</span>
                <span className="outbox__meta">
                  to {m.to.name} · {shortDate(m.sentAt)}
                </span>
              </button>
              {(expanded === m.id || /^(release|witness-ask)$/.test(m.kind)) && (
                <p className="outbox__body">
                  <Linkified text={m.text} />
                </p>
              )}
            </li>
          ))}
        </ol>
        <div className="tm__foot">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Reset the demo? This erases every vault, the outbox and the clock offset.')) return;
              await api.dev.reset();
              try {
                window.localStorage.clear();
              } catch {
                // Storage may be blocked; the reset on the server is what matters.
              }
              window.location.href = '/';
            }}
          >
            Reset the whole demo
          </button>
        </div>
      </aside>
    </>
  );
}
