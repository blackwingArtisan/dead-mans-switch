/**
 * The stakes line and the "why not the tools you already have" table, shared by the
 * landing page and the honest page so both always say the same thing.
 */

/** Every figure here was checked at its primary source on 2026-11-18; keep the README in step. */
export const STAKES = {
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
      Those are places to file documents and accounts. Dead Man’s Switch is planned at <strong>$39, once</strong>, and even we cannot read the
      letters.
    </p>
  );
}

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
    name: 'Dead Man’s Switch',
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
      <p className="compare__close">The big platforms hand over accounts. This hands over the words, and even we cannot read them.</p>
      <PaidComparables />
    </section>
  );
}
