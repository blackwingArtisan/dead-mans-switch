/**
 * "Play the whole story": a captioned, hands-off run of the demo. It runs for STORY_SECONDS (see below: the sum of the HOLD pauses,
 * plus the page loads and clicks, measured at normal pace). It needs
 * the local time machine, so it only appears when the server runs with dev tools. It drives the
 * real app (the same routes, buttons and API a person would use), which also makes it a clean
 * take for a demo video. `?story-pace=0.2` in the URL plays it five times faster (used by tests and the media script).
 */
import { useEffect, useState } from 'react';
import { api, ApiError, failedRequestCount, local, requestRefresh, session } from './api';
import { navigate } from './router';
import { DEMO, sealAndStore } from './seal';
import { STATIC_DEMO_KEY } from './static-demo-key';
import { tour } from './tour';

export interface StoryState {
  playing: boolean;
  caption: string;
  step: number;
  steps: number;
  /** True when a call to the demo failed and the story stopped; the captions then offer a reset or a replay. */
  failed: boolean;
}

const EVENT = 'dms:story';
const IDLE: StoryState = { playing: false, caption: '', step: 0, steps: 0, failed: false };
export const STORY_FAILED = 'The demo stopped responding.';
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
/** A request to the demo failed while the story played. */
class DemoDown extends Error {}

let failuresAtStart = 0;

/** Throws as soon as the story is stopped or any request (the story's own or a page's) has failed since it began. */
function checkpoint(): void {
  if (stopRequested) throw new Stopped();
  if (failedRequestCount() !== failuresAtStart) throw new DemoDown();
}

function readPace(): number {
  const p = Number(new URLSearchParams(window.location.search).get('story-pace'));
  return p > 0 && p <= 1 ? p : 1;
}

const pace = () => currentPace;

async function wait(ms: number): Promise<void> {
  const end = Date.now() + ms * pace();
  while (Date.now() < end) {
    checkpoint();
    await new Promise((r) => setTimeout(r, Math.min(100, end - Date.now())));
  }
}

async function until<T>(find: () => T | null | undefined, timeoutMs = 8000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    checkpoint();
    const found = find();
    if (found) return found;
    if (Date.now() > end) throw new Error('The story lost its place. Reset the demo and try again.');
    await new Promise((r) => setTimeout(r, 80));
  }
}

const byTestId = (id: string) => () => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/** Types into a React-controlled input the way a keyboard would: one character, one input event. */
async function typeInto(input: HTMLInputElement, text: string, perCharMs: number): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  input.focus();
  for (let i = 1; i <= text.length; i++) {
    setValue.call(input, text.slice(0, i));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(perCharMs);
  }
}

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
    checkpoint();
    const t = i / frames;
    const row = Math.min(rows - 1, Math.floor(t * rows));
    const along = (t * rows) % 1;
    const x = box.left + box.width * (0.18 + 0.64 * (row % 2 === 0 ? along : 1 - along));
    const y = top + ((bottom - top) * (row + along * 0.5)) / rows;
    page.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  }
}

/** Types a line into "A candle lit back" and presses "Light a candle", then waits until `count` candles stand beside the author's. */
async function lightCandleBack(line: string, count: number): Promise<void> {
  const input = (await until(() => document.querySelector<HTMLInputElement>('#candle-line'))) as HTMLInputElement;
  input.scrollIntoView({ block: 'center' });
  await typeInto(input, line, NOTE_CHAR_MS);
  (await until(byTestId('light-candle'))).click();
  await until(byTestId('candle-mine'));
  await until(() => document.querySelectorAll('[data-testid="candle-beside"]').length >= count);
}

/** Brings the author's candle, and the candles lit beside it, into view: beside the letter on a wide screen, under it on a narrow one. */
async function showKeeper(): Promise<void> {
  const page = document.querySelector<HTMLElement>('[data-testid="letter-page"]');
  const keeper = document.querySelector<HTMLElement>('[data-testid="their-candle"]');
  const beside = page && keeper && keeper.getBoundingClientRect().right <= page.getBoundingClientRect().left;
  if (keeper && !beside) keeper.scrollIntoView({ block: 'center', behavior: 'smooth' });
  else if (page) window.scrollTo({ top: Math.max(0, page.getBoundingClientRect().top + window.scrollY - 24), behavior: 'smooth' });
  await new Promise((r) => setTimeout(r, 50));
}

/** The keepsake link of each keepsake-custody letter, by recipient. It stays in this browser; it is never sent anywhere. */
const keepsakeLinks = new Map<string, string>();

/** True in the static build (`npm run build:static`), where the whole API runs in this browser. */
const STATIC_BUILD = import.meta.env.VITE_STATIC_DEMO === '1';

const FALSE_ALARM_NOTE = 'Mara was hiking';
const NOTE_CHAR_MS = 45;
/** The line each recipient leaves with the candle they light back, in the story's last scene. */
const JUNE_CANDLE_LINE = 'Biscuit is fed.';
const THEO_CANDLE_LINE = 'I found the blue tin.';

