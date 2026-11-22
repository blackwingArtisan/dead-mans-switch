import { expect, test, type Page } from '@playwright/test';

// The candle-out climax (Req 10.22-10.24): the room closes in for 1.2 seconds, then smoke rises from the wick.
test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

interface Log {
  added: number | null;
  removed: number | null;
  clicksPassThrough: boolean | null;
}

async function watchBlackout(page: Page) {
  await page.addInitScript(() => {
    const log: Log = { added: null, removed: null, clicksPassThrough: null };
    (window as unknown as { __blackout: Log }).__blackout = log;
    const look = () => {
      const el = document.querySelector('.blackout');
      if (el && log.added === null) {
        log.added = performance.now();
        log.clicksPassThrough = getComputedStyle(el).pointerEvents === 'none';
      }
      if (!el && log.added !== null && log.removed === null) log.removed = performance.now();
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
}
const blackoutLog = (page: Page) => page.evaluate(() => (window as unknown as { __blackout: Log }).__blackout);

async function enterConfirm(page: Page, request: import('@playwright/test').APIRequestContext) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  expect((await request.post('/api/dev/clock', { data: { days: 38 } })).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('dms:refresh')));
  await expect(page.locator('body')).toHaveAttribute('data-room', 'confirm');
}

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('when the candle goes out a 1.2 second blackout closes in, clicks pass through it, then smoke rises and the line is announced (Req 10.22, 10.23)', async ({ page, request }) => {
    await watchBlackout(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo vigil' }).click();
    await expect(page.getByTestId('envelope')).toHaveCount(2);
    await request.post('/api/dev/clock', { data: { days: 38 } });
    await page.evaluate(() => window.dispatchEvent(new Event('dms:refresh')));
    const blackout = page.locator('.blackout');
    await expect(blackout).toBeAttached();
    const box = await blackout.evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { duration: s.animationDuration, position: s.position, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, hidden: el.getAttribute('aria-hidden') };
    });
    expect(box).toMatchObject({ duration: '1.2s', position: 'fixed', hidden: 'true' });
    expect(box.w).toBe(box.vw);
    expect(box.h).toBe(box.vh);
    await expect(blackout).toHaveCount(0);
    const log = await blackoutLog(page);
    expect(log.clicksPassThrough).toBe(true);
    expect(log.removed! - log.added!).toBeGreaterThanOrEqual(1100);
    expect(log.removed! - log.added!).toBeLessThan(2500);
    // The plume rises from the wick, and the candle's out is said in words.
    const plume = page.locator('.candle__plume--rise');
    await expect(plume).toBeAttached();
    expect(await plume.evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
    await expect(page.getByRole('status').filter({ hasText: 'The candle has gone out.' })).toBeAttached();
  });
});

test('under reduced motion the candle goes out in a straight cut: no blackout and no animated plume, and the line is still announced (Req 10.24, 10.23)', async ({ page, request }) => {
  await watchBlackout(page);
  await enterConfirm(page, request);
  await expect(page.getByRole('status').filter({ hasText: 'The candle has gone out.' })).toBeAttached();
  expect((await blackoutLog(page)).added).toBeNull();
  await expect(page.locator('.blackout')).toHaveCount(0);
  const names = await page.locator('.candle__plume, .candle__smoke path').evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n === 'none' || n === 'smoke').toBe(true);
  expect(await page.locator('.candle__plume').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});
