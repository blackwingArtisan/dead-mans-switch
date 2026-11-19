/** Domain types shared by the web app, the API and the worker. */

export type SwitchState = 'alive' | 'reminder' | 'grace' | 'confirm' | 'released' | 'paused';

export type Custody = 'keepsake' | 'vault';

export interface Person {
  name: string;
  email: string;
}

export interface Settings {
  /** Days between check-ins. */
  cadenceDays: number;
  /** Days after the deadline before witnesses are asked. */
  graceDays: number;
  /** Days before the deadline that the first reminder goes out. */
  reminderLeadDays: number;
  /** How many witnesses must confirm before release. */
  witnessesRequired: number;
  /**
   * If set, release after this many days in the confirm stage with no witness
   * denial, even without enough confirmations. Null means never release on silence.
   */
  silenceReleaseDays: number | null;
}

export type WitnessResponse = 'pending' | 'confirmed' | 'denied';

export interface Witness extends Person {
  id: string;
  /** SHA-256 of the witness link token for the current confirm round. */
  tokenHash: string | null;
  response: WitnessResponse;
  respondedAt: number | null;
  addedAt: number;
}

/** What the server stores for a sealed letter. It never includes the full key. */
export interface SealedLetter {
  /** base64url AES-GCM ciphertext (includes the auth tag). */
  ciphertext: string;
  /** base64url 96-bit IV. */
  iv: string;
  /** base64url 32-byte vault half B. */
  vaultHalf: string;
  /** base64url SHA-256 of the keepsake half A, so a recipient can check A before breaking the seal. */
  keepsakeTag: string;
  /** Only present in vault custody: base64url keepsake half A. */
  keepsakeHalf?: string;
}

export interface Letter {
  id: string;
  recipient: Person;
  custody: Custody;
  sealedAt: number;
  /** Null once the recipient has opened it: the server forgets the sealed copy. */
  sealed: SealedLetter | null;
  openTokenHash: string | null;
  releasedAt: number | null;
  openedAt: number | null;
  /** "A candle lit back": one line the recipient may leave after reading. Absent on older vaults. */
  candle?: CandleLine | null;
}

export interface CandleLine {
  line: string;
  at: number;
}

/** A candle as the other recipients and the witnesses see it. */
export interface CandleBack extends CandleLine {
  from: string;
}

export type HistoryKind =
  | 'created'
  | 'check-in'
  | 'reminder'
  | 'grace'
  | 'last-call'
  | 'confirm'
  | 'witness-confirmed'
  | 'witness-denied'
  | 'released'
  | 'paused'
  | 'resumed'
  | 'letter-sealed'
  | 'letter-burned'
  | 'letter-opened'
  | 'candle-lit'
  | 'witness-added'
  | 'witness-removed'
  | 'settings'
  | 'mail-failed';

export interface HistoryEntry {
  at: number;
  kind: HistoryKind;
  note: string;
}

export interface Vault {
  id: string;
  ownerTokenHash: string;
  author: Person;
  settings: Settings;
  state: SwitchState;
  stateSince: number;
  lastCheckInAt: number;
  /** Increments on every check-in; reminder keys are scoped to it. */
  cycle: number;
  /** Set when a witness denial restarts a grace window. */
  graceEndsOverride: number | null;
  confirmStartedAt: number | null;
  /** Confirm rounds so far (each round mints fresh witness tokens). */
  confirmRound: number;
  releasedAt: number | null;
  /** Reminder keys already sent in this cycle, for idempotent ticks. */
  sent: string[];
  witnesses: Witness[];
  letters: Letter[];
  history: HistoryEntry[];
  createdAt: number;
  /**
   * Hashes of the one-tap check-in links mailed to the author in this cycle. Each link can only
   * check in; a check-in starts a new cycle and empties this list, so every link works once.
   */
  checkInTokenHashes?: string[];
}

export interface Schedule {
  reminderAt: number;
  dueAt: number;
  lastCallAt: number;
  graceEndsAt: number;
  silenceReleaseAt: number | null;
}

/** Letter content before sealing. Only ever exists in a browser. */
export interface LetterContent {
  title: string;
  html: string;
  /** Sign-off name, shown under the letter. */
  from: string;
}

export const DEFAULT_SETTINGS: Settings = {
  cadenceDays: 30,
  graceDays: 7,
  reminderLeadDays: 3,
  witnessesRequired: 1,
  silenceReleaseDays: 14,
};
