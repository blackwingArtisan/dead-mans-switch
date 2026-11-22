import { expect, test, type Page } from '@playwright/test';

// The grace room: a sickly yellow-green with a slow flicker at the edges of the viewport (Req 10.18). The axe audit cannot see the
// fixed, pointer-less room layers behind the page, so this file measures the room itself: it hides the page, screenshots the
// room alone, and checks the contrast of every piece of text that sits on it.

test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/dev/reset')).ok()).toBe(true);
});

type RGB = [number, number, number];
interface Probe {
  text: string;
  color: [number, number, number, number];
  size: number;
  weight: number;
  rect: { x: number; y: number; w: number; h: number };
  /** Background colours of ancestors that paint one, outermost first. */
  layers: [number, number, number, number][];
}

const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const over = (top: [number, number, number, number], under: RGB): RGB => [0, 1, 2].map((i) => top[i]! * top[3] + under[i]! * (1 - top[3])) as RGB;

async function startDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo vigil' }).click();
  await expect(page.getByTestId('envelope')).toHaveCount(2);
}

async function goToGrace(page: Page, request: import('@playwright/test').APIRequestContext) {
  expect((await request.post('/api/dev/clock', { data: { days: 30 } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('state-title')).toHaveText('The flame gutters');
  await expect(page.locator('body')).toHaveAttribute('data-room', 'grace');
  await expect.poll(() => page.locator('.atmosphere__sick').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
}

/** Screenshots the room alone (every page element hidden) and reports pixels, read back through a blank page's canvas. */
async function readRoom(page: Page, rects: { x: number; y: number; w: number; h: number }[], points: { x: number; y: number }[]) {
  const css = await page.addStyleTag({ content: '.page, .masthead, .colophon, .tm-toggle, .sound-toggle, .tm-toast, .tm, .story { visibility: hidden !important; }' });
  const png = (await page.screenshot({ animations: 'disabled' })).toString('base64');
  await css.evaluate((el) => (el as Element).remove());
  const reader = await page.context().newPage();
  try {
    return await reader.evaluate(
      async ({ png, rects, points }) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const L = (r: number, g: number, b: number) => {
          const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const extremes = rects.map((r) => {
          const x = Math.max(0, Math.floor(r.x));
          const y = Math.max(0, Math.floor(r.y));
          const w = Math.max(1, Math.min(img.width - x, Math.ceil(r.w)));
          const h = Math.max(1, Math.min(img.height - y, Math.ceil(r.h)));
          const d = ctx.getImageData(x, y, w, h).data;
          let lo: number[] = [255, 255, 255];
          let hi: number[] = [0, 0, 0];
          for (let i = 0; i < d.length; i += 4) {
            const l = L(d[i]!, d[i + 1]!, d[i + 2]!);
            if (l < L(lo[0]!, lo[1]!, lo[2]!)) lo = [d[i]!, d[i + 1]!, d[i + 2]!];
            if (l > L(hi[0]!, hi[1]!, hi[2]!)) hi = [d[i]!, d[i + 1]!, d[i + 2]!];
          }
          return { lo, hi };
        });
        const px = points.map((p) => Array.from(ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data.slice(0, 3)));
        // Mean colour over the middle of the screen, where no vignette or edge light reaches.
        const mid = ctx.getImageData(Math.floor(img.width * 0.3), Math.floor(img.height * 0.3), Math.floor(img.width * 0.4), Math.floor(img.height * 0.4)).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < mid.length; i += 4) for (let c = 0; c < 3; c++) sum[c]! += mid[i + c]!;
        const n = mid.length / 4;
        return { extremes, px, mean: sum.map((s) => s / n) };
      },
      { png, rects, points },
    );
  } finally {
    await reader.close();
  }
}

/** Every visible piece of text on the page that has no opaque surface under it, in the current viewport. */
function probeText(page: Page): Promise<Probe[]> {
  return page.evaluate(() => {
    const out: Probe[] = [];
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el || el.closest('.sr-only, .skip-link, [hidden], [aria-hidden="true"], svg, script, style, aside.tm')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
      const layers: [number, number, number, number][] = [];
      let painted = false;
      for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        // A gradient or image surface (parchment, envelopes, wax) is its own palette, which axe audits.
        if (s.backgroundImage !== 'none') painted = true;
        const bg = parse(s.backgroundColor);
        if (bg[3] > 0) layers.unshift(bg);
      }
      if (painted) continue;
      const c = parse(style.color);
      out.push({ text: text.slice(0, 40), color: c, size: parseFloat(style.fontSize), weight: Number(style.fontWeight), rect: { x: r.left, y: r.top, w: r.width, h: r.height }, layers });
    }
    return out;
  });
}

async function assertAA(page: Page, label: string) {
  const failures: string[] = [];
  let checked = 0;
  for (const top of [0, 600, 1200, 1800]) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    const probes = await probeText(page);
    const room = await readRoom(page, probes.map((p) => p.rect), []);
    probes.forEach((p, i) => {
      for (const extreme of [room.extremes[i]!.lo, room.extremes[i]!.hi] as RGB[]) {
        let bg: RGB = extreme;
        for (const layer of p.layers) bg = over(layer, bg);
        const fg = over(p.color, bg);
        const large = p.size >= 24 || (p.size >= 18.66 && p.weight >= 700);
        const need = large ? 3 : 4.5;
        const got = contrast(fg, bg);
        checked++;
        if (got < need) failures.push(`${label} "${p.text}" ${got.toFixed(2)}:1 < ${need}:1 on rgb(${bg.map(Math.round)})`);
      }
    });
  }
  expect(checked).toBeGreaterThan(40);
  expect(failures).toEqual([]);
}

