import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// "Play the whole story", through the real app. Every test starts from an empty world and plays at a fifth of the pace.
test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

interface LedgerEntry {
  kind: string;
  note: string;
}

/** The author's ledger, oldest entry first, read with the owner token this browser holds. (The API sends it newest first.) */
async function ledger(page: Page): Promise<LedgerEntry[]> {
  const token = await page.evaluate(() => localStorage.getItem('dms.owner'));
  const res = await page.request.get('/api/vault', { headers: { Authorization: `Bearer ${token}` } });
  return ((await res.json()) as { history: LedgerEntry[] }).history.reverse();
}

const playing = (page: Page) => page.getByTestId('story').locator('.story__step');

test('the story plays a false alarm: Silas stops the release with a note, Mara relights, and the second time he confirms (Req 12.1, 12.2, 12.3, 12.4, 12.5, 6.18)', async ({ page, request }) => {
  await page.goto('/?story-pace=0.2');
  await page.getByTestId('play-story').click();
  const caption = page.getByTestId('story');

  // Each beat says what is happening, in order, in the polite live region.
  await expect(caption.getByRole('status')).toContainText('The candle goes out');
  await expect(caption.getByRole('status')).toContainText('False alarm');
  await expect(caption.getByRole('status')).toContainText('Mara was hiking');
  await expect(caption.getByRole('status')).toContainText('taps “I still walk among the living”');
  await expect(caption.getByRole('status')).toContainText('goes out a second time');
  await expect(caption.getByRole('status')).toContainText('This time he confirms');

  await expect(playing(page)).toHaveCount(0, { timeout: 90_000 });

  // The denial went through the real route with the note, and reached Mara by email.
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; text: string }[] };
  const denied = messages.filter((m) => m.kind === 'denied');
  expect(denied).toHaveLength(1);
  expect(denied[0]!.text).toContain('Mara was hiking');
  // Witnesses were asked in two rounds: once for the false alarm, once for the real thing.
  expect(messages.filter((m) => m.kind === 'witness-ask' && m.text.includes('/witness/')).length).toBeGreaterThanOrEqual(2);

  // Denial, then Mara's own check-in (the relight), then confirmation and release: in that order, in the ledger.
  const kinds = (await ledger(page)).map((e) => e.kind);
  const denial = kinds.indexOf('witness-denied');
  const checkIn = kinds.indexOf('check-in', denial);
  const confirmed = kinds.indexOf('witness-confirmed', checkIn);
  const released = kinds.indexOf('released', confirmed);
  expect(denial).toBeGreaterThan(-1);
  expect(checkIn).toBeGreaterThan(denial);
  expect(confirmed).toBeGreaterThan(checkIn);
  expect(released).toBeGreaterThan(confirmed);
  expect((await ledger(page)).find((e) => e.kind === 'witness-denied')!.note).toContain('Mara was hiking');
});

test('the witness page offers an optional note and sends it with "still lives" (Req 6.18)', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  expect((await request.post('/api/dev/clock', { data: { days: 40 } })).ok()).toBe(true);
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { name: string }; text: string }[] };
  const link = messages.find((m) => m.kind === 'witness-ask' && m.to.name === 'Silas Crane')!.text.match(/https?:\/\/\S+/)![0];
  await page.goto(link);
  await expect(page.getByLabel('A note for Mara (optional)')).toBeVisible();
  await page.getByLabel('A note for Mara (optional)').fill('Mara was hiking');
  await page.getByTestId('witness-deny').click();
  await expect(page.getByTestId('witness-done')).toContainText('The release is stopped.');
  const after = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; text: string }[] };
  expect(after.messages.find((m) => m.kind === 'denied')!.text).toContain('Mara was hiking');
});

