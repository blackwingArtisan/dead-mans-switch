import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

const NAMES = ['Silas Crane', 'Ada Penhallow', 'Ines Varga'];
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function openTimeMachine(page: Page) {
  const panel = page.getByRole('complementary', { name: /time machine/i });
  if (!(await panel.isVisible())) await page.getByRole('button', { name: /time machine/i }).click();
  return panel;
}

async function travel(page: Page, label: string) {
  const panel = await openTimeMachine(page);
  await panel.getByRole('button', { name: label }).click();
  await expect(panel).toBeHidden();
}

/** Every link of one kind sent to one person, in the order the outbox shows them. */
async function outboxLinks(page: Page, kind: string, recipient: string): Promise<string[]> {
  const panel = await openTimeMachine(page);
  const items = panel.locator(`.outbox__item[data-kind="${kind}"]`).filter({ hasText: `to ${recipient}` });
  await expect(items.first()).toBeVisible();
  const hrefs: string[] = [];
  for (let i = 0; i < (await items.count()); i++) {
    const item = items.nth(i);
    if ((await item.locator('a.outbox__link').count()) === 0) await item.locator('.outbox__summary').click();
    hrefs.push((await item.locator('a.outbox__link').first().getAttribute('href'))!);
  }
  return hrefs;
}

async function axeClean(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
}

/** Begins a vigil with three witnesses, two of whom must confirm, and seals one séance letter. */
async function seal(page: Page) {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Mara Whitlock');
  await page.getByLabel('Your email').fill('mara@example.com');
  await page.getByRole('button', { name: 'Light the candle' }).click();
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');

  const form = page.getByRole('form', { name: 'Name a witness' });
  for (const name of NAMES) {
    await form.getByLabel('Name').fill(name);
    await form.getByLabel('Email').fill(`${name.split(' ')[0]!.toLowerCase()}@example.com`);
    await form.getByRole('button', { name: 'Name witness' }).click();
    await expect(page.getByText(`${name.split(' ')[0]!.toLowerCase()}@example.com`)).toBeVisible();
  }
  await page.getByLabel('Witnesses who must confirm').fill('2');
  await page.getByRole('button', { name: 'Set the terms' }).click();
  await expect(page.getByText('The terms are set.')).toBeVisible();

  await page.getByTestId('write-letter').click();
  await page.getByLabel('For', { exact: true }).fill('Theo Whitlock');
  await page.getByLabel('Their email').fill('theo@example.com');
  await page.getByRole('textbox', { name: 'Your letter' }).click();
  await page.keyboard.type('The deed is in the blue tin. I am so proud of you.');
  await page.getByRole('radio', { name: /Séance seal/ }).check();
  // The honest text is on the page before the author seals, with the silence-window warning while that window is on.
  await expect(page.getByTestId('seance-honesty')).toContainText('fewer than 2 shares');
  await expect(page.getByTestId('seance-honesty')).toContainText('A stays with the recipient');
  await expect(page.getByTestId('seance-silence')).toContainText('silence window will not open this letter');
  await axeClean(page);
  await page.getByTestId('seal-letter').click();
  await expect(page.getByTestId('sealed-title')).toBeVisible();
  const links = page.getByTestId('share-link');
  await expect(links).toHaveCount(3);
  const shareLinks: string[] = [];
  for (let i = 0; i < 3; i++) {
    shareLinks.push(await links.nth(i).inputValue());
    expect(shareLinks[i]).toMatch(/\/share#s=L[\w-]+\.[\w-]{46}$/);
  }
  const keepsake = await page.getByTestId('keepsake-link').inputValue();
  await axeClean(page);
  await page.getByTestId('back-to-vigil').click();
  await expect(page.getByTestId('envelope')).toHaveCount(1);
  await expect(page.getByTestId('envelope')).toContainText('Séance seal');
  return { shareLinks, keepsake };
}

/** A witness's own browser: the share link is visited first, the round link later. */
async function newWitness(browser: Browser, shareLink: string | null): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  if (shareLink) {
    await page.goto(shareLink);
    await expect(page.getByTestId('share-saved')).toContainText('kept on this device');
  }
  return { ctx, page };
}

async function answer(w: Page, href: string, how: 'confirm' | 'deny') {
  await w.goto(href);
  if (how === 'confirm') {
    await w.getByTestId('witness-confirm').click();
    await w.getByTestId('witness-confirm-final').click();
  } else {
    await w.getByTestId('witness-deny').click();
  }
  await expect(w.getByTestId('witness-done')).toBeVisible();
}

async function toConfirm(page: Page) {
  await travel(page, '+30 days');
  await travel(page, '+7 days');
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');
}

