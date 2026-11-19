import { expect, test, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

/** Describes the focused element and says what is wrong with its focus ring, or null when it is plainly visible. */
async function focusProblem(page: Page): Promise<{ who: string; problem: string | null }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { who: 'nothing', problem: 'nothing has focus' };
    const labels = (el as HTMLInputElement).labels;
    const label = el.getAttribute('aria-label') || labels?.[0]?.textContent || el.textContent || el.getAttribute('placeholder') || '';
    const who = `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> "${label.trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // A ring is a 2px+ visible outline, or a solid 2px+ box-shadow ring (no offset, no blur), which the writing page uses.
    const outlined =
      s.outlineStyle !== 'none' && s.outlineStyle !== 'hidden' && parseFloat(s.outlineWidth) >= 2 && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(s.outlineColor);
    const shadowed = s.boxShadow
      .split(/,(?![^()]*\))/)
      .some((layer) => {
        const m = layer.trim().match(/^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px(?!\s*inset)$/);
        if (!m) return false;
        const [, color = '', x, y, blur, spread = '0'] = m;
        return !/,\s*0\)$/.test(color) && x === '0' && y === '0' && blur === '0' && parseFloat(spread) >= 2;
      });
    let problem: string | null = null;
    if (!el.matches(':focus-visible')) problem = 'is not :focus-visible after a key press';
    else if (!outlined && !shadowed) problem = `has no visible ring (outline ${s.outlineStyle} ${s.outlineWidth}, shadow ${s.boxShadow})`;
    else if (r.width === 0 || r.height === 0) problem = 'has no size';
    else if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) problem = 'is scrolled out of view';
    return { who, problem };
  });
}

/** Presses Tab until `target` has focus. Every stop on the way, and the target, must show a visible focus ring. */
async function tabTo(page: Page, target: Locator, description: string): Promise<string[]> {
  const trail: string[] = [];
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    const { who, problem } = await focusProblem(page);
    trail.push(who);
    expect(problem, `${who} ${problem} (tabbing to ${description})`).toBeNull();
    if (await target.evaluate((el) => el === document.activeElement)) return trail;
  }
  throw new Error(`Tab never reached ${description}. Stops: ${trail.join(' > ')}`);
}

test('the core path works by keyboard alone, with a visible focus ring on every stop (Req 10.2, 10.6, 10.7)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Some words should wait.');

  // The skip link is the first stop (Req 10.6).
  const first = await tabTo(page, page.getByRole('link', { name: 'Skip to content' }), 'the skip link');
  expect(first).toHaveLength(1);
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeInViewport();

  // Start a demo vigil.
  await tabTo(page, page.getByRole('button', { name: 'Try a demo vigil' }), '"Try a demo vigil"');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  await expect(page.getByTestId('envelope')).toHaveCount(2);

  // Check in.
  await tabTo(page, page.getByTestId('check-in'), 'the check-in button');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Checked in. Your candle is relit' })).toBeAttached();
  await expect(page.locator('.ledger')).toContainText('Checked in.');

  // Open the writing desk.
  await tabTo(page, page.getByTestId('write-letter'), '"Write a letter"');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Write a letter' })).toBeVisible();

  // Write the letter with the keyboard, field by field.
  await tabTo(page, page.getByLabel('For', { exact: true }), 'the recipient name');
  await page.keyboard.type('Theo Whitlock');
  await tabTo(page, page.getByLabel('Their email'), 'the recipient email');
  await page.keyboard.type('theo@example.com');
  await tabTo(page, page.getByLabel(/^Title/), 'the title');
  await page.keyboard.type('For Theo, when the lights go out');
  await tabTo(page, page.getByRole('textbox', { name: 'Your letter' }), 'the letter body');
  await page.keyboard.type('The spare key is under the third stone by the gate.');
  await expect(page.getByRole('textbox', { name: 'Your letter' })).toContainText('third stone');

  // Reach "Seal the letter", passing the sign-off and both custody options, and seal it.
  const seal = page.getByRole('button', { name: 'Seal the letter' });
  const stops = await tabTo(page, seal, '"Seal the letter"');
  expect(stops.some((s) => s.includes('Keepsake custody'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sealed-title')).toBeFocused();
  await expect(page.getByTestId('keepsake-card')).toBeVisible();
});
