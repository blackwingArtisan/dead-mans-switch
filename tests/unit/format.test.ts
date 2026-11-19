import { describe, expect, it } from 'vitest';
import { longDate, relative, shortDate } from '../../src/web/lib/format';

// 2026-12-01 03:30 UTC is still November 30 in Chicago and already December 1 in Tokyo.
const AT = Date.UTC(2026, 11, 1, 3, 30);

describe('date formatting', () => {
  it('uses the given time zone, so a late-evening deadline shows the local day', () => {
    expect(longDate(AT, 'America/Chicago')).toBe('Monday, November 30, 2026');
    expect(longDate(AT, 'Asia/Tokyo')).toBe('Tuesday, December 1, 2026');
    expect(shortDate(AT, 'America/Chicago')).toBe('Nov 30, 2026');
  });

  it("defaults to the viewer's own time zone", () => {
    const local = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(AT);
    expect(shortDate(AT)).toBe(local);
  });

  it('describes distances in plain words', () => {
    const now = AT;
    expect(relative(now + 3 * 86_400_000, now)).toBe('in 3 days');
    expect(relative(now - 2 * 3_600_000, now)).toBe('2 hours ago');
    expect(relative(now + 30_000, now)).toBe('in 1 minute');
  });
});