test('2-of-3: one confirmation with a share is not enough, the second releases it, and the keepsake opens it (Req 13.1, 13.2, 13.5, 13.6, 13.10, 13.11, 13.12, 13.15)', async ({ page, browser }) => {
  const { shareLinks, keepsake } = await seal(page);
  await toConfirm(page);

  const silas = await newWitness(browser, shareLinks[0]!);
  await silas.page.goto((await outboxLinks(page, 'witness-ask', NAMES[0]!))[0]!);
  await expect(silas.page.getByTestId('witness-shares')).toContainText('Your share is on this device');
  await axeClean(silas.page);
  await answer(silas.page, (await outboxLinks(page, 'witness-ask', NAMES[0]!))[0]!, 'confirm');
  await expect(silas.page.getByTestId('witness-done')).toContainText('once enough witnesses agree');
  await silas.ctx.close();

  // One share is not enough: the vigil is still waiting.
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');

  const ada = await newWitness(browser, shareLinks[1]!);
  await answer(ada.page, (await outboxLinks(page, 'witness-ask', NAMES[1]!))[0]!, 'confirm');
  await expect(ada.page.getByTestId('witness-done')).toContainText('letters have now been delivered');
  await ada.ctx.close();
  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered', { timeout: 15_000 });

  // The recipient needs the keepsake: the release link alone is not enough.
  const release = (await outboxLinks(page, 'release', 'Theo Whitlock'))[0]!;
  const theoCtx = await browser.newContext({ reducedMotion: 'reduce' });
  const theo = await theoCtx.newPage();
  await theo.goto(release);
  await expect(theo.getByLabel('Your keepsake')).toBeVisible();
  await axeClean(theo);
  await theo.getByLabel('Your keepsake').fill('0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000-0000');
  await theo.getByTestId('break-seal').click();
  await expect(theo.getByRole('alert')).toContainText('belongs to a different letter');
  await theo.getByLabel('Your keepsake').fill(keepsake);
  await theo.getByTestId('break-seal').click();
  await expect(theo.getByTestId('opened-letter')).toContainText('The deed is in the blue tin.');
  await theoCtx.close();
});

test('a veto after one confirmation keeps the letter sealed and discards the shares (Req 13.9, 13.6, 13.11)', async ({ page, browser }) => {
  const { shareLinks, keepsake } = await seal(page);
  await toConfirm(page);

  const silas = await newWitness(browser, shareLinks[0]!);
  const ada = await newWitness(browser, shareLinks[1]!);
  await answer(silas.page, (await outboxLinks(page, 'witness-ask', NAMES[0]!))[0]!, 'confirm');
  await answer(ada.page, (await outboxLinks(page, 'witness-ask', NAMES[1]!))[0]!, 'deny');
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await expect(page.getByTestId('envelope')).toContainText('Waiting, unopened');

  // A second round. Silas has lost his share (his device forgets it); Ada confirms with hers.
  // If his first-round share had survived the veto, two shares would now exist and the letter would open.
  await silas.page.evaluate(() => window.localStorage.clear());
  const oldSilas = await outboxLinks(page, 'witness-ask', NAMES[0]!);
  const oldAda = await outboxLinks(page, 'witness-ask', NAMES[1]!);
  await travel(page, '+7 days');
  await expect(page.getByTestId('state-title')).toHaveText('The candle has gone out');
  const silasLinks = await outboxLinks(page, 'witness-ask', NAMES[0]!);
  const adaLinks = await outboxLinks(page, 'witness-ask', NAMES[1]!);
  expect(silasLinks.length).toBe(oldSilas.length + 1);
  const fresh = (all: string[], old: string[]) => all.find((h) => !old.includes(h))!;
  await answer(silas.page, fresh(silasLinks, oldSilas), 'confirm');
  await answer(ada.page, fresh(adaLinks, oldAda), 'confirm');
  await expect(page.getByTestId('state-title')).toHaveText('The letters are delivered', { timeout: 15_000 });
  await silas.ctx.close();
  await ada.ctx.close();

  const release = (await outboxLinks(page, 'release', 'Theo Whitlock'))[0]!;
  const theoCtx = await browser.newContext({ reducedMotion: 'reduce' });
  const theo = await theoCtx.newPage();
  await theo.goto(release);
  await theo.getByLabel('Your keepsake').fill(keepsake);
  await theo.getByTestId('break-seal').click();
  // Only Ada's share exists, so the break is refused in plain words and the link is not spent.
  await expect(theo.getByRole('alert')).toContainText('needs 2 witnesses');
  await expect(theo.getByTestId('break-seal')).toBeVisible();
  await theo.reload();
  await expect(theo.getByRole('heading', { name: 'A letter from Mara Whitlock' })).toBeVisible();
  await theoCtx.close();
});

test('the share page keeps a share only on this device and says what it is (Req 13.5, 13.15)', async ({ page, browser }) => {
  const { shareLinks } = await seal(page);
  const w = await newWitness(browser, null);
  const requests: string[] = [];
  w.page.on('request', (r) => requests.push(r.url()));
  await w.page.goto(shareLinks[2]!);
  await expect(w.page.getByTestId('share-saved')).toContainText('kept on this device');
  await expect(w.page.getByTestId('share-saved')).toContainText('never sent');
  await axeClean(w.page);
  expect(requests.filter((u) => u.includes(shareLinks[2]!.split('.').pop()!))).toEqual([]);
  await w.ctx.close();
});