test("the story shows June's keepsake card before her seal breaks, and the seal breaks for real with it (Req 12.6, 12.7, 3.7, 3.9)", async ({ page, request }) => {
  const seen: string[] = [];
  // A URL fragment never leaves the browser, so compare what is actually sent: the address without it, and the body.
  page.on('request', (r) => seen.push(`${r.url().split('#')[0]}\n${r.postData() ?? ''}`));
  await page.goto('/?story-pace=0.2');
  await page.getByTestId('play-story').click();
  const caption = page.getByTestId('story').getByRole('status');

  // The card comes first: the printed code is on screen under a caption, and the page has not opened anything.
  await expect(caption).toContainText('keepsake');
  await expect(page.getByTestId('keepsake-code')).toBeVisible();
  await expect(page).toHaveURL(/\/keepsake\/L[\w-]+/);
  await expect(page.getByTestId('opened-letter')).toHaveCount(0);

  // Then her release link finds the keepsake and the seal breaks, so the letter really decrypts.
  await expect(page.getByTestId('opened-letter')).toContainText('Biscuit eats twice a day', { timeout: 60_000 });
  await expect(playing(page)).toHaveCount(0, { timeout: 60_000 });

  // June's letter is in keepsake custody: her release email carries no key, Theo's (vault custody) does.
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { name: string }; text: string }[] };
  const release = (name: string) => messages.find((m) => m.kind === 'release' && m.to.name === name)!.text;
  expect(release('June Okafor')).not.toContain('#k=');
  expect(release('Theo Whitlock')).toContain('#k=');

  // The keepsake half never went to the server: no request carried it.
  const token = await page.evaluate(() => localStorage.getItem('dms.owner'));
  const view = (await (await request.get('/api/vault', { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    letters: { id: string; custody: string; recipient: { name: string } }[];
  };
  const june = view.letters.find((l) => l.recipient.name === 'June Okafor')!;
  expect(june.custody).toBe('keepsake');
  const half = await page.evaluate((id) => localStorage.getItem(`dms.keepsake.${id}`), june.id);
  expect(half).toMatch(/^[\w-]{43}$/);
  expect(seen.filter((r) => r.includes(half!))).toEqual([]);
});

// ── when the demo stops answering ──────────────────────────────────────────────────────────────────────────

/** Starts the story, waits until the vigil is on screen (the setup calls are done), then makes every /api call fail. */
async function startAndBreak(page: Page, mode: 'abort' | 'unavailable' = 'abort'): Promise<void> {
  await page.goto('/?story-pace=0.2');
  await page.getByTestId('play-story').click();
  await expect(page.getByTestId('state-title')).toBeVisible();
  await page.route('**/api/**', (route) =>
    mode === 'abort' ? route.abort('connectionrefused') : route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }),
  );
}

const failure = (page: Page) => page.getByTestId('story');

test('if an API call fails the story stops with "The demo stopped responding." and two buttons, reachable by keyboard (Req 12.8, 12.10)', async ({ page }) => {
  await startAndBreak(page);
  const box = failure(page);
  await expect(box.getByRole('status')).toHaveText('The demo stopped responding.');
  // The story has stopped: no step counter, and the caption stays put.
  await expect(playing(page)).toHaveCount(0);
  const reset = box.getByRole('button', { name: 'Reset the demo' });
  const again = box.getByRole('button', { name: 'Play it again' });
  await expect(reset).toBeVisible();
  await expect(again).toBeVisible();

  // The failure card has no WCAG 2.2 AA violations.
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // By keyboard alone: focus is on the first button, Tab reaches the second, then Close.
  await expect(reset).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(again).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(box.getByRole('button', { name: 'Close' })).toBeFocused();

  // Play it again, by keyboard, once the demo answers: the story starts from the first beat.
  await page.unroute('**/api/**');
  await again.focus();
  await page.keyboard.press('Enter');
  await expect(box.getByRole('status')).toContainText('Mara keeps a vigil');
  await expect(box.locator('.story__step')).toContainText('1 of');
});

test('a failed page request while the story waits stops it too (Req 12.8)', async ({ page }) => {
  await startAndBreak(page, 'unavailable');
  await expect(failure(page).getByRole('status')).toHaveText('The demo stopped responding.');
  await expect(failure(page).getByRole('button', { name: 'Reset the demo' })).toBeVisible();
  await expect(failure(page).getByRole('button', { name: 'Play it again' })).toBeVisible();
});

