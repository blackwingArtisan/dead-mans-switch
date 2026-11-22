/**
 * The stakes line and the "why not the tools you already have" table, shared by the
 * landing page and the honest page so both always say the same thing.
 */

/**
 * Every figure here was checked at its primary source (CDC and Gallup on 2026-11-18, the 1Password survey on
 * 2026-11-22); keep the README in step. The pain line leads; the death and will figures follow.
 */
export const STAKES = {
  painFigure: '63%',
  painText: 'of people who had carried out a will said getting into the accounts of the person who died was harder than they expected.',
  painSource: '1Password survey of 1,000 U.S. adults aged 25 to 40, 2021',
  painHref: 'https://www.helpnetsecurity.com/2021/11/15/digital-handover/',
  figure: '3,072,666',
  text: 'people died in the U.S. in 2024.',
  source: 'CDC',
  href: 'https://www.cdc.gov/nchs/fastats/deaths.htm',
  willFigure: '46%',
  willText: 'of U.S. adults have a will',
  willSource: 'Gallup, 2021',
  willHref: 'https://news.gallup.com/poll/351500/how-many-americans-have-will.aspx',
  aside: 'Not one of those wills tells your sister where the password sheet is.',
};

/** The one-breath thesis, shown above the claims and used as the og:description. Keep src/web/index.html in step. */
export const THESIS =
  'Every other dead man’s switch is a timer. This one is a vigil: a candle you keep lit, witnesses who can veto, and a key that is half on paper.';

/** For the founder's wedge: small businesses whose owner is the whole company. */
export const MARKET = {
  figure: '29.8 million',
  text: 'U.S. small businesses have no employees, so one person holds every account.',
  source: 'SBA Office of Advocacy, 2026, 2022 data',
  href: 'https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf',
};

export function Stakes() {
  return (
    <p className="stakes">
      <span className="stakes__pain">
        <span className="stakes__figure">{STAKES.painFigure}</span> {STAKES.painText}{' '}
        <a href={STAKES.painHref} target="_blank" rel="noopener noreferrer" className="stakes__source">
          ({STAKES.painSource})
        </a>
      </span>{' '}
      <span className="stakes__figure">{STAKES.figure}</span> {STAKES.text}{' '}
      <a href={STAKES.href} target="_blank" rel="noopener noreferrer" className="stakes__source">
        ({STAKES.source})
      </a>{' '}
      Only {STAKES.willFigure} {STAKES.willText}{' '}
      <a href={STAKES.willHref} target="_blank" rel="noopener noreferrer" className="stakes__source">
        ({STAKES.willSource})
      </a>
      .{' '}
      <span className="stakes__aside">{STAKES.aside}</span>
    </p>
  );
}

/** People already pay for a place to leave things behind. Published prices, checked 2026-11-18. */
export const PAID = [
  { name: 'Everplans Premium', price: '$99.99 a year', href: 'https://www.everplans.com/pricing' },
  { name: 'Trustworthy', price: 'from $10 a month, billed yearly', href: 'https://www.trustworthy.com/pricing' },
  { name: 'GoodTrust', price: '$149 for a will or trust, with a digital vault', href: 'https://mygoodtrust.com/pricing' },
];

export function PaidComparables() {
  return (
    <p className="compare__paid" data-testid="paid-comparables">
      People already pay for a place to leave things behind:{' '}
      {PAID.map((p, i) => (
        <span key={p.name}>
          <a href={p.href} target="_blank" rel="noopener noreferrer">
            {p.name}
          </a>{' '}
          {p.price}
          {i < PAID.length - 1 ? '; ' : '. '}
        </span>
      ))}
      Those are places to file documents and accounts. Last Candle is planned at <strong>$39 for ten years, then $5 a year</strong>, and
      even we cannot read the letters.
    </p>
  );
}

/**
 * The three things no other tool here does, said once and shared by the landing page and the README.
 * Keep the wording in step with the README's "What no one else does" block.
 */
export const DISTINCT = [
  { title: 'The recipient holds half the key.', text: 'In keepsake custody the vault never holds enough to read a letter, so not even we can.' },
  { title: 'Any witness can veto.', text: 'A lost phone or a long holiday never sends a letter: one “they still live” stops the release.' },
  { title: 'The room is the state machine.', text: 'Lit, guttering, out: the candle and the whole page show exactly where the vigil stands.' },
];

export function Distinct() {
  return (
    <section className="distinct" aria-labelledby="distinct-title" data-testid="distinct">
      <h2 id="distinct-title" className="distinct__title">
        What no one else does
      </h2>
      <p className="distinct__thesis" data-testid="thesis">
        {THESIS}
      </p>
      <ol className="distinct__list">
        {DISTINCT.map((d) => (
          <li key={d.title}>
            <strong>{d.title}</strong> {d.text}
          </li>
        ))}
      </ol>
      <p className="distinct__taps">Twelve taps a year is the whole job.</p>
    </section>
  );
}

/**
 * The hospice channel, bottom up: one sourced figure, then one assumption per line. MedPAC checked at the
 * source on 2026-11-22 (March 2025 report, chapter 9, 2023 data).
 */
