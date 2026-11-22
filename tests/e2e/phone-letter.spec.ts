import { expect, test } from '@playwright/test';

// Runs on the phone project only (see playwright.config.ts). The dark, candlelit reading page needs motion allowed.
test.use({ reducedMotion: 'no-preference' });

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

test('on a 390 px phone the reading-light flame stays off the letter title and the hint sits above the page (Req 10.17)', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  // Silence, then the silence window with no denial: the letters are released with no witness answering.
  expect((await request.post('/api/dev/clock', { data: { days: 38 } })).ok()).toBe(true);
  expect((await request.post('/api/dev/clock', { data: { days: 15 } })).ok()).toBe(true);
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { name: string }; text: string }[] };
  const release = messages.find((m) => m.kind === 'release' && m.to.name === 'June Okafor')!;
  const link = release.text.match(/https?:\/\/\S+/)![0];

  await page.goto(link);
  await page.getByTestId('break-seal').click();
  const sheet = page.getByTestId('letter-page');
  await expect(sheet).toHaveClass(/letter__page--dark/);
  await expect(page.locator('.letter__title')).toBeVisible();

  const boxes = () =>
    page.evaluate(() => {
      const r = (s: string) => {
        const el = document.querySelector(s) as HTMLElement | null;
        const b = el?.getBoundingClientRect();
        const shown = !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
        return b && shown ? { x: b.left, y: b.top, w: b.width, h: b.height } : null;
      };
      return { hint: r('[data-testid="candle-hint"]'), page: r('[data-testid="letter-page"]'), title: r('.letter__title'), flame: r('.letter__flame') };
    });

  // The pill is above the page, whole, and clear of it: not over the title or anything else on the sheet.
  const { hint, page: sheetBox, title, flame } = await boxes();
  expect(hint).not.toBeNull();
  expect(hint!.y + hint!.h).toBeLessThanOrEqual(sheetBox!.y);
  await expect(page.getByTestId('candle-hint')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Light the room' })).toBeInViewport({ ratio: 1 });

  // Before the light is moved the flame marker is not drawn over the title.
  if (flame) {
    const overlaps = flame.x < title!.x + title!.w && title!.x < flame.x + flame.w && flame.y < title!.y + title!.h && title!.y < flame.y + flame.h;
    expect(overlaps, 'the flame marker sits on the title').toBe(false);
  }

  // Nothing widens the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - 390)).toBeLessThanOrEqual(0);
});
