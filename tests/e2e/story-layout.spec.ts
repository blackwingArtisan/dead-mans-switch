import { expect, test, type Locator, type Page } from '@playwright/test';

// The story caption is fixed to the bottom of the screen (to the top on a phone). While it plays, the page keeps room for it,
// so the controls it would otherwise sit on can be scrolled clear of it. Chrome honours the page's scroll-padding when it
// scrolls an element into view, so "scrolled into view" below is what a reader, or the story itself, sees.

const SIZES = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

async function expectClearOfCaption(page: Page, target: Locator, what: string): Promise<void> {
  await target.evaluate((el) => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  const caption = (await page.getByTestId('story').boundingBox())!;
  const box = (await target.boundingBox())!;
  const overlaps = box.x < caption.x + caption.width && caption.x < box.x + box.width && box.y < caption.y + caption.height && caption.y < box.y + box.height;
  expect(overlaps, `${what} (${JSON.stringify(box)}) sits under the caption (${JSON.stringify(caption)})`).toBe(false);
  // And it is on screen, not scrolled out of reach.
  await expect(target).toBeInViewport();
}

for (const size of SIZES) {
  test(`the story caption leaves the stage track, the letter's Keep and Print controls and the candles lit back uncovered at ${size.name} (Req 10.15)`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/?story-pace=0.2');
    await page.getByTestId('play-story').click();
    const caption = page.getByTestId('story');

    // The vigil: every stage label can be brought clear of the caption.
    await expect(caption).toContainText('Mara keeps a vigil');
    await expect(page.getByTestId('state-title')).toBeVisible();
    const labels = page.locator('.stages__label');
    await expect(labels).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expectClearOfCaption(page, labels.nth(i), `stage label ${i + 1}`);

    // The open page, on the end card: the controls are the point of the letter.
    await expect(page.getByTestId('opened-letter')).toBeVisible({ timeout: 30_000 });
    await expect(caption).toContainText('One went out. Two were lit.', { timeout: 120_000 });
    await expectClearOfCaption(page, page.getByRole('button', { name: 'Keep this letter (download)' }), 'Keep this letter');
    await expectClearOfCaption(page, page.getByRole('button', { name: 'Print', exact: true }), 'Print');
    await expectClearOfCaption(page, page.getByTestId('candles-beside'), 'the candles lit back');

    // The room the caption needs is reserved only while it is shown.
    await caption.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('body')).not.toHaveAttribute('data-story', /.*/);
  });
}
