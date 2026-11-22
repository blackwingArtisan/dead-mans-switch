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

  // The monthly tap can go in the author's own calendar, as a repeating event with no secrets in it.
  const [ics] = await Promise.all([page.waitForEvent('download'), page.getByTestId('add-to-calendar').click()]);
  expect(ics.suggestedFilename()).toBe('keep-the-candle-lit.ics');
  const calendar = await (await import('node:fs/promises')).readFile((await ics.path())!, 'utf8');
  expect(calendar).toContain('RRULE:FREQ=DAILY;INTERVAL=30');

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
  // Download and print come first; letting it go leaves only ash.
  await expect(theo.getByRole('button', { name: 'Keep this letter (download)' })).toBeVisible();
  await theo.getByTestId('let-it-go').click();
  await expect(theo.getByTestId('ash')).toContainText('The vault has forgotten its copy');
  await expect(theo.getByTestId('opened-letter')).toHaveCount(0);

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
  // The hint and "Light the room" sit on the sheet, above the fold, and the first light is wide.
  await expect(sheet.getByTestId('candle-hint')).toBeInViewport();
  await expect(sheet.getByRole('button', { name: 'Light the room' })).toBeInViewport();
  await expect(sheet).toHaveClass(/letter__page--first-light/);
  // She reads by Mara's own candle.
  await expect(june.getByTestId('their-candle')).toContainText('This is the candle Mara kept until');
  await expect(june.locator('body')).toHaveAttribute('data-room', 'released');
  await june.waitForTimeout(1200); // let the page finish unfolding
  const box = (await sheet.boundingBox())!;
  await june.mouse.move(box.x + 120, box.y + 160);
  await expect
    .poll(async () => Math.abs(parseFloat(await sheet.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--x'))) - 120))
    .toBeLessThanOrEqual(2);
  await expect(sheet).not.toHaveClass(/letter__page--first-light/);
  // The reader's own flame sits at the light, and the light is warm.
  await expect(june.locator('.letter__flame')).toBeVisible();
  const shade = await june.locator('.letter__shade').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(shade).toContain('rgba(255, 170, 80, 0.18)');
  await june.getByRole('button', { name: 'Light the room' }).click();
  await expect(june.locator('.letter__flame')).toBeHidden();
  await expect(sheet).toHaveClass(/letter__page--lit/);
  await expect(june.locator('.letter__from')).toHaveClass(/letter__from--signed/);
  // A candle lit back: one line, once, and the author's headstone carries it.
  await june.getByLabel(/Leave one line for the others who loved Mara/).fill('I found the password sheet. Biscuit is fed.');
  await june.getByTestId('light-candle').click();
  await expect(june.getByTestId('candle-mine')).toContainText('Your candle is lit.');
  await expect(june.getByTestId('candles-lit')).toContainText('I found the password sheet. Biscuit is fed.');
  await expect(june.getByLabel(/Leave one line/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('epitaph-candles')).toContainText('June Okafor');
  // The witnesses and Theo are told by email, since their links are spent by now.
  const panel = await openTimeMachine(page);
  await expect(panel.locator('.outbox__item[data-kind="candle-lit"]')).toHaveCount(3);
  // With motion allowed the page chars from its edges before it turns to ash.
  await june.getByTestId('let-it-go').click();
  await expect(sheet).toHaveClass(/letter__page--burning/);
  await expect(june.locator('.letter__char')).toBeVisible();
  await expect(june.getByTestId('ash')).toBeVisible({ timeout: 8000 });
  await expect(june.getByRole('heading', { name: 'It is ash now' })).toBeFocused();
  await ctx.close();
});

test('an opened letter can be downloaded as a file and printed as the letter alone (Req 7.8, 7.16)', async ({ page, request, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  // Silence, then the silence window with no denial: the letters are released with no witness answering.
  expect((await request.post('/api/dev/clock', { data: { days: 38 } })).ok()).toBe(true);
  expect((await request.post('/api/dev/clock', { data: { days: 15 } })).ok()).toBe(true);
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { name: string }; text: string }[] };
  const release = messages.find((m) => m.kind === 'release' && m.to.name === 'June Okafor');
  expect(release).toBeTruthy();
  const href = release!.text.match(/https?:\/\/\S+/)![0];

  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const reader = await ctx.newPage();
  // The browser's print dialog cannot be driven, so record the call and check what the print layout shows.
  await reader.addInitScript(() => {
    (window as unknown as { printCalls: number }).printCalls = 0;
    window.print = () => {
      (window as unknown as { printCalls: number }).printCalls += 1;
    };
  });
  await reader.goto(href);
  await reader.getByTestId('break-seal').click();
  const letter = reader.getByTestId('opened-letter');
  await expect(letter).toContainText('Biscuit eats twice a day');

  // Req 7.8: the letter downloads as a standalone page with its title, text and sign-off, and no script.
  const [file] = await Promise.all([reader.waitForEvent('download'), reader.getByRole('button', { name: 'Keep this letter (download)' }).click()]);
  expect(file.suggestedFilename()).toBe('letter-from-mara-whitlock.html');
  const saved = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
  expect(saved).toContain('<h1>June, the passwords and the cat</h1>');
  expect(saved).toContain('Biscuit eats twice a day');
  expect(saved).not.toMatch(/<script/i);

  // Req 7.16: Print asks the browser to print, and the print layout is the letter without the page's controls.
  expect(await reader.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(0);
  await reader.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await reader.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  await reader.emulateMedia({ media: 'print' });
  await expect(letter).toContainText('Biscuit eats twice a day');
  await expect(reader.locator('.letter__after')).toBeHidden();
  await expect(reader.getByRole('button', { name: 'Print', exact: true })).toBeHidden();
  await expect(reader.locator('header.masthead')).toBeHidden();
  await ctx.close();
});

test('the keepsake page remembers the half in the recipient\u2019s browser, shows the printable code and never sends it (Req 3.6, 3.8, 3.9)', async ({ page, request, browser }) => {
  // The author seals a letter in keepsake custody for a new recipient.
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await page.getByTestId('write-letter').click();
  await page.getByLabel('For', { exact: true }).fill('Wren Ashby');
  await page.getByLabel('Their email').fill('wren@example.com');
  await page.getByRole('textbox', { name: 'Your letter' }).click();
  await page.keyboard.type('The ledger is in the bottom drawer of the oak desk.');
  await page.getByTestId('seal-letter').click();
  await expect(page.getByTestId('keepsake-card')).toBeVisible();
  const keepsakeLink = await page.getByTestId('keepsake-link').inputValue();
  const cardCode = ((await page.getByLabel('Keepsake code').textContent()) ?? '').trim();
  const [, letterId = '', half = ''] = keepsakeLink.match(/\/keepsake\/(L[\w-]+)#k=([\w-]{43})/) ?? [];
  expect(half).toHaveLength(43);
  expect(cardCode).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4})+$/);

  // The recipient, in a fresh browser, follows the keepsake link. Every request the browser makes is recorded.
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const wren = await ctx.newPage();
  const sent: string[] = [];
  ctx.on('request', (r) => {
    sent.push(`${r.method()} ${r.url()} ${r.postData() ?? ''} ${JSON.stringify(r.headers())}`);
  });
  await wren.goto(keepsakeLink);
  await expect(wren.getByRole('heading', { level: 1 })).toContainText('Mara Whitlock entrusted you with a keepsake');
  // Req 3.8: the printable code is on the page, and it is the code on the author's card.
  await expect(wren.getByTestId('keepsake-code')).toHaveText(cardCode);
  await expect(wren.getByRole('button', { name: 'Print this keepsake' })).toBeVisible();
  // Req 3.6: this browser remembers the half, under this letter only.
  await expect.poll(() => wren.evaluate((id) => localStorage.getItem(`dms.keepsake.${id}`), letterId)).toBe(half);
  // Req 3.9: nothing carrying the half, in either form, left the browser, and the page called no vault route.
  const bare = cardCode.replace(/-/g, '');
  expect(sent.filter((line) => line.includes(half) || line.includes(cardCode) || line.includes(bare))).toEqual([]);
  // (The local time-machine drawer polls /api/dev/*; that is the demo chrome, not the keepsake page.)
  expect(sent.filter((line) => /\/api\/(?!dev\/)/.test(line))).toEqual([]);

  // Later the vigil is released. The same browser opens the one-time link with no keepsake to paste.
  expect((await request.post('/api/dev/clock', { data: { days: 38 } })).ok()).toBe(true);
  expect((await request.post('/api/dev/clock', { data: { days: 15 } })).ok()).toBe(true);
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { name: string }; text: string; html?: string }[] };
  const release = messages.find((m) => m.kind === 'release' && m.to.name === 'Wren Ashby')!;
  expect(release).toBeTruthy();
  expect(JSON.stringify(release)).not.toContain(half);
  const href = release.text.match(/https?:\/\/\S+/)![0];
  expect(href).not.toContain('#k=');
  sent.length = 0;
  await wren.goto(href);
  await expect(wren.getByTestId('keepsake-ready')).toContainText('Your keepsake was found on this device');
  await expect(wren.getByLabel('Your keepsake')).toHaveCount(0);
  await wren.getByTestId('break-seal').click();
  await expect(wren.getByTestId('opened-letter')).toContainText('The ledger is in the bottom drawer of the oak desk.');
  // Opening checks the tag and breaks the seal, but still never sends the half.
  expect(sent.filter((line) => line.includes(half) || line.includes(cardCode) || line.includes(bare))).toEqual([]);

  // A different browser that was never shown the keepsake remembers nothing.
  const stranger = await browser.newContext({ reducedMotion: 'reduce' });
  const other = await stranger.newPage();
  await other.goto('/');
  expect(await other.evaluate((id) => localStorage.getItem(`dms.keepsake.${id}`), letterId)).toBeNull();
  await stranger.close();
  await ctx.close();
});

