import { expect, test, type Page } from '@playwright/test';

// Every test starts from an empty world at the real today.
test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

/** Collects Content-Security-Policy violations reported on a page, so the strict policy is proven not to break the app. */
function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  return violations;
}

async function openTimeMachine(page: Page) {
  const panel = page.getByRole('complementary', { name: /time machine/i });
  if (!(await panel.isVisible())) await page.getByRole('button', { name: /time machine/i }).click();
  return panel;
}

async function outboxLink(page: Page, kind: string, recipient: string): Promise<string> {
  const panel = await openTimeMachine(page);
  const item = panel.locator(`.outbox__item[data-kind="${kind}"]`).filter({ hasText: `to ${recipient}` }).first();
  await expect(item).toBeVisible();
  const href = await item.locator('a.outbox__link').getAttribute('href');
  expect(href).toBeTruthy();
  return href!;
}

test('write a letter, fall silent, witness confirms, recipient opens it once', async ({ page, browser }) => {
  const cspViolations = watchCsp(page);
  // The author begins a vigil.
  const landing = await page.goto('/');
  expect(landing?.headers()['content-security-policy']).toContain("script-src 'self'");
  await page.getByLabel('Your name').fill('Mara Whitlock');
  await page.getByLabel('Your email').fill('mara@example.com');
  await page.getByRole('button', { name: 'Light the candle' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');

  // Names a witness.
  const witnessForm = page.getByRole('form', { name: 'Name a witness' });
  await witnessForm.getByLabel('Name').fill('Silas Crane');
  await witnessForm.getByLabel('Email').fill('silas@example.com');
  await witnessForm.getByRole('button', { name: 'Name witness' }).click();
  await expect(page.getByText('silas@example.com')).toBeVisible();

  // Writes and seals a letter in keepsake custody.
  await page.getByTestId('write-letter').click();
  await page.getByLabel('For', { exact: true }).fill('Theo Whitlock');
  await page.getByLabel('Their email').fill('theo@example.com');
  await page.getByLabel(/^Title/).fill('For Theo, when the lights go out');
  await page.getByRole('textbox', { name: 'Your letter' }).click();
  await page.keyboard.type('The spare key is under the third stone by the gate. I am so proud of you.');
  await page.getByTestId('seal-letter').click();
  await expect(page.getByTestId('sealed-title')).toBeVisible();
  const keepsakeLink = await page.getByTestId('keepsake-link').inputValue();
  expect(keepsakeLink).toMatch(/\/keepsake\/L[\w-]+#k=[\w-]{43}/);
  await page.getByTestId('back-to-vigil').click();
  await expect(page.getByTestId('envelope')).toHaveCount(1);

  // The time machine: a month passes with no check-in, then the grace period.
  const tm = await openTimeMachine(page);
  await tm.getByRole('button', { name: '+30 days' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await tm.getByRole('button', { name: '+7 days' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');

  // The witness, in their own browser, confirms.
  const witnessHref = await outboxLink(page, 'witness-ask', 'Silas Crane');
  const witnessCtx = await browser.newContext({ reducedMotion: 'reduce' });
  const witness = await witnessCtx.newPage();
  await witness.goto(witnessHref);
  await expect(witness.getByRole('heading', { name: 'Mara Whitlock named you a witness' })).toBeVisible();
  await witness.getByTestId('witness-confirm').click();
  await witness.getByTestId('witness-confirm-final').click();
  await expect(witness.getByTestId('witness-done')).toContainText('letters have now been delivered');
  await witnessCtx.close();

  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered', { timeout: 15_000 });

  // The recipient, in a fresh browser, opens the one-time link with their keepsake.
  const releaseHref = await outboxLink(page, 'release', 'Theo Whitlock');
  const theoCtx = await browser.newContext({ reducedMotion: 'reduce' });
  const theo = await theoCtx.newPage();
  const theoCsp = watchCsp(theo);
  await theo.goto(releaseHref);
  await expect(theo.getByRole('heading', { name: 'A letter from Mara Whitlock' })).toBeVisible();

  // A wrong keepsake is refused without spending the one-time link.
  await theo.getByLabel('Your keepsake').fill('0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000');
  await theo.getByTestId('break-seal').click();
  await expect(theo.getByRole('alert')).toContainText('belongs to a different letter');

  await theo.getByLabel('Your keepsake').fill(keepsakeLink);
  await theo.getByTestId('break-seal').click();
  const letter = theo.getByTestId('opened-letter');
  await expect(letter).toContainText('For Theo, when the lights go out');
  await expect(letter).toContainText('The spare key is under the third stone by the gate.');
  // Under reduced motion the letter opens fully lit, with no candlelight reveal.
  await expect(theo.getByTestId('letter-page')).toHaveClass(/letter__page--lit/);
  await expect(theo.getByTestId('candle-hint')).toHaveCount(0);

  // One time only.
  await theo.reload();
  await expect(theo.getByRole('heading', { name: 'This seal has already been broken' })).toBeVisible();
  await theoCtx.close();

  // The strict CSP never got in the way, for the author or the recipient.
  expect([...cspViolations, ...theoCsp]).toEqual([]);
});

test('a check-in during grace cancels everything', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  const tm = await openTimeMachine(page);
  await tm.getByRole('button', { name: '+30 days' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await page.getByRole('button', { name: /close the time machine/i }).click();
  await page.getByTestId('check-in').click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  await expect(page.locator('.ledger')).toContainText('Checked in.');
});

test('a vault-custody letter opens from its link alone', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  const tm = await openTimeMachine(page);
  await tm.getByRole('button', { name: 'Skip to the next event' }).click(); // reminder
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns low');
  await tm.getByRole('button', { name: '+30 days' }).click(); // past grace: witnesses asked
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');
  await tm.getByRole('button', { name: '+30 days' }).click(); // silence window passes
  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered');

  const href = await outboxLink(page, 'release', 'June Okafor');
  expect(href).toContain('#k=');
  // With motion allowed, June reads by candlelight: the page starts dark, the light follows her pointer,
  // and "Light the room" shows it all. The text is in the page throughout for assistive technology.
  const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
  const june = await ctx.newPage();
  await june.goto(href);
  await expect(june.getByTestId('keepsake-ready')).toContainText('carries its own key');
  await june.getByTestId('break-seal').click();
  await expect(june.getByTestId('opened-letter')).toContainText('Biscuit eats twice a day');
  const sheet = june.getByTestId('letter-page');
  await expect(sheet).toHaveClass(/letter__page--dark/);
  await expect(june.locator('body')).toHaveAttribute('data-room', 'released');
  await june.waitForTimeout(1200); // let the page finish unfolding
  const box = (await sheet.boundingBox())!;
  await june.mouse.move(box.x + 120, box.y + 160);
  await expect
    .poll(async () => Math.abs(parseFloat(await sheet.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--x'))) - 120))
    .toBeLessThanOrEqual(2);
  await june.getByRole('button', { name: 'Light the room' }).click();
  await expect(sheet).toHaveClass(/letter__page--lit/);
  await expect(june.locator('.letter__from')).toHaveClass(/letter__from--signed/);
  await ctx.close();
});

test('the demo guide says what to try next, and the room dies and relights with the candle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  const guide = page.getByTestId('guide');
  await expect(guide).toContainText('Next: Open the Time machine');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'alive');
  await expect(page.locator('.tm-toggle')).toHaveClass(/tm-toggle--pulse/);

  const tm = await openTimeMachine(page);
  await expect(page.locator('.tm-toggle')).not.toHaveClass(/tm-toggle--pulse/);
  await tm.getByRole('button', { name: '+30 days' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-room', 'grace');
  await expect(guide).toContainText('Press +7 days');
  await tm.getByRole('button', { name: '+7 days' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-room', 'confirm');
  await expect(page.getByRole('status').filter({ hasText: 'The room has gone dark' })).toBeAttached();
  await expect(guide).toContainText('Witness asked');

  await page.getByRole('button', { name: /close the time machine/i }).click();
  await page.getByTestId('check-in').click();
  await expect(page.locator('body')).toHaveAttribute('data-room', 'alive');
  await expect(page.getByRole('status').filter({ hasText: 'the room is warm again' })).toBeAttached();

  await page.getByRole('button', { name: 'Dismiss the demo guide' }).click();
  await expect(guide).toHaveCount(0);
  await page.getByRole('link', { name: 'How the seal works' }).click();
  await expect(page.getByRole('heading', { name: 'How the seal works' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-room', /.+/);
});

test("a founder's demo vigil seals Priya's letters and names her own witness in the guide", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'or a founder’s vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await expect(page.getByText('The vigil of Priya Raman')).toBeVisible();
  await expect(page.getByTestId('envelope').filter({ hasText: 'For Tomás Rivera' })).toContainText('Vault custody');
  const tm = await openTimeMachine(page);
  await tm.getByRole('button', { name: '+30 days' }).click();
  await tm.getByRole('button', { name: '+7 days' }).click();
  await expect(page.getByTestId('guide')).toContainText('“Witness asked” for Noor Haddad');
});

test('"Play the whole story" runs the lifecycle hands-off, with captions, to an opened letter', async ({ page }) => {
  // A fifth of the real pace: about eight seconds, slow enough that every caption is seen.
  await page.goto('/?story-pace=0.2');
  await page.getByTestId('play-story').click();
  const caption = page.getByTestId('story');
  await expect(caption).toContainText('Mara keeps a vigil');
  await expect(caption).toContainText('Silas, her witness, confirms', { timeout: 20_000 });
  await expect(caption).toContainText('She reads it by her last candle', { timeout: 20_000 });
  await expect(page.getByTestId('opened-letter')).toContainText('Biscuit eats twice a day');
  // The last caption stays as an end card until it is closed.
  await expect(caption).toContainText('Some words should wait', { timeout: 20_000 });
  await expect(caption).not.toContainText('of 7');
  await caption.getByRole('button', { name: 'Close' }).click();
  await expect(caption).toHaveCount(0);
});
