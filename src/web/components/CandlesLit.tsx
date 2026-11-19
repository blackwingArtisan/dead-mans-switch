import { useEffect, useState, type FormEvent } from 'react';
import { MAX_CANDLE_LINE } from '../../core/vault';
import type { CandleBack, CandleLine } from '../../core/types';
import { api } from '../lib/api';
import { shortDate } from '../lib/format';

/** The candles the recipients lit back, each with its line and who left it. */
export function CandlesLit({ candles, testId = 'candles-lit' }: { candles: CandleBack[]; testId?: string }) {
  if (candles.length === 0) return null;
  return (
    <ul className="candles-lit" data-testid={testId}>
      {candles.map((c) => (
        <li key={`${c.from}-${c.at}`} className="candles-lit__item">
          <span className="candles-lit__flame" aria-hidden="true" />
          <span className="candles-lit__line">“{c.line}”</span>
          <span className="candles-lit__from">
            {c.from}, {shortDate(c.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "A candle lit back": after reading, a recipient may leave one line for the witnesses and the
 * other recipients, the story's last scene. One line, once, plain text.
 */
export function LightACandle({ token, authorName }: { token: string; authorName: string }) {
  const first = authorName.split(' ')[0];
  const [mine, setMine] = useState<CandleLine | null>(null);
  const [candles, setCandles] = useState<CandleBack[]>([]);
  const [line, setLine] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    api.openInfo(token).then(
      (info) => {
        setMine(info.candle);
        setCandles(info.candles);
      },
      () => undefined,
    );
  }, [token]);

  const light = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api.lightCandle(token, line);
      setMine(r.candle);
      setCandles(r.candles);
      setLit(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The candle would not light.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="candle-back" aria-labelledby="candle-back-title" data-testid="candle-back">
      <h2 id="candle-back-title" className="section-title">
        A candle lit back
      </h2>
      {mine ? (
        <p className="candle-back__mine" data-testid="candle-mine">
          {lit ? 'Your candle is lit.' : 'You lit a candle back.'} {first}’s witnesses and the others {first} wrote to have been
          told.
        </p>
      ) : (
        <form className="candle-back__form" onSubmit={light} noValidate>
          <label htmlFor="candle-line">Leave one line for the others who loved {first}</label>
          <div className="candle-back__row">
            <input
              id="candle-line"
              value={line}
              maxLength={MAX_CANDLE_LINE}
              onChange={(e) => setLine(e.target.value)}
              placeholder="I found the blue tin."
              aria-describedby="candle-line-hint"
              autoComplete="off"
            />
            <button type="submit" className="btn btn--wax" disabled={busy} data-testid="light-candle">
              Light a candle
            </button>
          </div>
          <p id="candle-line-hint" className="hint">
            One line, up to {MAX_CANDLE_LINE} characters. It is sent with your name to {first}’s witnesses and the other people {first}{' '}
            wrote to, and cannot be changed afterwards.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      <p className="sr-only" role="status">
        {lit ? 'Your candle is lit.' : ''}
      </p>
      <CandlesLit candles={candles} />
    </section>
  );
}
