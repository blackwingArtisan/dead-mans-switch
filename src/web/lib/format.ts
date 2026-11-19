import type { SwitchState } from '../../core/types';

const DAY = 86_400_000;

/** Dates are shown in the viewer's own time zone; pass `timeZone` only to pin one (tests, emails). */
export function longDate(at: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(at);
}

export function shortDate(at: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(at);
}

/** "in 3 days", "2 days ago", "in 5 hours", "today". */
export function relative(at: number, now: number): string {
  const diff = at - now;
  const abs = Math.abs(diff);
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  let text: string;
  if (abs < 60 * 60 * 1000) text = fmt(Math.max(1, Math.round(abs / 60000)), 'minute');
  else if (abs < DAY) text = fmt(Math.round(abs / 3_600_000), 'hour');
  else text = fmt(Math.round(abs / DAY), 'day');
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export const STAGES: { state: SwitchState; label: string }[] = [
  { state: 'alive', label: 'Alive' },
  { state: 'reminder', label: 'Reminder' },
  { state: 'grace', label: 'Grace' },
  { state: 'confirm', label: 'Witnesses' },
  { state: 'released', label: 'Released' },
];

export const STATE_COPY: Record<SwitchState, { title: string; plain: string }> = {
  alive: { title: 'The candle burns', plain: 'You have checked in. Nothing will be sent.' },
  reminder: { title: 'The candle burns low', plain: 'Your check-in is due soon. A reminder has been sent.' },
  grace: { title: 'The flame gutters', plain: 'You missed your check-in. Check in before the grace period ends.' },
  confirm: {
    title: 'The candle has gone out',
    plain: 'Your witnesses have been asked to confirm. Check in now to stop everything.',
  },
  released: { title: 'The letters are delivered', plain: 'Your witnesses confirmed. Each recipient received a one-time link.' },
  paused: { title: 'Under glass', plain: 'The vigil is paused. No reminders or releases until you resume.' },
};
