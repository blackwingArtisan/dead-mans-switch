/**
 * The switch state machine. Pure: (vault, event, context) -> { vault, effects }.
 *
 *   alive ──(reminder lead)──> reminder ──(deadline)──> grace ──(grace ends)──> confirm ──(k confirm / silence)──> released
 *     ^                           │                       │                       │
 *     └────────── checkIn ────────┴───────────────────────┴───────────────────────┘
 *                                       grace <── witness denies ──┘
 *   pause (any live state) -> paused -> resume -> alive
 */
import type { HistoryKind, Person, Vault } from './types';
import { reviewOf } from './review';
import { scheduleOf, sentKey } from './time';

export type SwitchEvent =
  | { type: 'tick' }
  | { type: 'checkIn' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'witnessConfirm'; witnessId: string; /** Séance letters: this witness's share per letter id, already validated. */ shares?: Record<string, string> }
  | { type: 'witnessDeny'; witnessId: string; /** An optional line from the witness to the author, already trimmed. */ note?: string };

export type EmailEffect =
  | { template: 'reminder'; to: Person; dueAt: number; /** Set when the oldest sealed letter is a year old: the email asks the author to review. */ reviewAgeDays?: number }
  | { template: 'grace'; to: Person; dueAt: number; graceEndsAt: number }
  | { template: 'last-call'; to: Person; graceEndsAt: number }
  | { template: 'witness-ask'; to: Person; authorName: string; lastCheckInAt: number; witnessToken: string }
  | { template: 'witnesses-asked'; to: Person; witnessCount: number }
  | { template: 'stand-down'; to: Person; authorName: string }
  | { template: 'denied'; to: Person; witnessName: string; graceEndsAt: number; witnessNote?: string }
  | { template: 'witness-named'; to: Person; authorName: string; witnessesRequired: number }
  | { template: 'candle-lit'; to: Person; authorName: string; from: string; line: string }
  | {
      template: 'release';
      to: Person;
      authorName: string;
      letterId: string;
      openToken: string;
      /** Present only in vault custody, where the server holds both halves. */
      keepsakeHalf?: string;
    };

export type Effect = { type: 'email'; vaultId: string } & EmailEffect;

export interface MintedToken {
  token: string;
  hash: string;
}

export interface MachineContext {
  now: number;
  /** Returns a fresh random token and its hash. Injected to keep the machine pure. */
  mint: () => MintedToken;
}

export interface StepResult {
  vault: Vault;
  effects: Effect[];
  changed: boolean;
}

export class SwitchError extends Error {
  constructor(
    message: string,
    readonly code: 'released' | 'paused' | 'not-confirming' | 'unknown-witness' | 'already-responded',
  ) {
    super(message);
    this.name = 'SwitchError';
  }
}

export const LIVE_STATES = ['alive', 'reminder', 'grace', 'confirm'] as const;

