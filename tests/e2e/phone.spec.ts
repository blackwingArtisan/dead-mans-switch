import { expect, test } from '@playwright/test';

// Runs on the phone project only (see playwright.config.ts).

test('on a phone the sound switch and the hourglass sit in the masthead, clear of every action', async ({ page }) => {
  const overlaps = async () =>
    page.evaluate(() => {
      const controls = ['.sound-toggle', '.tm-toggle']
        .map((s) => document.querySelector(s)?.getBoundingClientRect())
        .filter((r): r is DOMRect => !!r && r.width > 0);
      const actions = [...document.querySelectorAll<HTMLElement>('main a, main button, main input, main select')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight);
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return controls.flatMap((c) => actions.filter((a) => hit(a, c))).length;
    });
  await page.goto('/');
  await expect(page.getByTestId('sound-toggle')).toBeVisible();
  const sound = (await page.getByTestId('sound-toggle').boundingBox())!;
  const masthead = (await page.locator('header.masthead').boundingBox())!;
  expect(sound.y + sound.height).toBeLessThanOrEqual(masthead.y + masthead.height);
  for (const y of [0, 400, 900, 1600]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    expect(await overlaps()).toBe(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('state-title')).toBeVisible();
  for (const y of [0, 500, 1000]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    expect(await overlaps()).toBe(0);
  }
});

test('on a phone the time machine note sits below the masthead and goes away when the route changes (Req 10.14)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('state-title')).toBeVisible();
  await page.getByRole('button', { name: /^time machine/i }).click();
  await page.getByRole('button', { name: '+7 days' }).click();

  const toast = page.locator('.tm-toast');
  await expect(toast).toContainText('A week passed');
  const masthead = (await page.locator('header.masthead').boundingBox())!;
  const note = (await toast.boundingBox())!;
  expect(note.y).toBeGreaterThanOrEqual(masthead.y + masthead.height);
  // It stays on screen and inside the width.
  expect(note.x).toBeGreaterThanOrEqual(0);
  expect(note.x + note.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  // Navigating to another route dismisses it.
  await page.getByRole('link', { name: 'How the seal works' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How the seal works' })).toBeVisible();
  await expect(page.locator('.tm-toast')).toHaveCount(0);
});
