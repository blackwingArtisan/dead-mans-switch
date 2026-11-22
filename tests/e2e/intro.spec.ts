import { expect, test, type Page } from '@playwright/test';

/**
 * Records, inside the page, when the hero candle's intro marker (data-intro) appears and goes, and whether the
 * hero buttons were usable at the moment it appeared and 300 ms later. Nothing in the tests waits a fixed time.
 */
async function watchIntro(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: { startedAt: number | null; endedAt: number | null; usable: boolean[] } = { startedAt: null, endedAt: null, usable: [] };
    (window as unknown as { __intro: typeof log }).__intro = log;
    const usable = () => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('.hero__actions .btn')];
      return (
        buttons.length >= 1 &&
        buttons.every((b) => {
          const r = b.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !b.disabled && getComputedStyle(b).pointerEvents !== 'none' && (top === b || b.contains(top));
        })
      );
    };
    const look = () => {
      const candle = document.querySelector('[data-testid="hero-candle"]');
      const on = candle?.getAttribute('data-intro') === 'strike';
      if (on && log.startedAt === null) {
        log.startedAt = performance.now();
        log.usable.push(usable());
        setTimeout(() => log.usable.push(usable()), 300);
      }
      if (!on && log.startedAt !== null && log.endedAt === null) log.endedAt = performance.now();
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-intro'] });
  });
}

const intro = (page: Page) =>
  page.evaluate(() => (window as unknown as { __intro: { startedAt: number | null; endedAt: number | null; usable: boolean[] } }).__intro);

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the first landing visit in a session strikes a match for about a second, and the buttons are usable throughout (Req 10.13)', async ({ page }) => {
    await watchIntro(page);
    await page.goto('/');
    const candle = page.getByTestId('hero-candle');
    await expect(page.getByTestId('play-story')).toBeEnabled();
    // The intro ends by itself, and while it ran nothing covered or disabled a hero button.
    await expect(candle).not.toHaveAttribute('data-intro', 'strike');
    const log = await intro(page);
    expect(log.startedAt).not.toBeNull();
    expect(log.endedAt! - log.startedAt!).toBeGreaterThanOrEqual(900);
    expect(log.endedAt! - log.startedAt!).toBeLessThanOrEqual(2500);
    expect(log.usable.length).toBeGreaterThan(0);
    expect(log.usable.every(Boolean)).toBe(true);
    expect(await page.evaluate(() => window.sessionStorage.getItem('dms.intro'))).not.toBeNull();
    // The flame is back, lit, once it is over.
    await expect(candle.locator('.candle__flame')).toBeVisible();
  });

  test('a later visit in the same session skips the intro (Req 10.13)', async ({ page }) => {
    await watchIntro(page);
    await page.goto('/');
    await expect(page.getByTestId('hero-candle')).not.toHaveAttribute('data-intro', 'strike');
    expect((await intro(page)).startedAt).not.toBeNull();
    await page.reload();
    await expect(page.getByTestId('play-story')).toBeEnabled();
    expect((await intro(page)).startedAt).toBeNull();
    await expect(page.getByTestId('hero-candle')).not.toHaveAttribute('data-intro');
  });
});

test('under reduced motion there is no intro at all, and the candle is lit at once (Req 10.13, 10.3)', async ({ page }) => {
  await watchIntro(page);
  await page.goto('/');
  await expect(page.getByTestId('play-story')).toBeEnabled();
  await expect(page.getByTestId('hero-candle').locator('.candle__flame')).toBeVisible();
  expect((await intro(page)).startedAt).toBeNull();
  await expect(page.getByTestId('hero-candle')).not.toHaveAttribute('data-intro');
  expect(await page.evaluate(() => window.sessionStorage.getItem('dms.intro'))).toBeNull();
});