test('the demo guide says what to try next, and the room dies and relights with the candle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  const guide = page.getByTestId('guide');
  await expect(guide).toContainText('Next: Open the Time machine');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'alive');
  await expect(page.locator('.tm-toggle')).toHaveClass(/tm-toggle--pulse/);
  // The haunted tab: a lit candle and the plain name while the vigil is kept.
  await expect(page).toHaveTitle('Last Candle');
  const icon = page.locator('link[rel="icon"]');
  const litIcon = await icon.getAttribute('href');
  expect(litIcon).toMatch(/^data:image\/svg\+xml,/);
  // The grace warning is opt-in, asked for only by a press. Headless Chromium always reports notifications
  // as denied, so the browser's Notification is stood in for by one that records what it is asked to show.
  await page.addInitScript(() => {
    const shown: string[] = [];
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static async requestPermission() {
        FakeNotification.permission = 'granted';
        return 'granted' as const;
      }
      constructor(title: string) {
        shown.push(title);
      }
    }
    Object.assign(window, { Notification: FakeNotification, shownNotices: shown });
  });
  await page.reload();
  await page.getByTestId('grace-notice').click();
  await expect(page.getByTestId('grace-notice-on')).toContainText('This browser will warn you if it gutters.');
  expect(await page.evaluate(() => (window as unknown as { shownNotices: string[] }).shownNotices)).toEqual([]);

  await openTimeMachine(page);
  await expect(page.locator('.tm-toggle')).not.toHaveClass(/tm-toggle--pulse/);
  await travel(page, '+30 days');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'grace');
  await expect(page).toHaveTitle('(!) Your candle gutters · Last Candle');
  // In grace, the device that opted in is warned once.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { shownNotices: string[] }).shownNotices))
    .toEqual(['Your candle gutters']);
  expect(await icon.getAttribute('href')).not.toBe(litIcon);
  // The drawer steps aside after a jump, and its note waits by the button.
  await expect(page.getByTestId('tm-toast')).toContainText('A month passed');
  await expect(guide).toContainText('Press +7 days');
  await travel(page, '+7 days');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'confirm');
  await expect(page.getByRole('status').filter({ hasText: 'The room has gone dark' })).toBeAttached();
  await expect(page).toHaveTitle('The candle is out · Last Candle');
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
  await expect(page).toHaveTitle('Last Candle');
  await expect(icon).toHaveAttribute('href', '/favicon.svg');
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
  // It closes on Mara's own candle, as she left it.
  await expect(caption).toContainText('Their candle, your light');
  await expect(page.getByTestId('their-candle')).toContainText('This is the candle Mara kept until');
  await expect(page.getByTestId('their-candle').locator('svg.candle')).toBeInViewport();
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

