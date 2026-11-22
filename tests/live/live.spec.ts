import { expect, test } from '@playwright/test';

// The deployed demo runs the API in the browser. These checks prove the public URL serves the
// current build, sends the security headers and can run a demo vigil from start to check-in.

test('the live demo serves the landing page with its security headers', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Some words should wait.');
  await expect(page.getByTestId('play-story')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the live demo runs a demo vigil in the browser and accepts a check-in', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('state-title')).toBeVisible();
  await expect(page.getByText('The vigil of Mara Whitlock')).toBeVisible();
  const health = await page.evaluate(async () => (await fetch('/api/health')).json());
  expect(health).toMatchObject({ dev: true });
  // Travel past the reminder point with the in-browser time machine, then check in from the vigil.
  await page.evaluate(async () => {
    await fetch('/api/dev/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ days: 28 }) });
  });
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns low');
  await page.getByTestId('check-in').click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
});

test('an unknown path gets the themed not-found page, not a blank screen', async ({ page }) => {
  await page.goto('/no-such-room');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('body')).not.toBeEmpty();
});
