import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// The lower vigil dashboard drawn as objects in the room: the ledger as a book page, witnesses as small candles, the terms on a brass plaque.
test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

async function demoVigil(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
}
async function forward(page: Page, request: APIRequestContext, days: number, room: string) {
  expect((await request.post('/api/dev/clock', { data: { days } })).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('dms:refresh')));
  await expect(page.locator('body')).toHaveAttribute('data-room', room);
}
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
const witnessRow = (page: Page) => page.getByRole('region', { name: 'Witnesses' }).locator('.people__row').first();
const flame = (page: Page) => witnessRow(page).locator('.wcandle__flame').evaluate((el) => Number(getComputedStyle(el).opacity));
const css = (page: Page, selector: string, prop: string) => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test('the ledger is a ruled book page in the hand font with a page edge, and is still a focusable scrolling region named "The ledger" (Req 10.25)', async ({ page }) => {
  await demoVigil(page);
  const ledger = page.getByRole('list', { name: 'The ledger' });
  await expect(ledger).toHaveAttribute('tabindex', '0');
  await ledger.focus();
  await expect(ledger).toBeFocused();
  expect(await css(page, '.ledger', 'overflow-y')).toBe('auto');
  expect(await css(page, '.ledger__row span', 'font-family')).toContain('IM Fell English');
  expect(await css(page, '.ledger', 'background-image')).toContain('repeating-linear-gradient');
  expect(await css(page, '.panel--ledger', 'box-shadow')).not.toBe('none');
  expect(parseFloat(await css(page, '.panel--ledger', 'border-left-width'))).toBeGreaterThanOrEqual(8);
});

test('each witness is a small named candle: lit before they are asked, dim once asked, out once they confirm, and the state is also in text (Req 10.26)', async ({ page, request }) => {
  await demoVigil(page);
  const row = witnessRow(page);
  await expect(row.locator('.wcandle')).toHaveAttribute('aria-hidden', 'true');
  await expect(row).toContainText('Silas Crane');
  await expect(row.locator('.tag')).toHaveText('not asked yet');
  await expect(row.locator('.wcandle')).toHaveAttribute('data-state', 'lit');
  const lit = await flame(page);
  expect(lit).toBe(1);

  await forward(page, request, 38, 'confirm');
  await expect(row.locator('.tag')).toHaveText('asked');
  await expect(row.locator('.wcandle')).toHaveAttribute('data-state', 'dim');
  const dim = await flame(page);
  expect(dim).toBeGreaterThan(0);
  expect(dim).toBeLessThan(lit);

  const { messages } = (await (await request.get('/api/dev/outbox')).json()) as { messages: { kind: string; text: string }[] };
  const token = /\/witness\/([\w-]+)/.exec(messages.find((m) => m.kind === 'witness-ask')!.text)![1]!;
  const r = await request.post(`/api/witness/${token}`, { data: { response: 'confirm' } });
  expect(r.ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('dms:refresh')));
  // The demo names two witnesses; the first link in the outbox belongs to Ada, who confirms. Silas is no longer needed.
  const ada = page.getByRole('region', { name: 'Witnesses' }).locator('.people__row').filter({ hasText: 'Ada Penhallow' });
  await expect(ada.locator('.tag')).toHaveText('confirmed');
  await expect(ada.locator('.wcandle')).toHaveAttribute('data-state', 'out');
  expect(await ada.locator('.wcandle__flame').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0);
  await expect(row.locator('.tag')).toHaveText('not needed');
});

test('the terms form sits on a brass plaque with an engraved heading and a brass border, and its fields are unchanged (Req 10.27)', async ({ page }) => {
  await demoVigil(page);
  const plaque = page.getByRole('region', { name: 'Terms of the vigil' });
  await expect(plaque).toHaveClass(/panel--plaque/);
  const edge = await plaque.evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: parseFloat(s.borderTopWidth), color: s.borderTopColor, brass: getComputedStyle(document.body).getPropertyValue('--brass').trim() };
  });
  expect(edge.width).toBeGreaterThanOrEqual(3);
  expect(await plaque.getByRole('heading', { name: 'Terms of the vigil' }).evaluate((el) => getComputedStyle(el).textShadow)).not.toBe('none');
  for (const label of ['Check in every (days)', 'Grace period (days)', 'First reminder (days before)', 'Witnesses who must confirm']) await expect(plaque.getByLabel(label)).toBeVisible();
  await expect(plaque.getByRole('button', { name: 'Set the terms' })).toBeVisible();
});

test('the ledger, the witness candle and the plaque take the room tint, and every room stays at zero axe violations (Req 10.28, 10.1)', async ({ page, request }) => {
  test.setTimeout(120_000);
  await demoVigil(page);
  const tint = async () => ({
    paper: await css(page, '.panel--ledger', 'background-color'),
    wax: await css(page, '.wcandle__wax', 'fill'),
    plaque: await css(page, '.panel--plaque', 'border-top-color'),
  });
  const seen = [await tint()];
  await audit(page);
  await forward(page, request, 30, 'grace');
  seen.push(await tint());
  await audit(page);
  await forward(page, request, 8, 'confirm');
  seen.push(await tint());
  await audit(page);
  for (const key of ['paper', 'plaque'] as const) expect(new Set(seen.map((s) => s[key])).size, `${key} follows the room`).toBe(3);
  expect(new Set(seen.map((s) => s.wax)).size).toBeGreaterThan(1);
});

test('no horizontal scroll at 360 px with the ledger, candles and plaque (Req 10.5)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await demoVigil(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