export const HOSPICE_CHANNEL = {
  source: 'MedPAC, March 2025',
  href: 'https://medpac.gov/wp-content/uploads/2025/03/Mar25_Ch9_MedPAC_Report_To_Congress_SEC.pdf',
  fact: 'More than 1.7 million Medicare patients received hospice care in 2023, from about 6,500 hospices.',
  steps: [
    'Assume 1 hospice in 100 hands families the keepsake kit: about 17,000 families a year.',
    'Assume 1 family in 10 then keeps a vigil at $39: about 1,700 vigils, or about $66,000 a year.',
    'A channel to test with a few hospices first, not a forecast.',
  ],
};

/**
 * What one vigil costs to keep, so "$39 for ten years" reads as a deliberate wedge. Published prices checked on
 * 2026-11-22: Cloudflare Workers Paid and Workers KV, and Resend.
 */
export const COST_PER_VIGIL =
  'What a vigil costs to keep: about 20 emails a year (Resend, $0.90 per 1,000 past the plan) and under 1 MB of sealed letters (Cloudflare Workers KV, $0.50 per GB-month), so about 2 cents a year, or about 20 cents over ten years, on top of about $25 a month in fixed plans (Workers Paid $5, Resend Pro $20).';

/** The landing page's short version; the full table lives on the honest page. */
export function ComparisonTeaser() {
  return (
    <section className="compare compare--teaser" aria-labelledby="compare-title">
      <h2 id="compare-title" className="section-title">
        Why not the tools you already have?
      </h2>
      <p className="compare__lede">
        Google and Apple hand over accounts. Bitwarden hands over the whole vault. This hands over a letter, in your words, that nobody
        can open until the people you trust agree you are gone.
      </p>
      <PaidComparables />
      <p>
        <a href="/how-it-works#how-compare-title">Compare them side by side</a>
      </p>
    </section>
  );
}

interface Row {
  name: string;
  hands: string;
  reads: string;
  checks: string;
  where: string;
  ours?: boolean;
}

export const ROWS: Row[] = [
  {
    name: 'Google Inactive Account Manager',
    hands: 'Google account data, plus one notice email',
    reads: 'Google holds the data',
    checks: 'No one. An inactivity timer decides',
    where: 'Google accounts only',
  },
  {
    name: 'Apple Legacy Contact',
    hands: 'Apple account data',
    reads: 'Apple holds the data',
    checks: 'Apple, after a death certificate',
    where: 'Apple accounts only',
  },
  {
    name: 'Bitwarden Emergency Access',
    hands: 'The whole password vault',
    reads: 'No one (end-to-end encrypted)',
    checks: 'Only you, by rejecting within a wait time',
    where: 'Bitwarden Premium users',
  },
  {
    name: 'deadmansswitch.net',
    hands: 'Pre-written emails',
    reads: 'Not stated on its site',
    checks: 'No one. Missed reminders release them',
    where: 'Any email address',
  },
  {
    name: 'GoodTrust Future Messages',
    hands: 'Video, photo or text messages',
    reads: 'GoodTrust stores them (AES-256 at rest; not stated as end-to-end)',
    checks: 'No one. They go out on dates you choose',
    where: 'Email or your social accounts',
  },
  {
    name: 'Everplans letters (Sharing After Death)',
    hands: 'A “Letters to Family & Friends” section of your plan',
    reads: 'Everplans stores the plan',
    checks: 'One deputy reports your death; only you can block it, by email, within up to 30 days',
    where: 'Everplans members and their deputies',
  },
  {
    name: 'SafeBeyond',
    hands: 'Messages, videos and files on a date, event or place',
    reads: 'Stored in its cloud; encryption not stated',
    checks: 'Trustees you name report your death',
    where: 'Its mobile app (safebeyond.com no longer resolves)',
  },
  {
    name: 'Last Candle',
    hands: 'A sealed letter for each person, in your words',
    reads: 'No one in keepsake custody: the recipient holds half the key',
    checks: 'Witnesses you name. Any one of them can stop it',
    where: 'Any browser, any email',
    ours: true,
  },
];

export function Comparison({ headingId, headingLevel = 2 }: { headingId: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className="compare" aria-labelledby={headingId}>
      <Heading id={headingId} className="section-title">
        Why not the tools you already have?
      </Heading>
      <div className="compare__scroll" role="region" aria-label="Comparison table" tabIndex={0}>
        <table className="compare__table">
          <thead>
            <tr>
              <th scope="col">Tool</th>
              <th scope="col">What it hands over</th>
              <th scope="col">Who can read it first</th>
              <th scope="col">Who checks before it goes</th>
              <th scope="col">Works for</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name} className={r.ours ? 'compare__ours' : undefined}>
                <th scope="row">{r.name}</th>
                <td>{r.hands}</td>
                <td>{r.reads}</td>
                <td>{r.checks}</td>
                <td>{r.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="compare__sources">
        Checked at each product’s own pages on 2026-11-19:{' '}
        <a href="https://mygoodtrust.com/future-message" target="_blank" rel="noopener noreferrer">
          GoodTrust Future Messages
        </a>
        ,{' '}
        <a href="https://www.everplans.com/blog/keep-things-private-until-after-youre-gone" target="_blank" rel="noopener noreferrer">
          Everplans Sharing After Death
        </a>{' '}
        and{' '}
        <a
          href="https://www.prnewswire.com/news-releases/safebeyond-launches-the-worlds-first-posthumous-message-delivery-platform-300150111.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          SafeBeyond’s launch release
        </a>
        .
      </p>
      <p className="compare__close">The big platforms hand over accounts. This hands over the words, and even we cannot read them.</p>
      <PaidComparables />
    </section>
  );
}
