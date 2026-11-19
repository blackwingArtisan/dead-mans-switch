import { describe, expect, it } from 'vitest';
import { repeats } from '../../src/web/components/Lost';

describe('link notices drop a server message that only repeats the heading', () => {
  it('treats "This letter link is not valid." as the same as "This link is not valid"', () => {
    expect(repeats('This link is not valid', 'This letter link is not valid.')).toBe(true);
  });

  it('keeps a message that adds something', () => {
    expect(repeats('This link is not valid', 'This seal has already been broken. The letter can only be opened once.')).toBe(false);
    expect(repeats('Nothing to answer', 'This witness link is no longer needed.')).toBe(false);
  });
});
