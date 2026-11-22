import { describe, expect, it } from 'vitest';
import { DEMO, FOUNDER_DEMO } from '../../src/web/lib/seal';
import { STORY_HOLD_MS, STORY_SECONDS } from '../../src/web/lib/story';

describe('the demo vigils the story uses', () => {
  it("seals June's letter in keepsake custody and Theo's in vault custody, so the demo shows both modes (Req 12.6)", () => {
    const custody = Object.fromEntries(DEMO.letters.map((l) => [l.recipient.name, l.custody]));
    expect(custody).toEqual({ 'Theo Whitlock': 'vault', 'June Okafor': 'keepsake' });
    expect(new Set(DEMO.letters.map((l) => l.custody))).toEqual(new Set(['keepsake', 'vault']));
  });

  it("keeps both custody modes in the founder's demo too (Req 12.6)", () => {
    expect(new Set(FOUNDER_DEMO.letters.map((l) => l.custody))).toEqual(new Set(['keepsake', 'vault']));
  });
});

describe('the story label', () => {
  it('is within 5 seconds of the sum of the story\'s declared holds, and never shorter than them (Req 12.12)', () => {
    const holdSeconds = STORY_HOLD_MS / 1000;
    expect(STORY_SECONDS).toBeGreaterThanOrEqual(Math.round(holdSeconds));
    expect(STORY_SECONDS - holdSeconds).toBeLessThanOrEqual(5);
  });
});
