/** The yearly review nudge: how old the oldest still-sealed letter is. Pure; `now` always comes from the caller. */
import { DAY } from './time';
import type { Vault } from './types';

export const REVIEW_AFTER_DAYS = 365;

export interface ReviewNote {
  oldestSealedAt: number;
  /** Whole days since the oldest letter was sealed. */
  ageDays: number;
  years: number;
  /** Days left over after the whole years. */
  days: number;
}

/** Null unless the oldest sealed, unreleased letter is at least a year old. */
export function reviewOf(vault: Vault, now: number): ReviewNote | null {
  if (vault.state === 'released') return null;
  const sealedAts = vault.letters.filter((l) => l.sealed !== null && l.releasedAt === null).map((l) => l.sealedAt);
  if (sealedAts.length === 0) return null;
  const oldestSealedAt = Math.min(...sealedAts);
  const ageDays = Math.floor((now - oldestSealedAt) / DAY);
  if (ageDays < REVIEW_AFTER_DAYS) return null;
  return { oldestSealedAt, ageDays, years: Math.floor(ageDays / REVIEW_AFTER_DAYS), days: ageDays % REVIEW_AFTER_DAYS };
}

/** "1 year and 3 days", "2 years", for the email and the vigil note. */
export function describeAge(note: Pick<ReviewNote, 'years' | 'days'>): string {
  const y = `${note.years} year${note.years === 1 ? '' : 's'}`;
  return note.days ? `${y} and ${note.days} day${note.days === 1 ? '' : 's'}` : y;
}