test('"Reset the demo" resets through the dev route when it answers, and otherwise clears the static demo\'s stored state (Req 12.9)', async ({ page, request }) => {
  await startAndBreak(page);
  const box = failure(page);
  await expect(box.getByRole('status')).toHaveText('The demo stopped responding.');
  const owner = await page.evaluate(() => localStorage.getItem('dms.owner'));
  expect(owner).toBeTruthy();

  // The route does not answer: the stored state of the static demo is cleared, and the buttons stay for another try.
  await page.evaluate(() => localStorage.setItem('dms.static-demo', '{"vaults":{"vaults":[]},"outbox":[],"offsetMs":0}'));
  await box.getByRole('button', { name: 'Reset the demo' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dms.static-demo'))).toBeNull();
  await expect(box.getByRole('status')).not.toHaveText('The demo stopped responding.');
  await expect(box.getByRole('button', { name: 'Reset the demo' })).toBeVisible();
  await expect(box.getByRole('button', { name: 'Play it again' })).toBeVisible();

  // The route answers: the server forgets the vigil, and this browser forgets its key.
  await page.unroute('**/api/**');
  await box.getByRole('button', { name: 'Reset the demo' }).click();
  await expect(box.getByRole('status')).toHaveText(/^The demo was reset\./);
  expect((await request.get('/api/vault', { headers: { Authorization: `Bearer ${owner}` } })).status()).toBe(401);
  expect(await page.evaluate(() => localStorage.getItem('dms.owner'))).toBeNull();
  await expect(box.getByRole('button', { name: 'Reset the demo' })).toHaveCount(0);
});

// ── start from a link ──────────────────────────────────────────────────────────────────────────────────────

test('?story=1 on the landing page starts the story by itself, with sound muted (Req 12.11)', async ({ page }) => {
  await page.goto('/?story=1&story-pace=0.2');
  const box = page.getByTestId('story');
  await expect(box.getByRole('status')).toContainText('Mara keeps a vigil');
  await expect(box.locator('.story__step')).toContainText('1 of');
  // The link is a README link, so nothing makes a sound until the visitor asks for it.
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('dms.sound'))).not.toBe('on');
  await expect(playing(page)).toHaveCount(0, { timeout: 90_000 });
  await expect(box.getByRole('status')).toContainText('Some words should wait');
});

test('the landing page without ?story=1 does not start the story (Req 12.11)', async ({ page }) => {
  const health = page.waitForResponse('**/api/health');
  await page.goto('/?story-pace=0.2');
  await health;
  await expect(page.getByTestId('play-story')).toBeVisible();
  await expect(page.getByTestId('story')).toHaveCount(0);
});

test('?story=1 waits for the time machine: with none, nothing plays and there is no button (Req 12.11)', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, now: Date.now(), dev: false } }));
  const health = page.waitForResponse('**/api/health');
  await page.goto('/?story=1');
  await health;
  await expect(page.getByRole('button', { name: 'Try a demo vigil' })).toBeVisible();
  await expect(page.getByTestId('play-story')).toHaveCount(0);
  await expect(page.getByTestId('story')).toHaveCount(0);
});

// ── the label on the button ────────────────────────────────────────────────────────────────────────────────

test('the button label gives the real running time of the story at normal pace, within 5 seconds (Req 12.12)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  const button = page.getByTestId('play-story');
  const label = Number((await button.textContent())!.match(/\((\d+) s\)/)![1]);

  await button.click();
  const started = Date.now();
  await expect(playing(page)).toHaveCount(1);
  await expect(playing(page)).toHaveCount(0, { timeout: 150_000 });
  const real = (Date.now() - started) / 1000;
  // The run must have reached its end card; a story that stopped early would otherwise look like a short one.
  await expect(page.getByTestId('story').getByRole('status')).toHaveText(/Some words should wait/);
  console.log(`story running time at pace 1: ${real.toFixed(1)} s (label says ${label} s)`);
  expect(Math.abs(real - label), `label ${label} s, measured ${real.toFixed(1)} s`).toBeLessThanOrEqual(5);
});
