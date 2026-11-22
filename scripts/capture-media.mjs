// Captures the README media into docs/media: a hero GIF of "Play the whole story", five
// desktop screenshots of the lifecycle, the three rooms side by side, a phone screenshot and
// the social preview image.
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
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'alive.jpg'), type: 'jpeg', quality: 82 });
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
  await page.goto(await linkFor('release', 'Theo Whitlock'));
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

// 1b. The three rooms side by side (alive, grace, candle out), small enough to read as thumbnails.
{
  const strip = spawnSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-i', join(OUT, 'alive.jpg'), '-i', join(OUT, 'grace.jpg'), '-i', join(OUT, 'candle-out.jpg'),
      '-filter_complex', '[0]scale=640:-1[a];[1]scale=640:-1[b];[2]scale=640:-1[c];[a][b][c]hstack=inputs=3',
      '-q:v', '4', join(OUT, 'rooms.jpg'),
    ],
    { stdio: 'inherit' },
  );
  if (strip.status !== 0) console.error('ffmpeg is needed for rooms.jpg.');
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
  // The film grain is fresh noise in every frame, which a GIF cannot compress; leave it out of the recording.
  await page.addStyleTag({ content: '.atmosphere__grain { display: none !important; }' });
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
      // 960 px wide and under 3 MB: a faster cut, 6 frames a second and a 48-colour palette without dithering.
      '-vf', 'setpts=PTS/2.1,fps=6,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      join(OUT, 'story.gif'),
    ],
    { stdio: 'inherit' },
  );
  if (gif.status !== 0) console.error('ffmpeg is needed for the GIF; the stills were captured.');
  // KEEP_VIDEO=1 keeps the raw recording in docs/media/.video for tuning the GIF by hand.
  if (!process.env.KEEP_VIDEO) rmSync(TMP, { recursive: true, force: true });
}

await browser.close();
console.log(`Media written to ${OUT}/ and src/web/public/og.jpg`);