test('each room has its own colour, and the landing candle answers the pointer', async ({ page }) => {
  await page.goto('/');
  // The flame leans toward the pointer, and a click snuffs it before a match relights it.
  const candle = page.getByTestId('hero-candle');
  const box = (await candle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 500, box.y + 40);
  await expect.poll(() => candle.evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue('--lean')))).toBeGreaterThan(5);
  await candle.click();
  await expect(candle.locator('svg.candle')).toHaveClass(/candle--confirm/);
  await expect(candle.locator('svg.candle')).toHaveClass(/candle--alive/, { timeout: 5000 });

  const layer = (name: string) => page.locator(`.atmosphere__${name}`).evaluate((el) => getComputedStyle(el).opacity);
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-room', 'alive');
  expect(await layer('sick')).toBe('0');
  await travel(page, '+30 days');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'grace');
  await expect.poll(() => layer('sick')).toBe('1'); // green-grey
  // Grace stays smooth: nothing in the room is filtered or blended, the warmth stops breathing, and the
  // summons pulse moves only by transform and opacity (it once repainted the seal's SVG filters every frame).
  const room = await page.evaluate(() => {
    const css = (sel: string, pseudo?: string) => getComputedStyle(document.querySelector(sel)!, pseudo);
    return {
      grain: css('.atmosphere__grain').mixBlendMode,
      warm: css('.atmosphere__warm').filter,
      glow: css('.atmosphere__glow').animationName,
      button: css('[data-testid="check-in"]').animationName,
      ring: css('[data-testid="check-in"]', '::after').animationName,
    };
  });
  expect(room).toEqual({ grain: 'normal', warm: 'none', glow: 'none', button: 'none', ring: 'summon' });
  await travel(page, '+7 days');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'confirm');
  await expect.poll(() => layer('deep')).toBe('1'); // blue-black
  await expect.poll(() => layer('smoke')).toBe('1');
  expect(await layer('sick')).toBe('0');
});