/**
 * Every pause the story makes on purpose, in milliseconds at normal pace (`?story-pace` scales them). The label on the
 * button is checked against their sum by a unit test, and against a real run by an end-to-end test.
 */
const HOLD = {
  vigil: 5000,
  guttering: 6500,
  out: 6500,
  beforeNote: 700,
  note: FALSE_ALARM_NOTE.length * NOTE_CHAR_MS,
  beforeDeny: 600,
  afterDeny: 1400,
  beforeRelight: 1000,
  relit: 2400,
  secondGuttering: 1500,
  secondOut: 2500,
  beforeConfirm: 1800,
  afterConfirm: 3000,
  keepsakeCard: 3500,
  opened: 1500,
  reading: 7000,
  letterEnd: 3500,
  beforeJuneLine: 800,
  juneLine: JUNE_CANDLE_LINE.length * NOTE_CHAR_MS,
  juneCandle: 3000,
  theoOpened: 2500,
  theoLine: THEO_CANDLE_LINE.length * NOTE_CHAR_MS,
  theoCandle: 3000,
  endCard: 5500,
} as const;

export const STORY_HOLD_MS: number = Object.values(HOLD).reduce((sum, ms) => sum + ms, 0);

/** The running time on the button, in seconds at normal pace: measured end to end, rounded. Keep it true: tests compare it. */
export const STORY_SECONDS = 68;

const STEPS: { caption: string; run: () => Promise<void> }[] = [
  {
    caption: 'Mara keeps a vigil. Two sealed letters, two witnesses, and one tap a month keeps the candle lit.',
    run: async () => {
      await api.dev.reset();
      const r = await api.createVault(DEMO.author, { cadenceDays: 30, graceDays: 7, reminderLeadDays: 3, witnessesRequired: 1 });
      session.save(r.ownerToken);
      for (const w of DEMO.witnesses) await api.addWitness(w);
      keepsakeLinks.clear();
      for (const l of DEMO.letters) {
        const sealed = await sealAndStore({ ...l, authorName: DEMO.author.name });
        // Keepsake custody only: the link with half A in its fragment, for the card Mara hands over.
        if (l.custody === 'keepsake') keepsakeLinks.set(l.recipient.name, sealed.keepsakeLink);
      }
      tour.end();
      navigate('/');
      await until(byTestId('state-title'));
      await wait(HOLD.vigil);
    },
  },
  {
    caption: 'A month passes with no check-in. The flame gutters, the room dims, and a grace email goes out.',
    run: async () => {
      await api.dev.travel({ days: 30 });
      requestRefresh();
      await wait(HOLD.guttering);
    },
  },
  {
    caption: 'A week more. The candle goes out, and the whole room dies with it. Her witnesses are asked first.',
    run: async () => {
      await api.dev.travel({ days: 7 });
      requestRefresh();
      await wait(HOLD.out);
    },
  },
  {
    caption: 'False alarm. Silas knows Mara is out hiking, so he leaves her a note, “Mara was hiking”, and presses “Mara still lives”. Any one witness can stop a release.',
    run: async () => {
      const link = await linkFor('witness-ask', 'Silas Crane');
      navigate(link.pathname);
      const note = await until(byTestId('witness-note'));
      await wait(HOLD.beforeNote);
      await typeInto(note as HTMLInputElement, FALSE_ALARM_NOTE, NOTE_CHAR_MS);
      await wait(HOLD.beforeDeny);
      (await until(byTestId('witness-deny'))).click();
      await until(byTestId('witness-done'));
      await wait(HOLD.afterDeny);
    },
  },
  {
    caption: 'The release stops and a new grace period begins. Mara sees the note and taps “I still walk among the living”. The candle relights.',
    run: async () => {
      navigate('/');
      const checkIn = await until(byTestId('check-in'));
      await wait(HOLD.beforeRelight);
      checkIn.click();
      await wait(HOLD.relit);
    },
  },
  {
    caption: 'Time moves on, and this time nobody taps. The candle goes out a second time.',
    run: async () => {
      await api.dev.travel({ days: 30 });
      requestRefresh();
      await wait(HOLD.secondGuttering);
      await api.dev.travel({ days: 7 });
      requestRefresh();
      await wait(HOLD.secondOut);
    },
  },
  {
    caption: 'Silas is asked again. This time he confirms. A lost phone could never get this far: any witness can stop it.',
    run: async () => {
      const link = await linkFor('witness-ask', 'Silas Crane');
      navigate(link.pathname);
      (await until(byTestId('witness-confirm'))).click();
      await wait(HOLD.beforeConfirm);
      (await until(byTestId('witness-confirm-final'))).click();
      await until(byTestId('witness-done'));
      await wait(HOLD.afterConfirm);
    },
  },
  {
    caption: 'Mara handed June a keepsake long ago: half of a key, printed on a card. June brings it. Half a key opens nothing, and the vault never held it.',
    run: async () => {
      const link = keepsakeLinks.get('June Okafor');
      if (!link) throw new Error('The story lost its place. Reset the demo and try again.');
      const url = new URL(link);
      navigate(url.pathname + url.hash);
      const code = await until(byTestId('keepsake-code'));
      code.scrollIntoView({ block: 'center' });
      await wait(HOLD.keepsakeCard);
    },
  },
  {
    caption: 'June receives a one-time link. Her keepsake is found on this device, the letter is decrypted in her browser, and the vault forgets its copy.',
    run: async () => {
      const link = await linkFor('release', 'June Okafor');
      navigate(link.pathname + link.hash);
      // The keepsake page remembered half A, so the open page finds it: the link itself carries no key.
      await until(byTestId('keepsake-ready'));
      (await until(byTestId('break-seal'))).click();
      await until(byTestId('letter-page'));
      await wait(HOLD.opened);
    },
  },
  {
    caption: 'She reads it by her last candle.',
    run: async () => {
      // The room lights itself after eight seconds in the dark; the hand moves for seven.
      await readByCandle(HOLD.reading);
    },
  },
  {
    caption: 'June reads by Mara’s own candle, just as Mara left it. Their candle, your light. Some words should wait.',
    run: async () => {
      // End on the whole letter in full light, signature and all, not on a dark page.
      // Under reduced motion the letter is already fully lit and there is no button to press.
      const lit = () => document.querySelector<HTMLElement>('.letter__page--lit');
      const next = await until(() => lit() ?? byTestId('light-room')());
      if (!lit()) next.click();
      await until(lit);
      await showKeeper();
      await wait(HOLD.letterEnd);
    },
  },
  {
    caption: 'June lights a candle back, with one line for the others: “Biscuit is fed.” It stands beside Mara’s.',
    run: async () => {
      await wait(HOLD.beforeJuneLine);
      await lightCandleBack(JUNE_CANDLE_LINE, 1);
      await showKeeper();
      await wait(HOLD.juneCandle);
    },
  },
  {
    caption: 'Theo has his own one-time link, and his key travels inside it. He opens his letter too, and reads it in full light.',
    run: async () => {
      const link = await linkFor('release', 'Theo Whitlock');
      navigate(link.pathname + link.hash);
      await until(byTestId('keepsake-ready'));
      (await until(byTestId('break-seal'))).click();
      await until(byTestId('letter-page'));
      // Under reduced motion the letter is already lit and there is no button to press.
      const lit = () => document.querySelector<HTMLElement>('.letter__page--lit');
      const next = await until(() => lit() ?? byTestId('light-room')());
      if (!lit()) next.click();
      await until(lit);
      await wait(HOLD.theoOpened);
    },
  },
  {
    caption: 'Theo lights one back: “I found the blue tin.” A second candle stands beside Mara’s.',
    run: async () => {
      await lightCandleBack(THEO_CANDLE_LINE, 2);
      await showKeeper();
      await wait(HOLD.theoCandle);
    },
  },
  {
    caption: 'One went out. Two were lit.',
    run: async () => {
      await showKeeper();
      await wait(HOLD.endCard);
    },
  },
];

