// Captures the README media into docs/media: a hero GIF of "Play the whole story", four
// desktop screenshots of the lifecycle, a phone screenshot and the social preview image.
//
// Start a demo server first (`npm run demo`, or any server with the time machine on), then:
//   node scripts/capture-media.mjs [base-url]      (default http://localhost:3140)
// The GIF needs ffmpeg on the PATH; everything else needs only Playwright's Chromium.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3140';
const OUT = 'docs/media';
const TMP = join(OUT, '.video');
mkdirSync(OUT, { recursive: true });

const post = (path, body = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const linkFor = async (kind, name) => {
  const { messages } = await (await fetch(BASE + '/api/dev/outbox')).json();
  return messages.find((m) => m.kind === kind && m.to.name === name).text.match(/https?:\/\/\S+/)[0];
};

const browser = await chromium.launch();

async function demoVigil(page) {
  await post('/api/dev/reset');
  await page.goto(BASE + '/');
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await page.getByTestId('envelope').first().waitFor();
  await page.getByRole('button', { name: 'Dismiss the demo guide' }).click();
}

// 1. Desktop stills: landing, grace, candle out, the letter read by candlelight.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await post('/api/dev/reset');
  await page.goto(BASE + '/');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, 'landing.jpg'), type: 'jpeg', quality: 82 });

  const og = await browser.newPage({ viewport: { width: 1200, height: 720 } });
  await og.goto(BASE + '/');
  await og.waitForTimeout(1200);
  await og.screenshot({ path: 'src/web/public/og.jpg', type: 'jpeg', quality: 85, clip: { x: 0, y: 70, width: 1200, height: 630 } });
  await og.close();

  await demoVigil(page);
  await post('/api/dev/clock', { days: 30 });
  await page.reload();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, 'grace.jpg'), type: 'jpeg', quality: 82 });
  await post('/api/dev/clock', { days: 7 });
  await page.reload();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, 'candle-out.jpg'), type: 'jpeg', quality: 82 });

  const witness = await linkFor('witness-ask', 'Silas Crane');
  await page.goto(witness);
  await page.getByTestId('witness-confirm').click();
  await page.getByTestId('witness-confirm-final').click();
  await page.getByTestId('witness-done').waitFor();
  await page.goto(await linkFor('release', 'June Okafor'));
  await page.getByTestId('break-seal').click();
  const sheet = page.getByTestId('letter-page');
  await sheet.waitFor();
  await page.waitForTimeout(1600);
  await sheet.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24 }));
  const box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + 330);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'letter-by-candlelight.jpg'), type: 'jpeg', quality: 82 });
  await ctx.close();
}

// 2. Phone: the vigil in grace, check-in above the fold.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await demoVigil(page);
  await post('/api/dev/clock', { days: 30 });
  await page.reload();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, 'phone-grace.jpg'), type: 'jpeg', quality: 82 });
  await ctx.close();
}

// 3. Hero GIF: the whole story at a third of its pace, recorded, then sped up.
{
  rmSync(TMP, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, recordVideo: { dir: TMP, size: { width: 1100, height: 700 } } });
  const page = await ctx.newPage();
  await post('/api/dev/reset');
  await page.goto(BASE + '/?story-pace=0.3');
  await page.waitForTimeout(800);
  await page.getByTestId('play-story').click();
  await page.getByTestId('story').filter({ hasText: 'Some words should wait' }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await ctx.close();
  const video = join(TMP, readdirSync(TMP).find((f) => f.endsWith('.webm')));
  renameSync(video, join(TMP, 'story.webm'));
  const gif = spawnSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-ss', '1.2', '-i', join(TMP, 'story.webm'),
      '-vf', 'setpts=PTS/1.7,fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=80:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      join(OUT, 'story.gif'),
    ],
    { stdio: 'inherit' },
  );
  if (gif.status !== 0) console.error('ffmpeg is needed for the GIF; the stills were captured.');
  rmSync(TMP, { recursive: true, force: true });
}

await browser.close();
console.log(`Media written to ${OUT}/ and src/web/public/og.jpg`);
