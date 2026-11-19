/**
 * "Play the whole story": a captioned, hands-off run of the demo, about 40 seconds long. It needs
 * the local time machine, so it only appears when the server runs with dev tools. It drives the
 * real app (the same routes, buttons and API a person would use), which also makes it a clean
 * take for a demo video. `?story-pace=0.2` in the URL plays it five times faster (used by tests and the media script).
 */
import { useEffect, useState } from 'react';
import { api, requestRefresh, session } from './api';
import { navigate } from './router';
import { DEMO, sealAndStore } from './seal';
import { tour } from './tour';

export interface StoryState {
  playing: boolean;
  caption: string;
  step: number;
  steps: number;
}

const EVENT = 'dms:story';
const IDLE: StoryState = { playing: false, caption: '', step: 0, steps: 0 };
let state: StoryState = IDLE;
let stopRequested = false;
let currentPace = 1;

function emit(next: Partial<StoryState>): void {
  state = { ...state, ...next };
  window.dispatchEvent(new Event(EVENT));
}

export function useStory(): StoryState {
  const [s, setS] = useState(state);
  useEffect(() => {
    const on = () => setS(state);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return s;
}

class Stopped extends Error {}

function readPace(): number {
  const p = Number(new URLSearchParams(window.location.search).get('story-pace'));
  return p > 0 && p <= 1 ? p : 1;
}

const pace = () => currentPace;

async function wait(ms: number): Promise<void> {
  const end = Date.now() + ms * pace();
  while (Date.now() < end) {
    if (stopRequested) throw new Stopped();
    await new Promise((r) => setTimeout(r, Math.min(100, end - Date.now())));
  }
}

async function until<T>(find: () => T | null | undefined, timeoutMs = 8000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (stopRequested) throw new Stopped();
    const found = find();
    if (found) return found;
    if (Date.now() > end) throw new Error('The story lost its place. Reset the demo and try again.');
    await new Promise((r) => setTimeout(r, 80));
  }
}

const byTestId = (id: string) => () => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function linkFor(kind: string, name: string): Promise<URL> {
  const { messages } = await api.dev.outbox();
  const msg = messages.find((m) => m.kind === kind && m.to.name === name);
  const href = msg?.text.match(/https?:\/\/\S+/)?.[0];
  if (!href) throw new Error(`No ${kind} email for ${name} yet.`);
  return new URL(href);
}

/** Moves the reader's candlelight across the letter, line by line, like a hand would. */
async function readByCandle(ms: number): Promise<void> {
  const page = await until(byTestId('letter-page'));
  window.scrollTo({ top: Math.max(0, page.getBoundingClientRect().top + window.scrollY - 24) });
  await new Promise((r) => setTimeout(r, 50));
  const box = page.getBoundingClientRect();
  // Keep the light on the part of the page that is on screen and clear of the caption.
  const top = Math.max(box.top, 0) + 70;
  const bottom = Math.min(box.bottom, window.innerHeight - 150);
  const rows = 4;
  const frames = Math.max(10, Math.round((ms * pace()) / 60));
  for (let i = 0; i <= frames; i++) {
    if (stopRequested) throw new Stopped();
    const t = i / frames;
    const row = Math.min(rows - 1, Math.floor(t * rows));
    const along = (t * rows) % 1;
    const x = box.left + box.width * (0.18 + 0.64 * (row % 2 === 0 ? along : 1 - along));
    const y = top + ((bottom - top) * (row + along * 0.5)) / rows;
    page.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  }
}

const STEPS: { caption: string; run: () => Promise<void> }[] = [
  {
    caption: 'Mara keeps a vigil. Two sealed letters, two witnesses, and one tap a month keeps the candle lit.',
    run: async () => {
      await api.dev.reset();
      const r = await api.createVault(DEMO.author, { cadenceDays: 30, graceDays: 7, reminderLeadDays: 3, witnessesRequired: 1 });
      session.save(r.ownerToken);
      for (const w of DEMO.witnesses) await api.addWitness(w);
      for (const l of DEMO.letters) await sealAndStore({ ...l, authorName: DEMO.author.name });
      tour.end();
      navigate('/');
      await until(byTestId('state-title'));
      await wait(5000);
    },
  },
  {
    caption: 'A month passes with no check-in. The flame gutters, the room dims, and a grace email goes out.',
    run: async () => {
      await api.dev.travel({ days: 30 });
      requestRefresh();
      await wait(6500);
    },
  },
  {
    caption: 'A week more. The candle goes out, and the whole room dies with it. Her witnesses are asked first.',
    run: async () => {
      await api.dev.travel({ days: 7 });
      requestRefresh();
      await wait(6500);
    },
  },
  {
    caption: 'Silas, her witness, confirms. A lost phone could never get this far: any witness can stop it.',
    run: async () => {
      const link = await linkFor('witness-ask', 'Silas Crane');
      navigate(link.pathname);
      (await until(byTestId('witness-confirm'))).click();
      await wait(1800);
      (await until(byTestId('witness-confirm-final'))).click();
      await until(byTestId('witness-done'));
      await wait(3000);
    },
  },
  {
    caption: 'June receives a one-time link. The letter is decrypted in her browser, and the vault forgets its copy.',
    run: async () => {
      const link = await linkFor('release', 'June Okafor');
      navigate(link.pathname + link.hash);
      (await until(byTestId('break-seal'))).click();
      await until(byTestId('letter-page'));
      await wait(1500);
    },
  },
  {
    caption: 'She reads it by her last candle.',
    run: async () => {
      await readByCandle(9000);
    },
  },
  {
    caption: 'Some words should wait. Light a candle tonight.',
    run: async () => {
      await wait(4000);
    },
  },
];

export async function playStory(): Promise<void> {
  if (state.playing) return;
  stopRequested = false;
  currentPace = readPace();
  emit({ playing: true, step: 0, steps: STEPS.length, caption: '' });
  try {
    for (const [i, step] of STEPS.entries()) {
      emit({ step: i + 1, caption: step.caption });
      await step.run();
    }
    // The last caption stays on screen as an end card until it is closed.
    emit({ ...IDLE, caption: STEPS[STEPS.length - 1]!.caption });
  } catch (err) {
    if (err instanceof Stopped) emit({ ...IDLE });
    else emit({ ...IDLE, caption: err instanceof Error ? err.message : 'The story stopped.' });
  }
}

export function stopStory(): void {
  stopRequested = true;
  if (!state.playing) emit({ ...IDLE });
}

/** True when the server has the time machine, which the story needs. */
export function useStoryAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    api.health().then(
      (h) => setOk(h.dev),
      () => setOk(false),
    );
  }, []);
  return ok;
}
