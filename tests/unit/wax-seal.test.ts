import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WaxSeal } from '../../src/web/components/WaxSeal';

describe('WaxSeal', () => {
  it.each([72, 150])('draws the mark "I" as exactly one text glyph at %i px', (size) => {
    const html = renderToStaticMarkup(createElement(WaxSeal, { size, mark: 'I' }));
    expect(html.match(/<text\b/g)).toHaveLength(1);
    expect(html.match(/>I<\/text>/g)).toHaveLength(1);
  });

  it('draws a longer mark once and stays hidden from assistive technology', () => {
    const html = renderToStaticMarkup(createElement(WaxSeal, { mark: 'II', tone: 'ember' }));
    expect(html.match(/<text\b/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
  });

  it('draws no text for the candle sigil', () => {
    expect(renderToStaticMarkup(createElement(WaxSeal, {}))).not.toContain('<text');
  });
});
