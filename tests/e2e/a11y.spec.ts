import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary).toEqual([]);
}

test('landing page has no WCAG AA violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await audit(page);
});

test('vigil, writing desk and time machine have no WCAG AA violations', async ({ page }) => {
  // Five full axe audits and a letter sealed in the browser: give it more than the default minute on a busy runner.
  test.setTimeout(150_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await audit(page);

  await page.getByRole('button', { name: /time machine/i }).click();
  await page.getByRole('button', { name: '+30 days' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  // The drawer closes after a jump and leaves its note by the button; audit both.
  await expect(page.getByTestId('tm-toast')).toContainText('A month passed');
  await audit(page);
  await page.getByRole('button', { name: /time machine/i }).click();
  await expect(page.getByRole('complementary', { name: /time machine/i })).toBeVisible();
  await audit(page);

  await page.getByRole('button', { name: /close the time machine/i }).click();
  await page.getByTestId('write-letter').click();
  await expect(page.getByRole('heading', { name: 'Write a letter' })).toBeVisible();
  await audit(page);

  await page.getByLabel('For', { exact: true }).fill('Theo Whitlock');
  await page.getByLabel('Their email').fill('theo@example.com');
  await page.getByRole('textbox', { name: 'Your letter' }).click();
  await page.keyboard.type('The spare key is under the third stone.');
  await page.getByTestId('seal-letter').click();
  await expect(page.getByTestId('keepsake-card')).toBeVisible();
  await audit(page);
});

test('honest page has no WCAG AA violations', async ({ page }) => {
  await page.goto('/how-it-works');
  await audit(page);
});

test('the saved offline page has no WCAG AA violations', async ({ page }) => {
  await page.goto(`file://${process.cwd()}/src/web/public/offline-open.html`);
  await expect(page.getByLabel('1. The sealed export')).toBeVisible();
  await audit(page);
});

test('the lost-address page and a spent link have no WCAG AA violations', async ({ page }) => {
  await page.goto('/no/such/place');
  await expect(page.getByTestId('not-found')).toBeVisible();
  await audit(page);
  await page.goto('/open/notarealtoken');
  await expect(page.getByTestId('open-link-error')).toBeVisible();
  await audit(page);
});

test('witness, recipient and opened-letter pages have no WCAG AA violations', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await request.post('/api/dev/clock', { data: { days: 38 } });

  const linkFor = async (kind: string, name: string) => {
    const { messages } = (await (await request.get('/api/dev/outbox')).json()) as {
      messages: { kind: string; to: { name: string }; text: string }[];
    };
    const msg = messages.find((m) => m.kind === kind && m.to.name === name);
    return msg!.text.match(/https?:\/\/\S+/)![0];
  };

  await page.goto(await linkFor('witness-ask', 'Silas Crane'));
  await expect(page.getByTestId('witness-confirm')).toBeVisible();
  await audit(page);
  await page.getByTestId('witness-confirm').click();
  await page.getByTestId('witness-confirm-final').click();
  await expect(page.getByTestId('witness-done')).toBeVisible();
  await audit(page);

  // June's letter is in keepsake custody and asks for her keepsake; Theo's is in vault custody and opens from its link.
  await page.goto(await linkFor('release', 'June Okafor'));
  await expect(page.getByLabel('Your keepsake')).toBeVisible();
  await audit(page);

  await page.goto(await linkFor('release', 'Theo Whitlock'));
  await page.getByTestId('break-seal').click();
  await expect(page.getByTestId('opened-letter')).toBeVisible();
  // Opening a letter ends the demo guide.
  await expect(page.getByTestId('story-done')).toContainText('The story is complete');
  await audit(page);
  expect(await page.evaluate(() => window.localStorage.getItem('dms.tour'))).toBeNull();
});

test('the paused, grace, confirm and released vigil rooms have no WCAG AA violations (Req 10.1)', async ({ page, request }) => {
  // Four rooms, each audited in its own dimmed colours, with the mail drawer open at the end.
  test.setTimeout(150_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);

  // Paused, under the glass.
  await page.getByRole('button', { name: /Pause the vigil/ }).click();
  await expect(page.getByTestId('state-title')).toHaveText('Under glass');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'paused');
  await audit(page);
  await page.getByRole('button', { name: 'Lift the glass and resume' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');

  // Grace, then confirm, moved by the same time machine the e2e lifecycle uses.
  for (const [days, title, room] of [
    [30, 'The flame gutters', 'grace'],
    [7, 'The candle has gone out', 'confirm'],
  ] as const) {
    expect((await request.post('/api/dev/clock', { data: { days } })).ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId('state-title')).toHaveText(title);
    await expect(page.locator('body')).toHaveAttribute('data-room', room);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
    await audit(page);
  }

  // Released: the silence window passes with no denial.
  expect((await request.post('/api/dev/clock', { data: { days: 15 } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered');
  await expect(page.getByTestId('epitaph')).toBeVisible();
  await audit(page);
  await page.getByRole('button', { name: /time machine/i }).click();
  await expect(page.getByRole('complementary', { name: /time machine/i })).toBeVisible();
  await audit(page);
});

test('the keepsake page, complete and cut short, has no WCAG AA violations (Req 10.1)', async ({ page }) => {
  const half = 'A'.repeat(43);
  await page.goto(`/keepsake/Lexample1#k=${half}&from=Mara%20Whitlock&to=Theo%20Whitlock`);
  await expect(page.getByTestId('keepsake-code')).toBeVisible();
  await audit(page);
  await page.goto('/keepsake/Lexample2#k=tooshort');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This keepsake is incomplete');
  await audit(page);
});
