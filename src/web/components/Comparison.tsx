/**
 * The stakes line and the "why not the tools you already have" table, shared by the
 * landing page and the honest page so both always say the same thing.
 */

export const STAKES = {
  figure: '46%',
  text: 'of U.S. adults have a will.',
  aside: 'Not one of those wills tells your sister where the password sheet is.',
  source: 'Gallup, 2021',
  href: 'https://news.gallup.com/poll/351500/how-many-americans-have-will.aspx',
};

export function Stakes() {
  return (
    <p className="stakes">
      <span className="stakes__figure">{STAKES.figure}</span> {STAKES.text}{' '}
      <a href={STAKES.href} target="_blank" rel="noopener noreferrer" className="stakes__source">
        ({STAKES.source})
      </a>{' '}
      <span className="stakes__aside">{STAKES.aside}</span>
    </p>
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
    </section>
  );
}