/** Plays the story. `samePace` replays at the pace of the last run (the page address no longer carries `?story-pace`). */
export async function playStory(samePace = false): Promise<void> {
  if (state.playing) return;
  stopRequested = false;
  currentPace = samePace ? currentPace : readPace();
  failuresAtStart = failedRequestCount();
  emit({ playing: true, step: 0, steps: STEPS.length, caption: '', failed: false });
  try {
    for (const [i, step] of STEPS.entries()) {
      emit({ step: i + 1, caption: step.caption });
      await step.run();
    }
    // The last caption stays on screen as an end card until it is closed.
    emit({ ...IDLE, caption: STEPS[STEPS.length - 1]!.caption });
  } catch (err) {
    if (err instanceof Stopped) emit({ ...IDLE });
    // A call to the demo failed: say so plainly and offer a way out, instead of leaving the story half-played.
    else if (err instanceof DemoDown || err instanceof ApiError) emit({ ...IDLE, failed: true, caption: STORY_FAILED });
    else emit({ ...IDLE, caption: err instanceof Error ? err.message : 'The story stopped.' });
  }
}

/**
 * Puts the demo back to empty. The dev reset route does it when it answers (the Node server, and the static build's
 * in-browser server). When it does not, the static demo's stored state is cleared, which is all a static demo has.
 * Either way this browser forgets its owner key. Says what happened in the caption.
 */
export async function resetDemo(): Promise<void> {
  let answered = true;
  try {
    await api.dev.reset();
  } catch {
    answered = false;
    local.remove(STATIC_DEMO_KEY);
  }
  if (!answered && !STATIC_BUILD) {
    // A stopped Node server cannot be reset from the page; say so, and leave the buttons for another try.
    emit({ ...IDLE, failed: true, caption: 'The demo is not answering, so it could not be reset. Start it again, then choose Reset the demo or Play it again.' });
    return;
  }
  session.clear();
  tour.end();
  keepsakeLinks.clear();
  navigate('/');
  emit({ ...IDLE, caption: 'The demo was reset. Play the whole story whenever you like.' });
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
