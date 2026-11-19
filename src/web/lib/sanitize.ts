import DOMPurify from 'dompurify';

/** Formatting tags a letter may carry. Nothing else survives, and no tag keeps any attribute. */
export const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'div', 'span'];

/** Sanitises decrypted letter HTML to the allow-list above (Req 7.7). */
export function sanitizeLetterHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}
