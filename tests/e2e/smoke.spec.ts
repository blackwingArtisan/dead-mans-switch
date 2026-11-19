import { expect, test } from '@playwright/test';

test('landing page renders, is keyboard reachable and fits the screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Some words should wait.');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the honest page explains the custody limits', async ({ page }) => {
  await page.goto('/how-it-works');
  await expect(page.getByRole('heading', { name: 'How the seal works' })).toBeVisible();
  await expect(page.getByText('Vault custody is a convenience, not a secret.')).toBeVisible();
});

test('an incomplete form shows in-theme errors beside the fields, not browser bubbles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Light the candle' }).click();
  const name = page.getByLabel('Your name');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await expect(page.locator('#author-name-error')).toContainText('Write your name');
  await name.fill('Mara Whitlock');
  await expect(page.locator('#author-name-error')).toHaveCount(0);
  await page.getByLabel('Your email').fill('mara@');
  await page.getByRole('button', { name: 'Light the candle' }).click();
  await expect(page.locator('#author-email-error')).toContainText('does not look complete');
});
