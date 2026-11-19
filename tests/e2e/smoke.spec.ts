import { expect, test } from '@playwright/test';

test('landing page renders, is keyboard reachable and fits the screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Some words should wait.');
  // The landing keeps the comparison short and links to the full table.
  await expect(page.getByRole('link', { name: 'Compare them side by side' })).toBeVisible();
  await expect(page.locator('.stakes')).toContainText('3,072,666');
  // What no one else does, in three lines, with the usage reframe.
  const distinct = page.getByTestId('distinct');
  await expect(distinct.locator('li')).toHaveCount(3);
  await expect(distinct).toContainText('The recipient holds half the key.');
  await expect(distinct).toContainText('Any witness can veto.');
  await expect(distinct).toContainText('The room is the state machine.');
  await expect(distinct).toContainText('Twelve taps a year is the whole job.');
  // Play the whole story is the primary call to action when the time machine is on.
  await expect(page.getByTestId('play-story')).toHaveClass(/btn--wax/);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the honest page explains the custody limits', async ({ page }) => {
  await page.goto('/how-it-works');
  await expect(page.getByRole('heading', { name: 'How the seal works' })).toBeVisible();
  await expect(page.getByText('Vault custody is a convenience, not a secret.')).toBeVisible();
  // One drawing of the key's journey, with what the vault can and cannot see in text beneath it.
  const diagram = page.getByTestId('key-diagram');
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('figcaption')).toContainText('Only the recipient’s browser ever holds both.');
  await expect(diagram.getByText('The vault never sees')).toBeVisible();
  // The full comparison, with the paid tools people already use and their published prices.
  await expect(page.getByRole('region', { name: 'Comparison table' })).toBeVisible();
  await expect(page.getByTestId('paid-comparables')).toContainText('Everplans Premium');
  await expect(page.getByTestId('paid-comparables')).toContainText('$39 for ten years');
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

test('sound is off until asked for, and the choice is remembered', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByTestId('sound-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAccessibleName(/Hear the room/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.localStorage.getItem('dms.sound'))).toBe('on');
  await page.reload();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('sound-toggle').click();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  // The toggle never pushes the page sideways on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('unknown addresses and bad links lead somewhere, without repeating themselves', async ({ page }) => {
  await page.goto('/no/such/place');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No vigil is kept here');
  await expect(page.getByTestId('not-found').locator('svg.candle')).toBeVisible();
  await page.getByRole('link', { name: 'Return to the threshold' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Some words should wait.');

  await page.goto('/open/notarealtoken');
  const notice = page.getByTestId('open-link-error');
  await expect(notice.getByRole('heading', { level: 1 })).toHaveText('This link is not valid');
  // The server's "This letter link is not valid." only repeats the heading, so it is left out.
  await expect(notice.getByText('This letter link is not valid.')).toHaveCount(0);
  await expect(notice.getByText(/everything after the # sign/)).toBeVisible();
  // One masthead and one skip link, and the skip link stays out of sight until it has keyboard focus.
  await expect(page.locator('header.masthead')).toHaveCount(1);
  await expect(page.locator('.skip-link')).toHaveCount(1);
  await expect(page.locator('.skip-link')).not.toBeInViewport();
  await notice.getByRole('link', { name: 'How the seal works' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How the seal works');

  await page.goto('/witness/notarealtoken');
  await expect(page.getByTestId('witness-link-error').getByRole('heading', { level: 1 })).toHaveText('Nothing to answer');
});

test('the landing shows the three rooms and its teaser opens the full comparison', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('rooms-strip').locator('li')).toHaveCount(3);
  await page.getByRole('link', { name: 'Compare them side by side' }).click();
  await expect(page).toHaveURL(/\/how-it-works#how-compare-title$/);
  await expect(page.getByRole('heading', { name: 'Why not the tools you already have?' })).toBeInViewport();
});

test('the writing desk: the placeholder sits inside the margin rule and the toolbar stays on one row', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('state-title')).toBeVisible();
  await page.goto('/write');
  const sheet = page.locator('.editor__page');
  await expect(sheet).toBeVisible();
  const { placeholderLeft, textLeft } = await sheet.evaluate((el) => ({
    placeholderLeft: parseFloat(getComputedStyle(el, '::before').left),
    textLeft: parseFloat(getComputedStyle(el).paddingLeft),
  }));
  expect(placeholderLeft).toBeCloseTo(textLeft, 0);
  const toolbar = await page.getByRole('toolbar', { name: 'Formatting' }).boundingBox();
  expect(toolbar!.height).toBeLessThan(70);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('with reduced motion the room holds still, and with motion allowed it moves (Req 10.3)', async ({ page, request }) => {
  const running = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
          return `${target?.tagName.toLowerCase()}.${(target?.getAttribute('class') ?? '').split(' ')[0]} ${(a as CSSAnimation).animationName ?? 'transition'}`;
        }),
    );
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');

  // Allowed: the flame flickers, so something is running.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await running()).length).toBeGreaterThan(0);

  // Reduced: every animation, in every room, runs out at once and none keeps going (flicker, embers, seal).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [days, title] of [
    [0, 'The candle burns'],
    [30, 'The flame gutters'],
    [7, 'The candle has gone out'],
  ] as const) {
    if (days) expect((await request.post('/api/dev/clock', { data: { days } })).ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId('state-title')).toHaveText(title);
    await expect.poll(running).toEqual([]);
  }
});

