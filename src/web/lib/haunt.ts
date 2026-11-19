/**
 * The haunted tab: the favicon and the tab title follow the vigil, so a guttering candle is seen
 * even from another tab. In grace the title reads "(!) Your candle gutters"; once it is out, "The
 * candle is out". A browser notification in grace is opt-in, asked for only by a press, and fires
 * once per missed deadline on that device. Only the favicon and the title change, never the page.
 */
import { useEffect } from 'react';
import type { SwitchState } from '../../core/types';

export const BASE_TITLE = 'Dead Man’s Switch';

/** The tab title for a vigil in this state. */
export function tabTitle(state: SwitchState | null): string {
  if (state === 'grace') return `(!) Your candle gutters · ${BASE_TITLE}`;
  if (state === 'confirm') return `The candle is out · ${BASE_TITLE}`;
  if (state === 'released') return `The letters are delivered · ${BASE_TITLE}`;
  return BASE_TITLE;
}

/** A 64 px candle drawn for the tab: lit, guttering (small, low flame) or out (a wisp of smoke). */
export function tabIcon(state: SwitchState | null): string {
  const seal = state === 'confirm' || state === 'released' ? '#2a3550' : state === 'grace' ? '#4f5a2c' : '#8e1b1b';
  const flame =
    state === 'grace'
      ? '<path d="M32 20c3 4 3 7 1 9-1 1-3 1-3 0-1-3 0-5 2-9z" fill="#ffb25a"/>'
      : state === 'confirm' || state === 'released'
        ? '<path d="M32 27c-3-3 3-5 0-9s2-5 0-8" fill="none" stroke="#b8ab98" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M32 12c4 6 5 10 2 14-2 2-4 2-5 0-2-4-1-8 3-14z" fill="#ffcf7a"/>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<circle cx="32" cy="32" r="30" fill="${seal}"/>` +
    '<circle cx="32" cy="32" r="22" fill="none" stroke="#120c08" stroke-opacity="0.6" stroke-width="2"/>' +
    flame +
    '<rect x="27" y="29" width="10" height="20" rx="1.5" fill="#efe3c8"/><path d="M21 50h22l-3 4H24z" fill="#120c08"/></svg>'
  );
}

export function tabIconHref(state: SwitchState | null): string {
  return `data:image/svg+xml,${encodeURIComponent(tabIcon(state))}`;
}

function setTab(state: SwitchState | null): void {
  document.title = tabTitle(state);
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = state ? tabIconHref(state) : '/favicon.svg';
}

/** Keeps the tab's title and favicon in step with the vigil while it is on screen. */
export function useHauntedTab(state: SwitchState | null): void {
  useEffect(() => {
    setTab(state);
  }, [state]);
  useEffect(() => () => setTab(null), []);
}

const OPT_IN = 'dms.grace-notice';
const SENT = 'dms.grace-notice-sent';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; the notice then simply is not remembered.
  }
}

/** Whether this browser can be asked at all (and has not already refused). */
export function graceNoticeAvailable(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission !== 'denied';
}

export function graceNoticeOn(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && read(OPT_IN) === 'on';
}

/** Asks for permission. Only ever called from a press. */
export async function enableGraceNotice(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const answer = await Notification.requestPermission();
  if (answer === 'granted') write(OPT_IN, 'on');
  return answer === 'granted';
}

export function disableGraceNotice(): void {
  write(OPT_IN, 'off');
}

/** In grace, warns once per missed deadline on a device that opted in. */
export function useGraceNotice(state: SwitchState | null, dueAt: number | null): void {
  useEffect(() => {
    if (state !== 'grace' || dueAt === null || !graceNoticeOn()) return;
    if (read(SENT) === String(dueAt)) return;
    write(SENT, String(dueAt));
    new Notification('Your candle gutters', {
      body: 'A check-in was missed. One tap on the vigil relights it before your witnesses are asked.',
      tag: 'dms-grace',
    });
  }, [state, dueAt]);
}
