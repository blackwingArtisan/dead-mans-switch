/**
 * The room follows the candle. The vigil sets `data-room` on <body> to its state, and the
 * stylesheet dims the glow, slows or stops the embers, brings in smoke or moonlight and
 * shifts the palette. A check-in sets `data-relight` for a moment to play the match strike.
 */
import { useEffect } from 'react';
import type { SwitchState } from '../../core/types';
import { sound } from './sound';

export type Room = SwitchState;

export const RELIGHT_MS = 900;

/** One short line per room, announced to screen readers alongside the state change. */
export const ROOM_LINE: Record<Room, string> = {
  alive: 'The room is warm again.',
  reminder: 'The room is a little dimmer.',
  grace: 'The room dims and the embers slow.',
  confirm: 'The room has gone dark and smoke hangs in the air.',
  released: 'Moonlight fills the empty room.',
  paused: 'The room is still, under glass.',
};

export function setRoom(room: Room | null): void {
  if (room) document.body.dataset.room = room;
  else delete document.body.dataset.room;
  sound.room(room);
}

/** Keeps <body data-room> in step with the vigil while it is on screen. */
export function useRoom(room: Room | null): void {
  useEffect(() => {
    setRoom(room);
  }, [room]);
  useEffect(() => () => setRoom(null), []);
}

let relightTimer: number | undefined;

/** Plays the match-strike relight once. Under reduced motion the stylesheet makes it instant. */
export function relight(): void {
  window.clearTimeout(relightTimer);
  delete document.body.dataset.relight;
  // Force a style flush so a second check-in replays the animation.
  void document.body.offsetWidth;
  document.body.dataset.relight = '';
  sound.strike();
  relightTimer = window.setTimeout(() => delete document.body.dataset.relight, RELIGHT_MS + 100);
}
