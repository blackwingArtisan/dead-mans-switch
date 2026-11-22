import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Candle } from '../../src/web/components/Candle';
import type { SwitchState } from '../../src/core/types';

const STATES: SwitchState[] = ['alive', 'reminder', 'grace', 'confirm', 'released', 'paused'];
const html = (state: SwitchState, remaining: number) => renderToStaticMarkup(createElement(Candle, { state, remaining }));
const waxHeight = (h: string) => Number(/<rect[^>]*height="([\d.]+)"[^>]*fill="url\(#c-wax\)"|<rect[^>]*fill="url\(#c-wax\)"[^>]*height="([\d.]+)"/.exec(h)!.slice(1).find(Boolean));
const poolRx = (h: string) => Number(/<ellipse[^>]*class="candle__pool"[^>]*\brx="([\d.]+)"|<ellipse[^>]*\brx="([\d.]+)"[^>]*class="candle__pool"/.exec(h)!.slice(1).find(Boolean));

describe('the candle keeps its height and melts into a pool (Req 10.21)', () => {
  it.each(STATES)('draws the wax column at the baseline height in the %s state, however few days remain', (state) => {
    const full = waxHeight(html(state, 1));
    expect(full).toBeGreaterThan(200);
    for (const remaining of [0.6, 0.2, 0]) expect(waxHeight(html(state, remaining))).toBe(full);
  });

  it('widens the pool at the base as the days run down', () => {
    const rx = [1, 0.6, 0.2, 0].map((r) => poolRx(html('alive', r)));
    for (let i = 1; i < rx.length; i++) expect(rx[i]).toBeGreaterThan(rx[i - 1]!);
  });

  it('has the widest pool once the candle is out, and keeps it hidden from assistive technology', () => {
    expect(poolRx(html('confirm', 1))).toBe(poolRx(html('alive', 0)));
    expect(html('alive', 0.5)).toContain('aria-hidden="true"');
  });
});