/** Applies one event. Ticks cascade until the vault is stable at `now`. */
export function step(input: Vault, event: SwitchEvent, ctx: MachineContext): StepResult {
  const vault: Vault = structuredClone(input);
  const effects: Effect[] = [];
  const emit = (e: EmailEffect) => effects.push({ type: 'email', vaultId: vault.id, ...e });
  const log = (kind: HistoryKind, note: string) => vault.history.push({ at: ctx.now, kind, note });
  const before = JSON.stringify(input);

  switch (event.type) {
    case 'tick':
      runTick(vault, ctx, emit, log);
      break;
    case 'checkIn':
      assertNotReleased(vault);
      checkIn(vault, ctx, emit, log, vault.state === 'paused' ? 'Returned from pause and checked in.' : 'Checked in.');
      break;
    case 'pause':
      assertNotReleased(vault);
      if (vault.state !== 'paused') {
        // Pausing proves the author is alive, so it also counts as a check-in.
        checkIn(vault, ctx, emit, log, 'Checked in before pausing.');
        vault.state = 'paused';
        vault.stateSince = ctx.now;
        log('paused', 'The vigil is paused. No reminders or releases until it resumes.');
      }
      break;
    case 'resume':
      assertNotReleased(vault);
      if (vault.state === 'paused') {
        vault.state = 'alive';
        vault.stateSince = ctx.now;
        vault.lastCheckInAt = ctx.now;
        vault.cycle += 1;
        vault.sent = [];
        log('resumed', 'The vigil resumed with a fresh candle.');
      }
      break;
    case 'witnessConfirm':
    case 'witnessDeny': {
      runTick(vault, ctx, emit, log);
      assertNotReleased(vault);
      if (vault.state !== 'confirm') {
        throw new SwitchError('Nothing is waiting on your answer right now. Thank you for watching.', 'not-confirming');
      }
      const witness = vault.witnesses.find((w) => w.id === event.witnessId);
      if (!witness) throw new SwitchError('This witness is no longer on the list.', 'unknown-witness');
      if (witness.response !== 'pending') {
        throw new SwitchError('Your answer is already recorded.', 'already-responded');
      }
      witness.respondedAt = ctx.now;
      if (event.type === 'witnessConfirm') {
        witness.response = 'confirmed';
        for (const [letterId, share] of Object.entries(event.shares ?? {})) {
          const l = vault.letters.find((x) => x.id === letterId);
          if (l?.seance) l.shares = { ...l.shares, [witness.id]: share };
        }
        log('witness-confirmed', `${witness.name} confirmed.`);
        if (confirmations(vault) >= requiredConfirmations(vault)) release(vault, ctx, emit, log, 'Witnesses confirmed.');
      } else {
        witness.response = 'denied';
        deny(vault, witness.name, event.note, ctx, emit, log);
      }
      break;
    }
  }

  return { vault, effects, changed: JSON.stringify(vault) !== before };
}

function assertNotReleased(vault: Vault): void {
  if (vault.state === 'released') {
    throw new SwitchError('These letters have already been released. A released vigil cannot be undone.', 'released');
  }
}

type Emit = (e: EmailEffect) => void;
type Log = (kind: HistoryKind, note: string) => void;

function checkIn(vault: Vault, ctx: MachineContext, emit: Emit, log: Log, note: string): void {
  const wasConfirming = vault.state === 'confirm';
  if (wasConfirming) {
    for (const w of vault.witnesses) {
      if (w.tokenHash !== null) emit({ template: 'stand-down', to: person(w), authorName: vault.author.name });
    }
  }
  vault.state = 'alive';
  vault.stateSince = ctx.now;
  vault.lastCheckInAt = ctx.now;
  vault.cycle += 1;
  vault.sent = [];
  vault.graceEndsOverride = null;
  vault.confirmStartedAt = null;
  resetWitnesses(vault);
  log('check-in', wasConfirming ? `${note} Witnesses were told to stand down.` : note);
}

function discardShares(vault: Vault): void {
  for (const l of vault.letters) delete l.shares;
}

function resetWitnesses(vault: Vault): void {
  discardShares(vault);
  for (const w of vault.witnesses) {
    w.response = 'pending';
    w.respondedAt = null;
    w.tokenHash = null;
  }
}

function runTick(vault: Vault, ctx: MachineContext, emit: Emit, log: Log): void {
  // Each pass moves at most one stage; loop so a long silence cascades in one tick.
  for (let guard = 0; guard < 10; guard++) {
    const s = scheduleOf(vault);
    const now = ctx.now;
    const once = (what: string): boolean => {
      const key = sentKey(vault, what);
      if (vault.sent.includes(key)) return false;
      vault.sent.push(key);
      return true;
    };
    const moveTo = (state: Vault['state']) => {
      vault.state = state;
      vault.stateSince = now;
    };

    if (vault.state === 'alive' && now >= s.reminderAt) {
      moveTo('reminder');
      if (once('reminder')) {
        const review = reviewOf(vault, now);
        emit({ template: 'reminder', to: vault.author, dueAt: s.dueAt, ...(review ? { reviewAgeDays: review.ageDays } : {}) });
      }
      log('reminder', 'The candle burns low. A reminder was sent.');
      continue;
    }
    if (vault.state === 'reminder' && now >= s.dueAt) {
      moveTo('grace');
      if (once('grace')) emit({ template: 'grace', to: vault.author, dueAt: s.dueAt, graceEndsAt: s.graceEndsAt });
      log('grace', 'The deadline passed. The grace period has begun.');
      continue;
    }
    if (vault.state === 'grace') {
      if (now >= s.graceEndsAt) {
        enterConfirm(vault, ctx, emit, log);
        continue;
      }
      if (now >= s.lastCallAt && once('last-call')) {
        emit({ template: 'last-call', to: vault.author, graceEndsAt: s.graceEndsAt });
        log('last-call', 'Last call: witnesses will be asked within a day.');
      }
      return;
    }
    if (vault.state === 'confirm') {
      if (confirmations(vault) >= requiredConfirmations(vault) && requiredConfirmations(vault) > 0) {
        release(vault, ctx, emit, log, 'Witnesses confirmed.');
        return;
      }
      if (s.silenceReleaseAt !== null && now >= s.silenceReleaseAt && !anyDenied(vault)) {
        release(vault, ctx, emit, log, 'No witness answered within the silence window.');
      }
      return;
    }
    return;
  }
}

