/**
 * How the seal works, in one picture: the key is made and split in the author's browser, half A
 * travels with the recipient, half B waits in the vault with the sealed letter, and only the
 * recipient's browser ever holds both. The drawing is decorative; the figure caption and the
 * strip beneath it say the same thing in text.
 */
const PATHS = {
  toCard: 'M140 92 C 110 120, 90 140, 90 172',
  toVault: 'M220 92 C 250 120, 270 140, 270 172',
  cardOut: 'M90 246 C 90 290, 140 310, 160 334',
  vaultOut: 'M270 246 C 270 290, 220 310, 200 334',
};

function Station({ x, y, w, title, line, tone }: { x: number; y: number; w: number; title: string; line: string; tone: string }) {
  return (
    <g className={`keymap__station keymap__station--${tone}`}>
      <rect x={x} y={y} width={w} height={72} rx={6} />
      <text x={x + w / 2} y={y + 30} className="keymap__title">
        {title}
      </text>
      <text x={x + w / 2} y={y + 54} className="keymap__line">
        {line}
      </text>
    </g>
  );
}

export function KeyDiagram() {
  return (
    <figure className="keymap" data-testid="key-diagram">
      <svg viewBox="0 0 360 420" aria-hidden="true" focusable="false">
        <Station x={90} y={20} w={180} title="Your browser" line="makes K, splits it: A ⊕ B" tone="ink" />
        <Station x={10} y={174} w={160} title="Keepsake card" line="half A, you hand it over" tone="gold" />
        <Station x={190} y={174} w={160} title="The vault" line="half B + sealed letter" tone="wax" />
        <Station x={80} y={336} w={200} title="Recipient’s browser" line="A ⊕ B = K, opens once" tone="ink" />
        <path className="keymap__path keymap__path--a" d={PATHS.toCard} />
        <path className="keymap__path keymap__path--b" d={PATHS.toVault} />
        <path className="keymap__path keymap__path--a" d={PATHS.cardOut} />
        <path className="keymap__path keymap__path--b" d={PATHS.vaultOut} />
        <text x={70} y={128} className="keymap__tag keymap__tag--a">
          A
        </text>
        <text x={290} y={128} className="keymap__tag keymap__tag--b">
          B
        </text>
        <text x={66} y={300} className="keymap__note">
          ahead of time
        </text>
        <text x={294} y={300} className="keymap__note">
          after witnesses
        </text>
        <text x={294} y={316} className="keymap__note">
          confirm, once
        </text>
        <circle r={6} className="keymap__dot keymap__dot--a" style={{ offsetPath: `path('${PATHS.toCard}')` }} />
        <circle r={6} className="keymap__dot keymap__dot--b" style={{ offsetPath: `path('${PATHS.toVault}')` }} />
        <circle r={6} className="keymap__dot keymap__dot--a keymap__dot--late" style={{ offsetPath: `path('${PATHS.cardOut}')` }} />
        <circle r={6} className="keymap__dot keymap__dot--b keymap__dot--late" style={{ offsetPath: `path('${PATHS.vaultOut}')` }} />
      </svg>
      <figcaption>
        Your browser makes each letter’s key and splits it. Half A travels with your recipient on a keepsake; half B waits in the
        vault beside the sealed letter. Only the recipient’s browser ever holds both.
      </figcaption>
      <div className="keymap__strip">
        <div>
          <p className="keymap__head">The vault can see</p>
          <p>Half B, the sealed letter, names and emails, dates and sizes.</p>
        </div>
        <div>
          <p className="keymap__head">The vault never sees</p>
          <p>Half A, the whole key, or a single word of a keepsake-custody letter.</p>
        </div>
      </div>
    </figure>
  );
}
