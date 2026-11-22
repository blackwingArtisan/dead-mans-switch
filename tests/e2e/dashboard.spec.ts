import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// The vigil dashboard, through the real UI. Every test starts from an empty world at the real today.
test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

async function demoVigil(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
}

async function forward(request: APIRequestContext, days: number) {
  expect((await request.post('/api/dev/clock', { data: { days } })).ok()).toBe(true);
}

async function outboxKinds(request: APIRequestContext): Promise<{ kind: string; to: string }[]> {
  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { name: string } }[] };
  return messages.map((m) => ({ kind: m.kind, to: m.to.name }));
}

const status = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

test('the author can pause the vigil and resume it with a fresh candle, and nothing is sent or released while it is paused (Req 8.1, 8.2, 8.3, 8.4)', async ({ page, request }) => {
  await demoVigil(page);
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');

  // Req 8.1: pausing records a check-in and enters `paused`, said in words and announced.
  await page.getByRole('button', { name: /^Pause the vigil/ }).click();
  await expect(page.getByTestId('state-title')).toHaveText('Under glass');
  await expect(status(page, 'The vigil is paused. Nothing will be sent until you resume.')).toBeAttached();
  await expect(page.locator('.ledger')).toContainText('The vigil is paused. No reminders or releases until it resumes.');
  await expect(page.getByTestId('check-in')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Pause the vigil/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lift the glass and resume' })).toBeVisible();

  // Req 8.2 and 8.4: months pass, past the cadence, the grace period and the silence window. Nothing is
  // sent to anyone about the deadline, no witness is asked, and no letter is released.
  const before = (await outboxKinds(request)).length;
  await forward(request, 30);
  await forward(request, 7);
  await forward(request, 30);
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('Under glass');
  const sent = (await outboxKinds(request)).slice(before);
  expect(sent).toEqual([]);
  expect((await outboxKinds(request)).filter((m) => ['reminder', 'grace', 'last-call', 'witness-ask', 'release'].includes(m.kind))).toEqual([]);
  await expect(page.getByTestId('envelope').filter({ hasText: 'Waiting, unopened.' })).toHaveCount(2);

  // Req 8.3: resuming returns to `alive` with a full cadence counted from now, not from before the pause.
  await page.getByRole('button', { name: 'Lift the glass and resume' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  await expect(status(page, 'The vigil resumed with a fresh candle.')).toBeAttached();
  await expect(page.getByTestId('deadlines')).toContainText('(in 30 days)');
  await expect(page.locator('.ledger')).toContainText('The vigil resumed with a fresh candle.');
  await expect(page.getByTestId('check-in')).toBeVisible();
});

test('the author can burn a letter from the dashboard, and a burned letter is never released (Req 2.6)', async ({ page, request }) => {
  await demoVigil(page);
  const theo = page.getByTestId('envelope').filter({ hasText: 'For Theo Whitlock' });
  await expect(theo).toHaveCount(1);

  // Changing one's mind at the confirmation burns nothing.
  page.once('dialog', (d) => void d.dismiss());
  await theo.getByRole('button', { name: 'Burn' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);

  // Confirming burns it, after naming the letter and warning that it cannot be recovered.
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Burn the letter to Theo Whitlock? It cannot be recovered.');
    void d.accept();
  });
  await theo.getByRole('button', { name: 'Burn' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(1);
  await expect(page.getByTestId('envelope')).toContainText('For June Okafor');
  await expect(page.getByText('For Theo Whitlock')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('envelope')).toHaveCount(1);

  // The vigil goes silent and releases. June's letter is delivered; the burned one is not.
  await forward(request, 38);
  await forward(request, 15);
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered');
  const released = (await outboxKinds(request)).filter((m) => m.kind === 'release');
  expect(released).toEqual([{ kind: 'release', to: 'June Okafor' }]);
});

test('the stage track, the deadline as a date and a relative time, and the check-in announcement follow the vigil (Req 4.3, 4.4, 4.7, 10.8)', async ({ page, request }) => {
  await demoVigil(page);
  const track = page.getByRole('list', { name: 'Stages of the switch' });
  const current = track.locator('[aria-current="step"]');
  const deadlines = page.getByTestId('deadlines');
  const dateAndRelative = (relative: string) => new RegExp(`\\w+day, \\w+ \\d{1,2}, \\d{4}\\s*\\(${relative}\\)`);

  // Req 4.4: five steps in order, and the current one is marked for assistive technology and drawn as current.
  await expect(track.getByRole('listitem')).toHaveText(['Alive', 'Reminder', 'Grace', 'Witnesses', 'Released']);
  await expect(current).toHaveText('Alive');
  await expect(track.locator('.stages__step--done')).toHaveCount(0);
  await expect(track.locator('.stages__step--upcoming')).toHaveCount(4);

  // Req 4.3: the next deadline is a full date and a relative time.
  await expect(deadlines.locator('div').filter({ hasText: 'Next check-in due' })).toContainText(dateAndRelative('in 30 days'));

  // Reminder: three days before the deadline. The page notices on its own, and says so to screen readers (Req 10.8).
  await forward(request, 27);
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns low');
  await expect(current).toHaveText('Reminder');
  await expect(track.locator('.stages__step--done')).toHaveText(['Alive']);
  await expect(deadlines.locator('div').filter({ hasText: 'Next check-in due' })).toContainText(dateAndRelative('in 3 days'));
  await expect(status(page, 'The candle burns low. Your check-in is due soon.')).toBeAttached();

  // Grace: the deadline shown is when the witnesses will be asked.
  await forward(request, 4);
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await expect(current).toHaveText('Grace');
  await expect(track.locator('.stages__step--done')).toHaveText(['Alive', 'Reminder']);
  await expect(deadlines.locator('div').filter({ hasText: 'Witnesses will be asked' })).toContainText(dateAndRelative('in 6 days'));
  await expect(status(page, 'The flame gutters. You missed your check-in.')).toBeAttached();

  // Witnesses are asked.
  await forward(request, 7);
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');
  await expect(current).toHaveText('Witnesses');
  await expect(track.locator('.stages__step--done')).toHaveText(['Alive', 'Reminder', 'Grace']);
  await expect(status(page, 'The candle has gone out. Your witnesses have been asked to confirm.')).toBeAttached();

  // Req 4.7: a check-in returns to the first stage, moves the deadline a full cadence away, and is announced
  // in a polite live region with the new date.
  await page.getByTestId('check-in').click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  await expect(current).toHaveText('Alive');
  const due = deadlines.locator('div').filter({ hasText: 'Next check-in due' }).locator('dd');
  await expect(due).toContainText(dateAndRelative('in 30 days'));
  const dueDate = ((await due.textContent()) ?? '').replace(/\s*\(.*$/, '').trim();
  expect(dueDate).toMatch(/^\w+day, \w+ \d{1,2}, \d{4}$/);
  const announcement = status(page, 'Checked in. Your candle is relit');
  await expect(announcement).toBeAttached();
  await expect(announcement).toContainText(`Next check-in due by ${dueDate}.`);
  await expect(announcement).toHaveAttribute('aria-live', 'polite');
});

test('the vigil warns that letters can never be released when the silence window is off and no witness is named (Req 6.8)', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Wren Ashby');
  await page.getByLabel('Your email').fill('wren@example.com');
  await page.getByRole('button', { name: 'Light the candle' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');

  // With the default 14-day silence window the letters can still be released, and the panel says how.
  const witnesses = page.getByRole('region', { name: 'Witnesses' });
  await expect(witnesses.locator('.warning')).toHaveText('No witnesses yet. Without one, letters release only after 14 days of silence.');

  // Turning the silence window off, with no witness, means they never can.
  const terms = page.getByRole('region', { name: 'Terms of the vigil' });
  await terms.locator('#t-silence').uncheck();
  await terms.getByRole('button', { name: 'Set the terms' }).click();
  await expect(terms.getByRole('status')).toHaveText('The terms are set.');
  await expect(witnesses.locator('.warning')).toHaveText('No witnesses yet. Without one, your letters can never be released.');

  // Naming a witness removes the warning.
  const form = page.getByRole('form', { name: 'Name a witness' });
  await form.getByLabel('Name').fill('Silas Crane');
  await form.getByLabel('Email').fill('silas@example.com');
  await form.getByRole('button', { name: 'Name witness' }).click();
  await expect(witnesses.getByText('silas@example.com')).toBeVisible();
  await expect(witnesses.locator('.warning')).toHaveCount(0);
});

test('the writing desk says plainly that the operator could read a vault-custody letter before it is chosen (Req 3.3)', async ({ page }) => {
  await demoVigil(page);
  await page.getByTestId('write-letter').click();
  await expect(page.getByRole('heading', { name: 'Write a letter' })).toBeVisible();

  const group = page.getByRole('group', { name: 'Who keeps the other half of the key?' });
  const vault = group.getByRole('radio', { name: /Vault custody/ });
  const keepsake = group.getByRole('radio', { name: /Keepsake custody/ });

  // Before anything is chosen: keepsake is the default, and the warning is already in view and in the option's name.
  await expect(keepsake).toBeChecked();
  await expect(vault).not.toBeChecked();
  await expect(group.getByText(/whoever runs the server\s+could read this letter/)).toBeVisible();
  await expect(group.getByRole('radio', { name: /Vault custody.*whoever runs the server\s+could read this letter/s })).toHaveCount(1);

  // Choosing it does not hide the words.
  await vault.check();
  await expect(vault).toBeChecked();
  await expect(group.getByText(/whoever runs the server\s+could read this letter/)).toBeVisible();
});

test('the stage track is above the fold at 1440x900, and the check-in stays above the fold at 390x844 (Req 10.16)', async ({ page }) => {
  // With the demo guide open, which is the tallest the top of the vigil gets.
  await page.setViewportSize({ width: 1440, height: 900 });
  await demoVigil(page);
  await expect(page.getByTestId('guide')).toBeVisible();
  const track = page.getByRole('list', { name: 'Stages of the switch' });
  await expect(track).toBeInViewport({ ratio: 1 });
  await expect(track.locator('.stages__label')).toHaveText(['Alive', 'Reminder', 'Grace', 'Witnesses', 'Released']);
  const box = (await track.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(900);

  // A phone keeps the check-in first: the track follows it rather than pushing it down.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('check-in')).toBeInViewport({ ratio: 1 });
  const checkIn = (await page.getByTestId('check-in').boundingBox())!;
  const phoneTrack = (await track.boundingBox())!;
  expect(phoneTrack.y).toBeGreaterThan(checkIn.y + checkIn.height);
});

test('brass buttons share the pill radius of the other buttons (Req 10.19)', async ({ page }) => {
  await demoVigil(page);
  await page.getByRole('button', { name: /^time machine/i }).click();
  const drawer = page.getByRole('complementary', { name: /time machine/i });
  const brass = drawer.getByRole('button', { name: '+7 days' });
  await expect(brass).toHaveClass(/btn--brass/);
  const radius = (locator: typeof brass) => locator.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  const pill = await radius(drawer.getByRole('button', { name: 'Reset the whole demo' }));
  expect(parseFloat(pill)).toBeGreaterThanOrEqual(100);
  for (const name of ['+1 day', '+7 days', '+30 days', 'Skip to the next event']) {
    expect(await radius(drawer.getByRole('button', { name }))).toBe(pill);
  }
});

test('the fields of the terms form do not touch: every row is at least 12 px from the next (Req 10.20)', async ({ page }) => {
  await demoVigil(page);
  const rows = page.locator('form.terms fieldset > :not(legend)');
  await expect(rows.first()).toBeVisible();
  const boxes = await rows.evaluateAll((els) =>
    els
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0)
      .map((r) => ({ top: r.top, bottom: r.bottom })),
  );
  expect(boxes.length).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.top - boxes[i - 1]!.bottom, `row ${i + 1} is ${(boxes[i]!.top - boxes[i - 1]!.bottom).toFixed(1)} px under row ${i}`).toBeGreaterThanOrEqual(12);
  }
  // The two inputs of a row are apart sideways too.
  const row = (await page.locator('form.terms .field-row').first().locator('.field').evaluateAll((els) => els.map((el) => el.getBoundingClientRect())));
  expect(row[1]!.left - row[0]!.right).toBeGreaterThanOrEqual(12);
});