function enterConfirm(vault: Vault, ctx: MachineContext, emit: Emit, log: Log): void {
  vault.state = 'confirm';
  vault.stateSince = ctx.now;
  vault.confirmStartedAt = ctx.now;
  vault.confirmRound += 1;
  discardShares(vault);
  for (const w of vault.witnesses) {
    const minted = ctx.mint();
    w.tokenHash = minted.hash;
    w.response = 'pending';
    w.respondedAt = null;
    emit({
      template: 'witness-ask',
      to: person(w),
      authorName: vault.author.name,
      lastCheckInAt: vault.lastCheckInAt,
      witnessToken: minted.token,
    });
  }
  emit({ template: 'witnesses-asked', to: vault.author, witnessCount: vault.witnesses.length });
  log(
    'confirm',
    vault.witnesses.length
      ? `The grace period ended. ${vault.witnesses.length} witness${vault.witnesses.length === 1 ? ' was' : 'es were'} asked to confirm.`
      : 'The grace period ended. No witnesses are named, so only the silence window can release the letters.',
  );
}

function deny(vault: Vault, witnessName: string, note: string | undefined, ctx: MachineContext, emit: Emit, log: Log): void {
  const graceEndsAt = ctx.now + vault.settings.graceDays * 24 * 60 * 60 * 1000;
  vault.state = 'grace';
  vault.stateSince = ctx.now;
  vault.graceEndsOverride = graceEndsAt;
  vault.confirmStartedAt = null;
  discardShares(vault);
  for (const w of vault.witnesses) w.tokenHash = null;
  emit({ template: 'denied', to: vault.author, witnessName, graceEndsAt, ...(note ? { witnessNote: note } : {}) });
  log(
    'witness-denied',
    `${witnessName} says you still live${note ? ` and left a note: “${note}”` : ''}. The release was stopped and a new grace period began.`,
  );
}

function release(vault: Vault, ctx: MachineContext, emit: Emit, log: Log, reason: string): void {
  vault.state = 'released';
  vault.stateSince = ctx.now;
  vault.releasedAt = ctx.now;
  for (const w of vault.witnesses) w.tokenHash = null;
  let count = 0;
  for (const letter of vault.letters) {
    if (!letter.sealed || letter.releasedAt !== null) continue;
    const minted = ctx.mint();
    letter.openTokenHash = minted.hash;
    letter.releasedAt = ctx.now;
    count++;
    emit({
      template: 'release',
      to: letter.recipient,
      authorName: vault.author.name,
      letterId: letter.id,
      openToken: minted.token,
      ...(letter.custody === 'vault' && letter.sealed.keepsakeHalf ? { keepsakeHalf: letter.sealed.keepsakeHalf } : {}),
    });
  }
  log('released', `${reason} ${count} letter${count === 1 ? ' was' : 's were'} released.`);
}

export function confirmations(vault: Vault): number {
  return vault.witnesses.filter((w) => w.response === 'confirmed').length;
}

/** Never more than the witnesses who exist, so a removed witness cannot block release forever. */
export function requiredConfirmations(vault: Vault): number {
  return Math.min(vault.settings.witnessesRequired, vault.witnesses.length);
}

function anyDenied(vault: Vault): boolean {
  return vault.witnesses.some((w) => w.response === 'denied');
}

function person(p: Person): Person {
  return { name: p.name, email: p.email };
}
