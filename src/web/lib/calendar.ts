/**
 * "Add the check-in to your calendar": a standard iCalendar (.ics) event that repeats on the vigil's
 * cadence, so one tap a month becomes a habit the author's own calendar keeps. Built in the browser;
 * it carries the app's address and nothing secret (no owner token, no letter data).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC date-time in the compact iCalendar form, e.g. 20261218T090000Z. */
export function icsDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escapes text for an iCalendar property value. */
function text(value: string): string {
  return value.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
}

export function checkInCalendar(opts: { dueAt: number; cadenceDays: number; appUrl: string; now: number; uid: string }): string {
  // The reminder lands a day before each deadline, at the same time of day.
  const start = opts.dueAt - 86_400_000;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Last Candle//Check-in reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${icsDate(opts.now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(start + 15 * 60_000)}`,
    `RRULE:FREQ=DAILY;INTERVAL=${opts.cadenceDays}`,
    `SUMMARY:${text('Keep the candle lit: check in')}`,
    `DESCRIPTION:${text(`One tap: "I still walk among the living." ${opts.appUrl}`)}`,
    `URL:${opts.appUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text('Check in on your vigil')}`,
    'TRIGGER:-PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function downloadCalendar(ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'keep-the-candle-lit.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
