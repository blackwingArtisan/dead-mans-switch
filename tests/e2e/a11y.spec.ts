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
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
  await audit(page);

  await page.getByRole('button', { name: /time machine/i }).click();
  await page.getByRole('button', { name: '+30 days' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
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

  await page.goto(await linkFor('release', 'Theo Whitlock'));
  await expect(page.getByLabel('Your keepsake')).toBeVisible();
  await audit(page);

  await page.goto(await linkFor('release', 'June Okafor'));
  await page.getByTestId('break-seal').click();
  await expect(page.getByTestId('opened-letter')).toBeVisible();
  await audit(page);
});
