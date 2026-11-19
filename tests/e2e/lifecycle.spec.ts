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
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const june = await ctx.newPage();
  await june.goto(href);
  await expect(june.getByTestId('keepsake-ready')).toContainText('carries its own key');
  await june.getByTestId('break-seal').click();
  await expect(june.getByTestId('opened-letter')).toContainText('Biscuit eats twice a day');
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