test('the grace room is a sickly yellow-green, unlike the lit room (Req 10.18)', async ({ page, request }) => {
  await startDemo(page);
  await expect(page.getByTestId('state-title')).toHaveText('The candle burns');
  const lit = await readRoom(page, [], []);

  await goToGrace(page, request);
  const grace = await readRoom(page, [], []);
  const [r, g, b] = grace.mean as RGB;
  // Hue in the yellow-green band (60 to 95 degrees), clearly saturated, and green leading blue by a wide margin.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const hue = max === g ? 60 * (2 + (b - r) / (max - min)) : max === r ? (60 * ((g - b) / (max - min)) + 360) % 360 : 60 * (4 + (r - g) / (max - min));
  const saturation = max === 0 ? 0 : (max - min) / max;
  expect(hue, `room is rgb(${grace.mean.map(Math.round)})`).toBeGreaterThanOrEqual(60);
  expect(hue).toBeLessThanOrEqual(95);
  expect(saturation).toBeGreaterThanOrEqual(0.45);
  expect(g).toBeGreaterThan(b * 2);
  // And it is a different room from the lit one, which leans orange.
  const litHue = lit.mean[0]! > lit.mean[1]! ? 'warm' : 'cool';
  expect(litHue).toBe('warm');
});

test('the grace room flickers slowly at the edges of the viewport, and holds still under reduced motion (Req 10.18, 10.3)', async ({ page, request, browser }) => {
  await startDemo(page);
  await goToGrace(page, request);
  // Reduced motion (the project default): the tint is there, nothing moves.
  const flicker = page.locator('.atmosphere__flicker');
  expect(await flicker.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await flicker.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);

  // Motion allowed: a slow, endless, opacity-only flicker (it stays on the compositor).
  const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 720 }, storageState: await page.context().storageState() });
  const live = await ctx.newPage();
  try {
    await live.goto(page.url());
    await expect(live.locator('body')).toHaveAttribute('data-room', 'grace');
    const spec = await live.locator('.atmosphere__flicker').evaluate((el) => {
      const s = getComputedStyle(el);
      const effect = el.getAnimations()[0]?.effect as KeyframeEffect | undefined;
      return {
        name: s.animationName,
        seconds: parseFloat(s.animationDuration),
        count: s.animationIterationCount,
        properties: [...new Set((effect?.getKeyframes() ?? []).flatMap((k) => Object.keys(k)))].filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)),
      };
    });
    expect(spec.name).not.toBe('none');
    expect(spec.seconds).toBeGreaterThanOrEqual(4);
    expect(spec.count).toBe('infinite');
    expect(spec.properties).toEqual(['opacity']);
    // It is the room's edges that move: with the flicker at full, the edge is brighter than with it off, the middle is the same.
    const sample = async (opacity: number) => {
      await live.addStyleTag({ content: `.atmosphere__flicker { animation: none !important; transition: none !important; opacity: ${opacity} !important; }` });
      return readRoom(live, [], [{ x: 10, y: 360 }, { x: 640, y: 360 }, { x: 1270, y: 360 }]);
    };
    const off = await sample(0);
    const full = await sample(1);
    const sum = (p: number[]) => p[0]! + p[1]!;
    expect(sum(full.px[0]!)).toBeGreaterThan(sum(off.px[0]!) + 8);
    expect(sum(full.px[2]!)).toBeGreaterThan(sum(off.px[2]!) + 8);
    expect(Math.abs(sum(full.px[1]!) - sum(off.px[1]!))).toBeLessThanOrEqual(2);
  } finally {
    await ctx.close();
  }
});

test('every piece of text on the grace room keeps WCAG AA contrast, even with the flicker at its brightest (Req 10.18, 10.1)', async ({ page, request }) => {
  test.setTimeout(120_000);
  await startDemo(page);
  await goToGrace(page, request);
  await assertAA(page, 'steady');
  // Worst case: the flicker at its peak, as the keyframes' brightest frame.
  await page.addStyleTag({ content: '.atmosphere__flicker { animation: none !important; transition: none !important; opacity: 1 !important; }' });
  await assertAA(page, 'peak');
});
