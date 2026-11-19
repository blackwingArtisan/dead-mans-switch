// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ALLOWED_TAGS, sanitizeLetterHtml } from '../../src/web/lib/sanitize';

describe('letter sanitiser', () => {
  it('strips script elements and their contents (Req 7.7)', () => {
    const out = sanitizeLetterHtml('<p>Dear Theo</p><script>window.stolen = 1</script>');
    expect(out).toBe('<p>Dear Theo</p>');
    expect(out).not.toMatch(/script|stolen/i);
  });

  it('strips event handlers and every other attribute, keeping the text (Req 7.7)', () => {
    const out = sanitizeLetterHtml('<p onclick="alert(1)" style="color:red" class="x" id="y">Hello</p><strong onmouseover="alert(2)">there</strong>');
    expect(out).toBe('<p>Hello</p><strong>there</strong>');
  });

  it('strips unknown and dangerous tags (Req 7.7)', () => {
    const html =
      '<p>kept</p><img src="x" onerror="alert(1)"><iframe src="https://example.com"></iframe>' +
      '<a href="javascript:alert(1)">link</a><svg onload="alert(1)"><circle/></svg><form action="https://example.com"><input></form>' +
      '<style>p{display:none}</style><marquee>spin</marquee>';
    const out = sanitizeLetterHtml(html);
    for (const tag of ['img', 'iframe', 'a', 'svg', 'form', 'input', 'style', 'marquee']) {
      expect(out).not.toMatch(new RegExp(`<${tag}[\\s>/]`, 'i'));
    }
    expect(out).not.toMatch(/javascript:|onerror|onload|href|src=/i);
    expect(out).toContain('<p>kept</p>');
  });

  it('keeps every allow-listed formatting tag (Req 7.7)', () => {
    const html = ALLOWED_TAGS.filter((t) => !['br', 'li'].includes(t))
      .map((t) => `<${t}>x</${t}>`)
      .join('')
      .replace('</ul>', '<li>one</li></ul>')
      .replace('</ol>', '<li>two</li></ol>');
    const out = sanitizeLetterHtml(`${html}<p>a<br>b</p>`);
    for (const tag of ALLOWED_TAGS) expect(out).toContain(`<${tag}>`);
  });

  it('does not let a mutation-style payload revive a script (Req 7.7)', () => {
    const out = sanitizeLetterHtml('<p><<script>alert(1)//<</script>script>text</p><math><mtext><table><mglyph><style><img src=x onerror=alert(1)>');
    expect(out).not.toMatch(/<script|<img|onerror|<math|<style/i);
  });
});
