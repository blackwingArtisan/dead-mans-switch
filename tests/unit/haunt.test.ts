import { describe, expect, it } from 'vitest';
import { BASE_TITLE, tabIcon, tabIconHref, tabTitle } from '../../src/web/lib/haunt';

describe('the haunted tab', () => {
  it('names the state in the tab title only when something is wrong', () => {
    expect(tabTitle(null)).toBe(BASE_TITLE);
    expect(tabTitle('alive')).toBe(BASE_TITLE);
    expect(tabTitle('reminder')).toBe(BASE_TITLE);
    expect(tabTitle('paused')).toBe(BASE_TITLE);
    expect(tabTitle('grace')).toBe(`(!) Your candle gutters · ${BASE_TITLE}`);
    expect(tabTitle('confirm')).toBe(`The candle is out · ${BASE_TITLE}`);
    expect(tabTitle('released')).toBe(`The letters are delivered · ${BASE_TITLE}`);
  });

  it('draws a lit, a guttering and an unlit candle for the favicon', () => {
    const lit = tabIcon('alive');
    const grace = tabIcon('grace');
    const out = tabIcon('confirm');
    expect(new Set([lit, grace, out]).size).toBe(3);
    expect(out).toContain('stroke="#b8ab98"'); // smoke, no flame
    expect(out).not.toContain('#ffcf7a');
    for (const svg of [lit, grace, out]) expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('is served as a data URL, which the content security policy allows for images', () => {
    expect(tabIconHref('grace')).toMatch(/^data:image\/svg\+xml,%3Csvg/);
  });
});
