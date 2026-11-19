/**
 * The demo guide: a dismissible banner on the demo vigil that says what to try next, and a
 * pulse on the Time machine toggle until it is first opened. Per-browser convenience state
 * only, so every storage access is guarded and the app works without it.
 */
import { useEffect, useState } from 'react';
import type { SwitchState } from '../../core/types';

const TOUR_KEY = 'dms.tour';
const OPENED_KEY = 'dms.tm.opened';
const EVENT = 'dms:tour';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the guide simply does not persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

export const tour = {
  start: () => {
    write(TOUR_KEY, 'on');
    write(OPENED_KEY, null);
  },
  end: () => write(TOUR_KEY, null),
  markOpened: () => write(OPENED_KEY, '1'),
};

/** Whether the guide is on, and whether the Time machine has been opened yet. */
export function useTour(): { on: boolean; opened: boolean } {
  const get = () => ({ on: read(TOUR_KEY) === 'on', opened: read(OPENED_KEY) === '1' });
  const [state, setState] = useState(get);
  useEffect(() => {
    const on = () => setState(get());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return state;
}

/** What to try next on the demo vigil, at each stage, naming the demo's own witness and reader. */
export function nextStep(state: SwitchState, witness: string, reader: string): string {
  switch (state) {
    case 'alive':
      return 'Open the Time machine (the hourglass, bottom right) and press +30 days to skip a missed check-in.';
    case 'reminder':
      return 'Press +30 days in the Time machine to let the check-in pass.';
    case 'grace':
      return 'The flame gutters and the room dims. Press +7 days to let the candle go out, or press the seal to relight it.';
    case 'confirm':
      return `The witnesses are asked. In the outbox, open “Witness asked” for ${witness} and confirm.`;
    case 'released':
      return `In the outbox, open “Letter released” for ${reader} and break the seal.`;
    case 'paused':
      return 'Lift the glass to resume the vigil.';
  }
}
