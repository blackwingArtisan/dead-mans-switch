import { describe, expect, it } from 'vitest';
import { bedFor } from '../../src/web/lib/sound';

describe('the room sound', () => {
  it('gives each room its own bed, and silence once the letters are out', () => {
    expect(bedFor('alive')).toBe('crackle');
    expect(bedFor('reminder')).toBe('crackle');
    expect(bedFor('grace')).toBe('wind');
    expect(bedFor('confirm')).toBe('heartbeat');
    expect(bedFor('released')).toBe('silence');
    expect(bedFor('paused')).toBe('silence');
    expect(bedFor(null)).toBe('silence');
  });
});
