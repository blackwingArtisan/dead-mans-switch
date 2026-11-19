import { describe, expect, it } from 'vitest';
import { checkInCalendar, icsDate } from '../../src/web/lib/calendar';

describe('the check-in calendar reminder', () => {
  const dueAt = Date.UTC(2026, 11, 18, 9, 30, 0);
  const ics = checkInCalendar({ dueAt, cadenceDays: 30, appUrl: 'https://vigil.example.com/', now: Date.UTC(2026, 10, 18), uid: 'v1@example.com' });

  it('writes UTC times in the compact iCalendar form', () => {
    expect(icsDate(dueAt)).toBe('20261218T093000Z');
  });

  it('repeats on the vigil cadence, a day before each deadline', () => {
    expect(ics).toContain('DTSTART:20261217T093000Z');
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=30');
    expect(ics).toContain('URL:https://vigil.example.com/');
  });

  it('is a well-formed calendar with CRLF line ends and escaped text', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('SUMMARY:Keep the candle lit: check in');
    expect(ics).toContain('the living." https://vigil.example.com/');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('carries no secret', () => {
    expect(ics).not.toMatch(/token|#k=/i);
  });
});
