/**
 * The room's sound, generated with Web Audio (no recordings, so no asset licences and no network).
 * Muted by default: nothing is created until the visitor turns sound on, which is also the user
 * gesture browsers need before audio may start. The choice is remembered per browser.
 *
 * Each room has a bed:
 * - alive and reminder: a wick crackling now and then
 * - grace: a thin wind, with a dying hiss from the wick
 * - confirm (the candle is out): near silence and a slow, faint heartbeat
 * - released and paused: silence
 * and a few moments have a one-shot: a match strike on check-in, wax cracking when a seal breaks.
 */
import { useEffect, useState } from 'react';
import type { SwitchState } from '../../core/types';

const KEY = 'dms.sound';
const EVENT = 'dms:sound';

export type Bed = 'crackle' | 'wind' | 'heartbeat' | 'silence';

/** Which sound bed plays in each room. Pure, so it is unit-tested. */
export function bedFor(room: SwitchState | null): Bed {
  switch (room) {
    case 'alive':
    case 'reminder':
      return 'crackle';
    case 'grace':
      return 'wind';
    case 'confirm':
      return 'heartbeat';
    default:
      return 'silence';
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let room: SwitchState | null = null;
let stopBed: (() => void) | null = null;

function storedOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

function audio(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return { ctx, out: master!, noise: noise! };
}

/** A short burst of filtered noise: the building block of crackles, hisses and strikes. */
function burst(at: number, length: number, gain: number, type: BiquadFilterType, freq: number): void {
  const a = audio();
  if (!a) return;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  const filter = a.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + Math.min(0.01, length / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(env).connect(a.out);
  src.start(at, Math.random() * 1.5, length + 0.05);
}

/** A low sine thump with a fast decay: one half of a heartbeat, or the body of cracking wax. */
function thump(at: number, freq: number, gain: number, length = 0.22): void {
  const a = audio();
  if (!a) return;
  const osc = a.ctx.createOscillator();
  osc.frequency.setValueAtTime(freq * 1.6, at);
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.05);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(a.out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

function every(ms: () => number, play: () => void): () => void {
  let timer = 0;
  const tick = () => {
    play();
    timer = window.setTimeout(tick, ms());
  };
  timer = window.setTimeout(tick, ms());
  return () => window.clearTimeout(timer);
}

function startBed(bed: Bed): () => void {
  const a = audio();
  if (!a || bed === 'silence') return () => undefined;
  if (bed === 'crackle') {
    return every(
      () => 180 + Math.random() * 900,
      () => {
        const t = a.ctx.currentTime;
        burst(t, 0.03 + Math.random() * 0.04, 0.12 + Math.random() * 0.12, 'bandpass', 1800 + Math.random() * 2400);
        if (Math.random() < 0.3) burst(t + 0.04, 0.02, 0.08, 'highpass', 3000);
      },
    );
  }
  if (bed === 'wind') {
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const filter = a.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.8;
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = a.ctx.createGain();
    depth.gain.value = 260;
    lfo.connect(depth).connect(filter.frequency);
    const level = a.ctx.createGain();
    level.gain.setValueAtTime(0, a.ctx.currentTime);
    level.gain.linearRampToValueAtTime(0.16, a.ctx.currentTime + 2);
    src.connect(filter).connect(level).connect(a.out);
    src.start();
    lfo.start();
    const hiss = every(
      () => 2600 + Math.random() * 3200,
      () => burst(a.ctx.currentTime, 0.7, 0.05, 'highpass', 5200),
    );
    return () => {
      hiss();
      level.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4);
      src.stop(a.ctx.currentTime + 1.5);
      lfo.stop(a.ctx.currentTime + 1.5);
    };
  }
  // heartbeat: lub-dub, slow and faint, in near silence
  return every(
    () => 1350,
    () => {
      const t = a.ctx.currentTime;
      thump(t, 52, 0.42);
      thump(t + 0.24, 46, 0.3);
    },
  );
}

function applyRoom(): void {
  stopBed?.();
  stopBed = null;
  if (!storedOn() || !ctx) return;
  stopBed = startBed(bedFor(room));
}

export const sound = {
  isOn: storedOn,
  /** Turns sound on or off. Turning it on must happen inside a click or key press. */
  set(on: boolean): void {
    try {
      if (on) window.localStorage.setItem(KEY, 'on');
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage can be blocked; sound then lasts for this page only.
    }
    if (on) {
      void audio()?.ctx.resume();
    } else {
      void ctx?.suspend();
    }
    applyRoom();
    window.dispatchEvent(new Event(EVENT));
  },
  /** Starts audio after a reload, on the first press, when sound was left on last time. */
  wake(): void {
    if (storedOn() && !ctx) sound.set(true);
  },
  /** Called by lib/room.ts whenever the room changes. */
  room(next: SwitchState | null): void {
    if (next === room) return;
    room = next;
    applyRoom();
  },
  /** The match strike that relights the candle. */
  strike(): void {
    if (!storedOn() || !ctx) return;
    const t = ctx.currentTime;
    burst(t, 0.09, 0.5, 'highpass', 2600);
    burst(t + 0.07, 0.35, 0.22, 'bandpass', 900);
    thump(t + 0.1, 120, 0.12, 0.3);
  },
  /** Wax cracking as a seal breaks. */
  crack(): void {
    if (!storedOn() || !ctx) return;
    const t = ctx.currentTime;
    burst(t, 0.03, 0.5, 'bandpass', 3200);
    burst(t + 0.05, 0.05, 0.35, 'bandpass', 2100);
    thump(t + 0.02, 80, 0.3, 0.18);
  },
};

/** Whether sound is on, kept in step with the toggle. */
export function useSoundOn(): boolean {
  const [on, setOn] = useState(storedOn);
  useEffect(() => {
    const update = () => setOn(storedOn());
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  return on;
}