test('the writing desk and the vigil fit a 360 px screen without sideways scrolling (Req 10.5)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  // Measured against 360, not innerWidth: a phone widens its layout viewport to fit overflowing content.
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - 360);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  expect(await overflow()).toBeLessThanOrEqual(0);
  // The drawer is part of the vigil's screen too.
  await page.getByRole('button', { name: /time machine/i }).click();
  await expect(page.getByRole('complementary', { name: /time machine/i })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: /close the time machine/i }).click();

  await page.getByTestId('write-letter').click();
  await expect(page.getByRole('heading', { name: 'Write a letter' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  // Nothing on the desk is cut off at the right edge. The formatting toolbar scrolls inside itself by design.
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main input, main button, main select, main [contenteditable], main label')]
      .filter((el) => !el.closest('[role="toolbar"]'))
      .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > 360.5)
      .map((el) => el.tagName + '.' + el.className),
  );
  expect(clipped).toEqual([]);

  // After sealing, the keepsake card must fit too.
  await page.getByLabel('For', { exact: true }).fill('Theo Whitlock');
  await page.getByLabel('Their email').fill('theo@example.com');
  await page.getByRole('textbox', { name: 'Your letter' }).click();
  await page.keyboard.type('The spare key is under the third stone.');
  await page.getByTestId('seal-letter').click();
  await expect(page.getByTestId('keepsake-card')).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('no ancestor clips the glow of the "Seal the letter" button, and the page still does not widen at 360 px (Req 10.5)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await page.getByTestId('write-letter').click();
  const seal = page.getByRole('button', { name: 'Seal the letter' });
  await expect(seal).toBeVisible();

  // The glow is a box-shadow, so any ancestor that clips or hides overflow between the button and <main> cuts it off.
  const glow = await seal.evaluate((button) => {
    const clippers: string[] = [];
    for (let el = button.parentElement; el && el.tagName !== 'MAIN'; el = el.parentElement) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'clip' || overflowX === 'hidden') clippers.push(`${el.tagName.toLowerCase()}.${el.className} (${overflowX})`);
    }
    return { shadow: getComputedStyle(button).boxShadow, clippers };
  });
  expect(glow.shadow).not.toBe('none');
  expect(glow.clippers).toEqual([]);

  // Keeping the stamp from widening the page is still true, with the unpressed stamp in place.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
});
