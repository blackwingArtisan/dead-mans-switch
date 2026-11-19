/** Shows where the two halves of a letter's key live once it is sealed. */
export function KeySplit({ recipient, custody }: { recipient: string; custody: 'keepsake' | 'vault' }) {
  const first = recipient.trim().split(/\s+/)[0] || 'your recipient';
  return (
    <figure className="split" data-testid="key-split" aria-labelledby="split-caption">
      <svg className="split__seal" viewBox="-14 0 148 120" width="148" height="120" aria-hidden="true">
        <g className="split__piece split__piece--a">
          <path d="M60 6 A54 54 0 0 0 60 114 L56 98 L64 82 L52 64 L64 46 L54 26 Z" />
          <text x="32" y="70">A</text>
        </g>
        <g className="split__piece split__piece--b">
          <path d="M60 6 A54 54 0 0 1 60 114 L56 98 L64 82 L52 64 L64 46 L54 26 Z" />
          <text x="88" y="70">B</text>
        </g>
      </svg>
      <dl className="split__labels">
        <div className="split__label split__label--a">
          <dt>Half A, the keepsake</dt>
          <dd>{custody === 'keepsake' ? `Goes to ${first}, on the card below. We never see it.` : `Kept in the vault and sent in ${first}’s link.`}</dd>
        </div>
        <div className="split__label split__label--b">
          <dt>Half B, the vault half</dt>
          <dd>Stored with the sealed letter. Alone it is noise.</dd>
        </div>
      </dl>
      <figcaption id="split-caption" className="split__caption">
        The key is split in two. Neither half alone opens anything; the letter opens only when both meet, after your witnesses confirm.
      </figcaption>
    </figure>
  );
}
