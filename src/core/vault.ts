/** Vault construction, validation and the public view the author sees. */
import type { CandleBack, CandleLine, Custody, HistoryEntry, Letter, Person, Schedule, Settings, SwitchState, Vault, Witness } from './types';
import { DEFAULT_SETTINGS } from './types';
import { confirmations, requiredConfirmations } from './machine';
import { reviewOf, type ReviewNote } from './review';
import { nextEventAt, scheduleOf } from './time';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function cleanPerson(input: unknown, label: string): Person {
  const p = (input ?? {}) as Partial<Person>;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  if (!name || name.length > 80) throw new ValidationError(`Give the ${label} a name (up to 80 characters).`);
  if (!EMAIL.test(email) || email.length > 200) throw new ValidationError(`The ${label}'s email address does not look right.`);
  return { name, email };
}

function int(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined) return fallback;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

export function cleanSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = (input ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const cadenceDays = int(s.cadenceDays, base.cadenceDays, 1, 365, 'The check-in cadence');
  const graceDays = int(s.graceDays, base.graceDays, 1, 90, 'The grace period');
  const reminderLeadDays = int(s.reminderLeadDays, base.reminderLeadDays, 0, cadenceDays, 'The reminder lead');
  const witnessesRequired = int(s.witnessesRequired, base.witnessesRequired, 1, 10, 'Witnesses required');
  const silenceReleaseDays =
    s.silenceReleaseDays === null
      ? null
      : int(s.silenceReleaseDays, base.silenceReleaseDays ?? 14, 1, 365, 'The silence window');
  return { cadenceDays, graceDays, reminderLeadDays, witnessesRequired, silenceReleaseDays };
}

export function newVault(args: {
  id: string;
  ownerTokenHash: string;
  author: Person;
  settings: Settings;
  now: number;
}): Vault {
  return {
    id: args.id,
    ownerTokenHash: args.ownerTokenHash,
    author: args.author,
    settings: args.settings,
    state: 'alive',
    stateSince: args.now,
    lastCheckInAt: args.now,
    cycle: 1,
    graceEndsOverride: null,
    confirmStartedAt: null,
    confirmRound: 0,
    releasedAt: null,
    sent: [],
    witnesses: [],
    letters: [],
    history: [{ at: args.now, kind: 'created', note: 'The vigil began. The first candle is lit.' }],
    createdAt: args.now,
  };
}

export const MAX_LETTERS = 50;
export const MAX_CANDLE_LINE = 140;

/** One line, plain text, at most MAX_CANDLE_LINE characters once whitespace is collapsed. */
export function cleanCandleLine(input: unknown): string {
  if (typeof input !== 'string') throw new ValidationError('Write one line to leave with your candle.');
  const line = input.replace(/\s+/g, ' ').trim();
  if (!line) throw new ValidationError('Write one line to leave with your candle.');
  if (line.length > MAX_CANDLE_LINE) throw new ValidationError(`Keep it to one line of up to ${MAX_CANDLE_LINE} characters.`);
  return line;
}

/** Every candle left so far, oldest first. */
export function candlesOf(vault: Vault): CandleBack[] {
  return vault.letters
    .filter((l) => l.candle)
    .map((l) => ({ from: l.recipient.name, line: l.candle!.line, at: l.candle!.at }))
    .sort((a, b) => a.at - b.at);
}
export const MAX_WITNESSES = 10;
export const MAX_CIPHERTEXT = 400_000;

export function isEditable(state: SwitchState): boolean {
  return state !== 'released';
}

export interface WitnessView {
  id: string;
  name: string;
  email: string;
  response: Witness['response'];
  asked: boolean;
}

export interface LetterView {
  id: string;
  recipient: Person;
  custody: Custody;
  sealedAt: number;
  releasedAt: number | null;
  openedAt: number | null;
  candle: CandleLine | null;
}

export interface VaultView {
  id: string;
  author: Person;
  settings: Settings;
  state: SwitchState;
  stateSince: number;
  lastCheckInAt: number;
  schedule: Schedule;
  nextEventAt: number | null;
  now: number;
  confirmations: number;
  confirmationsRequired: number;
  witnesses: WitnessView[];
  letters: LetterView[];
  history: HistoryEntry[];
  releasedAt: number | null;
  /** Set when the oldest sealed letter is a year old or more: the vigil shows "Review your letters". */
  review: ReviewNote | null;
}

export function viewOf(vault: Vault, now: number): VaultView {
  return {
    id: vault.id,
    author: vault.author,
    settings: vault.settings,
    state: vault.state,
    stateSince: vault.stateSince,
    lastCheckInAt: vault.lastCheckInAt,
    schedule: scheduleOf(vault),
    nextEventAt: nextEventAt(vault, now),
    now,
    confirmations: confirmations(vault),
    confirmationsRequired: requiredConfirmations(vault),
    witnesses: vault.witnesses.map((w) => ({
      id: w.id,
      name: w.name,
      email: w.email,
      response: w.response,
      asked: w.tokenHash !== null || w.response !== 'pending',
    })),
    letters: vault.letters.map((l: Letter) => ({
      id: l.id,
      recipient: l.recipient,
      custody: l.custody,
      sealedAt: l.sealedAt,
      releasedAt: l.releasedAt,
      openedAt: l.openedAt,
      candle: l.candle ?? null,
    })),
    history: vault.history.slice(-60).reverse(),
    releasedAt: vault.releasedAt,
    review: reviewOf(vault, now),
  };
}