test('the sealed export and the saved offline page open a letter with no server', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);

  // The author downloads the sealed export and the offline page from the vigil.
  const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-letters').click()]);
  expect(exported.suggestedFilename()).toBe('sealed-letters.json');
  const exportPath = (await exported.path())!;
  const [saved] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export').getByRole('link', { name: 'this one page' }).click(),
  ]);
  expect(saved.suggestedFilename()).toBe('offline-open.html');
  const pagePath = `${(await saved.path())!}.html`;
  await saved.saveAs(pagePath);
  const sealed = JSON.parse(await (await import('node:fs/promises')).readFile(exportPath, 'utf8')) as {
    letters: { id: string; recipientName: string; keepsakeHalf?: string }[];
  };
  const theo = sealed.letters.find((l) => l.recipientName === 'Theo Whitlock')!;
  // A keepsake-custody letter leaves its half with the author's browser and the recipient, never in the export.
  expect(theo.keepsakeHalf).toBeUndefined();
  const theoHalf = (await page.evaluate((id) => localStorage.getItem(`dms.authored.${id}`), theo.id))!;

  // Years later, with the service gone: a fresh browser with no network opens the saved page from disk.
  const offline = await browser.newContext({ offline: true });
  const reader = await offline.newPage();
  const requests: string[] = [];
  reader.on('request', (r) => {
    if (!r.url().startsWith('file:')) requests.push(r.url());
  });
  await reader.goto(`file://${pagePath}`);
  await expect(reader.getByRole('heading', { name: 'Open a sealed letter offline' })).toBeVisible();
  await reader.getByLabel('1. The sealed export').setInputFiles(exportPath);
  await reader.getByLabel('2. The letter').selectOption({ label: 'For Theo Whitlock' });

  // The wrong keepsake breaks nothing.
  await reader.getByLabel('3. The keepsake').fill('0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000');
  await reader.getByRole('button', { name: 'Break the seal' }).click();
  await expect(reader.getByRole('alert')).toContainText('The seal will not break');

  await reader.getByLabel('3. The keepsake').fill(`https://vigil.example.com/keepsake/${theo.id}#k=${theoHalf}`);
  await reader.getByRole('button', { name: 'Break the seal' }).click();
  await expect(reader.getByRole('heading', { name: 'For Theo, when the lights go out' })).toBeVisible();
  await expect(reader.getByText('The deed to the cottage is in the blue tin')).toBeVisible();

  // June's vault-custody letter needs no keepsake.
  await reader.getByLabel('3. The keepsake').fill('');
  await reader.getByLabel('2. The letter').selectOption({ label: 'For June Okafor (vault custody, no keepsake needed)' });
  await reader.getByRole('button', { name: 'Break the seal' }).click();
  await expect(reader.getByRole('heading', { name: 'June, the passwords and the cat' })).toBeVisible();
  expect(requests).toEqual([]);
  await offline.close();
});
