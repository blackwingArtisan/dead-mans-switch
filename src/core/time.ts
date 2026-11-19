import type { Schedule, Vault } from './types';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Deadlines for the vault's current cycle, derived only from stored facts. */
export function scheduleOf(vault: Vault): Schedule {
  const { cadenceDays, graceDays, reminderLeadDays, silenceReleaseDays } = vault.settings;
  const dueAt = vault.lastCheckInAt + cadenceDays * DAY;
  const lead = Math.min(reminderLeadDays, cadenceDays) * DAY;
  const reminderAt = dueAt - lead;
  const graceEndsAt = vault.graceEndsOverride ?? dueAt + graceDays * DAY;
  // Last call is one day before grace ends, but never before the grace period starts.
  const lastCallAt = Math.max(graceEndsAt - DAY, Math.min(dueAt, graceEndsAt));
  const silenceReleaseAt =
    silenceReleaseDays !== null && vault.confirmStartedAt !== null
      ? vault.confirmStartedAt + silenceReleaseDays * DAY
      : null;
  return { reminderAt, dueAt, lastCallAt, graceEndsAt, silenceReleaseAt };
}

/** The next instant at which a tick could change this vault, or null if none. */
export function nextEventAt(vault: Vault, now: number): number | null {
  const s = scheduleOf(vault);
  const sent = new Set(vault.sent);
  const candidates: number[] = [];
  switch (vault.state) {
    case 'alive':
      candidates.push(s.reminderAt);
      break;
    case 'reminder':
      candidates.push(s.dueAt);
      break;
    case 'grace':
      if (!sent.has(sentKey(vault, 'last-call'))) candidates.push(s.lastCallAt);
      candidates.push(s.graceEndsAt);
      break;
    case 'confirm':
      if (s.silenceReleaseAt !== null) candidates.push(s.silenceReleaseAt);
      break;
    default:
      return null;
  }
  const future = candidates.filter((t) => t > now);
  if (future.length === 0) return candidates.length ? now : null;
  return Math.min(...future);
}

export function sentKey(vault: Vault, what: string): string {
  return `c${vault.cycle}:r${vault.confirmRound}:${what}`;
}

export function daysBetween(from: number, to: number): number {
  return (to - from) / DAY;
}

/**
 * "Their candle, your light": the author's own candle as they last tended it. The wax stands where it
 * was at the moment of the last check-in (a check-in with nine days of a thirty-day cadence to spare
 * left 30% of the candle), and a vigil never checked in since it began stands full. Never below the
 * stub the vigil page draws.
 */
export function lastCandleOf(vault: Vault): { keptUntil: number; wax: number } {
  const checkIns = vault.history.filter((h) => h.kind === 'check-in').map((h) => h.at);
  const last = vault.lastCheckInAt;
  if (!checkIns.includes(last)) return { keptUntil: last, wax: 1 };
  const before = [vault.createdAt, ...checkIns.filter((at) => at < last)];
  const previous = Math.max(...before);
  const burned = (last - previous) / (vault.settings.cadenceDays * DAY);
  return { keptUntil: last, wax: Math.max(0.06, Math.min(1, 1 - burned)) };
}
