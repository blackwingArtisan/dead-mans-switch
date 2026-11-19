import AxeBuilder from '@axe-core/playwright';
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

/** Presses one Time machine button. The drawer closes itself after each jump, so open it first. */
async function travel(page: Page, label: string) {
  const panel = await openTimeMachine(page);
  await panel.getByRole('button', { name: label }).click();
  await expect(panel).toBeHidden();
}

async function outboxLink(page: Page, kind: string, recipient: string): Promise<string> {
  const panel = await openTimeMachine(page);
  const item = panel.locator(`.outbox__item[data-kind="${kind}"]`).filter({ hasText: `to ${recipient}` }).first();
  await expect(item).toBeVisible();
  // Release and witness emails show their body; others open with a click on the summary.
  if ((await item.locator('a.outbox__link').count()) === 0) await item.locator('.outbox__summary').click();
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
  // The fold plays on screen: the page returns to the top and focus moves to the heading.
  await expect(page.getByTestId('sealed-title')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const keepsakeLink = await page.getByTestId('keepsake-link').inputValue();
  expect(keepsakeLink).toMatch(/\/keepsake\/L[\w-]+#k=[\w-]{43}/);
  await expect(page.getByTestId('key-split')).toContainText('Goes to Theo, on the card below');
  await expect(page.getByRole('img', { name: 'QR code of the keepsake link for Theo Whitlock' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('keepsake-card')).toBeVisible();
  await expect(page.getByTestId('key-split')).toBeHidden();
  await expect(page.getByTestId('sealed-title')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.getByTestId('back-to-vigil').click();
  await expect(page.getByTestId('envelope')).toHaveCount(1);

  // The time machine: a month passes with no check-in, then the grace period.
  await travel(page, '+30 days');
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await travel(page, '+7 days');
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
  await expect(witness.getByTestId('drifting-envelopes').locator('svg')).toHaveCount(3);
  await witnessCtx.close();

  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered', { timeout: 15_000 });
  const kept = (await page.getByTestId('epitaph').locator('.epitaph__dates').textContent()) ?? '';
  const [, from, to] = kept.match(/Kept from (.+) to (.+)/) ?? [];
  expect(from).toBeTruthy();
  expect(from).not.toBe(to);
  await expect(page.getByTestId('epitaph')).toContainText('One letter delivered · none opened yet');

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
  await travel(page, '+30 days');
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await page.getByTestId('check-in').click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  await expect(page.locator('.ledger')).toContainText('Checked in.');
});

test('the grace email checks in with one tap on another device, once, without opening the vigil', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await travel(page, '+30 days');
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  const link = await outboxLink(page, 'grace', 'Mara Whitlock');
  expect(link).toMatch(/\/check-in\/[\w-]{43}$/);

  // A phone that has never seen the vigil: no owner key in its storage.
  const phone = await browser.newContext();
  const p = await phone.newPage();
  await p.goto(link);
  await expect(p.getByRole('heading', { level: 1 })).toHaveText('Are you still with us, Mara?');
  const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await p.getByTestId('checkin-link-button').click();
  await expect(p.getByTestId('checkin-link-done')).toContainText('The candle is lit again');
  await expect(p.getByText('Write a letter')).toHaveCount(0);

  await p.reload();
  await expect(p.getByTestId('checkin-link-error')).toContainText('used or has expired');
  await phone.close();

  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
});

test('a vault-custody letter opens from its link alone', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await travel(page, 'Skip to the next event'); // reminder
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns low');
  await travel(page, '+30 days'); // past grace: witnesses asked
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');
  await travel(page, '+30 days'); // silence window passes
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
  // The reader's own flame sits at the light, and the light is warm.
  await expect(june.locator('.letter__flame')).toBeVisible();
  const shade = await june.locator('.letter__shade').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(shade).toContain('rgba(255, 170, 80, 0.18)');
  await june.getByRole('button', { name: 'Light the room' }).click();
  await expect(june.locator('.letter__flame')).toBeHidden();
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

  await openTimeMachine(page);
  await expect(page.locator('.tm-toggle')).not.toHaveClass(/tm-toggle--pulse/);
  await travel(page, '+30 days');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'grace');
  // The drawer steps aside after a jump, and its note waits by the button.
  await expect(page.getByTestId('tm-toast')).toContainText('A month passed');
  await expect(guide).toContainText('Press +7 days');
  await travel(page, '+7 days');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'confirm');
  await expect(page.getByRole('status').filter({ hasText: 'The room has gone dark' })).toBeAttached();
  await expect(guide).toContainText('Witness asked');
  // The guide names Silas, so his is the first "Witness asked" in the outbox.
  const panel = await openTimeMachine(page);
  await expect(panel.locator('.outbox__item[data-kind="witness-ask"]').first()).toContainText('to Silas Crane');
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
  await travel(page, '+30 days');
  await travel(page, '+7 days');
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
  // The story ends on the whole letter in full light, signature included.
  await expect(page.getByTestId('letter-page')).toHaveClass(/letter__page--lit/);
  await expect(page.locator('.letter__from')).toHaveClass(/letter__from--signed/);
  await caption.getByRole('button', { name: 'Close' }).click();
  await expect(caption).toHaveCount(0);
});

test('a second demo vigil starts with an empty outbox, and presenter mode hides the demo chrome', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await travel(page, '+30 days');
  await expect(page.locator('.tm-toggle__count')).toBeVisible();

  // Starting the demo again clears the earlier run's mail.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/?presenter=1');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  const panel = await openTimeMachine(page);
  await expect(panel.locator('.outbox__item[data-kind="grace"]')).toHaveCount(0);
  await page.getByRole('button', { name: /close the time machine/i }).click();

  // Presenter mode: no guide, no badge, and the button fades until it is hovered or focused.
  await expect(page.getByTestId('guide')).toBeHidden();
  await expect(page.locator('.tm-toggle__count')).toBeHidden();
  await page.mouse.move(10, 10);
  await expect.poll(() => page.locator('.tm-toggle').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  // It lasts for the tab, across in-app navigation, until ?presenter=0.
  await page.goto('/how-it-works');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', '');
  await page.goto('/?presenter=0');
  await expect(page.locator('html')).not.toHaveAttribute('data-presenter', /.*/);
});
