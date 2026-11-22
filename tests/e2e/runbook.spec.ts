import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function desk(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await page.getByTestId('write-letter').click();
  await expect(page.getByRole('heading', { name: 'Write a letter' })).toBeVisible();
}

const TITLES = ['Cloud root account', 'Domain registrar', 'Payments and contractor payouts', 'Bank', 'The password manager itself'];

test('the writing desk starts blank, offers the runbook, and lets the author add and remove sections (Founder Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.9, 2.1)', async ({ page }) => {
  await desk(page);
  const blank = page.getByRole('button', { name: 'Start from a blank page' });
  const runbook = page.getByRole('button', { name: 'Start from the Founder runbook' });
  await expect(blank).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('runbook')).toHaveCount(0);

  await page.getByLabel('For', { exact: true }).fill('Tomás Rivera');
  await runbook.click();
  await expect(runbook).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('runbook-warning')).toContainText('Never paste a password or recovery code');
  await expect(page.locator('.runbook__section legend')).toHaveText(TITLES);
  const bank = page.getByTestId('runbook-bank');
  await expect(bank.getByLabel('Where the login and recovery codes live')).toBeVisible();
  await expect(bank.getByLabel('Who to call')).toBeVisible();
  await expect(bank.getByLabel('Renews or is due')).toBeVisible();

  await bank.getByRole('button', { name: /Remove this section/ }).click();
  await expect(page.locator('.runbook__section legend')).toHaveText(TITLES.filter((t) => t !== 'Bank'));
  await page.getByLabel('Add a section').selectOption({ label: 'Bank' });
  await page.getByRole('button', { name: 'Add the section' }).click();
  await expect(page.locator('.runbook__section legend').last()).toHaveText('Bank');

  await blank.click();
  await expect(page.getByTestId('runbook')).toHaveCount(0);
  await expect(page.getByLabel('For', { exact: true })).toHaveValue('Tomás Rivera');
});

test('an empty runbook will not seal (Founder Req 1.7)', async ({ page }) => {
  await desk(page);
  await page.getByLabel('For', { exact: true }).fill('Tomás Rivera');
  await page.getByLabel('Their email').fill('tomas@example.com');
  await page.getByRole('button', { name: 'Start from the Founder runbook' }).click();
  await page.getByTestId('seal-letter').click();
  await expect(page.getByRole('alert')).toContainText('The page is still blank. Write where one account lives');
});

test('a draft that looks like a secret is warned about in words and still seals; the upload holds no plaintext (Founder Req 2.5, 2.6, 2.7, 2.8, 2.10, 3.1, 3.2, 3.3)', async ({ page }) => {
  await desk(page);
  const uploads: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/vault/letters')) uploads.push(r.postData() ?? '');
  });

  await page.getByLabel('For', { exact: true }).fill('Tomás Rivera');
  await page.getByLabel('Their email').fill('tomas@example.com');
  await page.getByRole('button', { name: 'Start from the Founder runbook' }).click();
  const region = page.getByTestId('secret-warning-region');
  await expect(region).toHaveAttribute('role', 'status');
  await expect(page.getByTestId('secret-warning')).toHaveCount(0);

  await page.getByTestId('runbook-registrar').getByLabel('Who to call').fill('Noor, 555-0142');
  await page.getByTestId('runbook-registrar').getByLabel('Where the login and recovery codes live').fill('password: hunter2-registrar');
  await expect(page.getByTestId('secret-warning')).toContainText('Line 3 looks like a labelled password or code (“hun…”)');
  await expect(page.getByTestId('secret-warning')).toContainText('You can still seal the letter');
  await page.getByTestId('runbook-cloud').getByLabel('Where the login and recovery codes live').fill('the office safe');
  await audit(page);

  // Not blocked: choose vault custody (a second custody choice) and seal.
  await page.getByRole('radio', { name: /Vault custody/ }).check();
  await page.getByTestId('seal-letter').click();
  await expect(page.getByTestId('sealed-title')).toBeVisible();

  expect(uploads).toHaveLength(1);
  const body = JSON.parse(uploads[0]!) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(['custody', 'id', 'keepsakeHalf', 'recipient', 'sealed']);
  expect(Object.keys(body.sealed as object).sort()).toEqual(['ciphertext', 'iv', 'keepsakeTag', 'vaultHalf']);
  for (const plain of ['hunter2', 'Registrar', 'registrar', 'office safe', 'Noor', 'runbook', 'Cloud root', '555-0142']) {
    expect(uploads[0], plain).not.toContain(plain);
  }
});

test('the check also runs on a blank-page letter (Founder Req 2.8)', async ({ page }) => {
  await desk(page);
  await page.getByRole('textbox', { name: 'Your letter' }).click();
  await page.keyboard.type('Backup code: 4821-9937-1024');
  await expect(page.getByTestId('secret-warning')).toContainText('Line 1');
  await page.getByRole('textbox', { name: 'Your letter' }).fill('');
});

test('the time machine moves a year and the vigil asks for a review, and the reminder email says so (Founder Req 5.7, 5.9, 5.3)', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await expect(page.getByTestId('review-note')).toHaveCount(0);

  const forward = async (days: number) => expect((await request.post('/api/dev/clock', { data: { days } })).ok()).toBe(true);
  await forward(335);
  await page.reload();
  await page.getByTestId('check-in').click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  await expect(page.getByTestId('review-note')).toHaveCount(0);
  const before = ((await (await request.get('/api/dev/outbox')).json()) as { messages: unknown[] }).messages.length;

  await forward(30);
  await page.reload();
  const note = page.getByTestId('review-note');
  await expect(note.getByRole('heading', { name: 'Review your letters' })).toBeVisible();
  await expect(note).toContainText('Your oldest letter was sealed 1 year');
  await audit(page);

  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; to: { email: string }; text: string }[] };
  const reminders = messages.filter((m) => m.kind === 'reminder' && m.text.includes('review your letters'));
  expect(messages.length).toBeGreaterThan(before);
  expect(reminders.length).toBeGreaterThan(0);
  expect(reminders.every((m) => m.to.email === 'mara.whitlock@example.com')).toBe(true);
  expect(messages.filter((m) => m.text.includes('review your letters')).every((m) => m.kind === 'reminder')).toBe(true);
});
