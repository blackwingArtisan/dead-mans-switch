/** Use-cases: load a vault, apply a change, save it, then deliver the resulting mail. */
import { keepsakeTagOf } from '../core/crypto';
import { randomId, randomToken, sha256 } from '../core/encoding';
import { step, SwitchError, type EmailEffect, type Effect, type MachineContext, type MintedToken, type SwitchEvent } from '../core/machine';
import { EXPORT_FORMAT, type ExportedLetter, type SealedExport } from '../core/export';
import { lastCandleOf, nextEventAt } from '../core/time';
import type { Custody, Letter, Person, SealedLetter, Vault } from '../core/types';
import {
  candlesOf,
  cleanCandleLine,
  cleanPerson,
  cleanSettings,
  MAX_CIPHERTEXT,
  MAX_LETTERS,
  MAX_WITNESSES,
  newVault,
  ValidationError,
  viewOf,
  type VaultView,
} from '../core/vault';
import { CHECK_IN_TEMPLATES, renderEmail } from './emails';
import { StoreConflictError, type Clock, type Mailer, type TokenKind, type VaultStore } from './ports';

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 410,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ServiceDeps {
  store: VaultStore;
  mailer: Mailer;
  clock: Clock;
  /** Public origin used in email links, e.g. https://switch.example.com */
  baseUrl: string;
}

type Mutation<T> = (vault: Vault, ctx: MachineContext) => { vault: Vault; effects?: Effect[]; result: T };

const B64U = /^[A-Za-z0-9_-]+$/;
/** Older check-in links beyond this many are dropped, newest kept. */
const MAX_CHECK_IN_LINKS = 6;
/** How many times a change is tried when the store reports a conflicting write (AWS Req 4.1). */
export const MAX_SAVE_ATTEMPTS = 3;
const LETTER_ID = /^[A-Za-z0-9_-]{8,32}$/;

export class SwitchService {
  /** The tail of each vault's queue of changes; see `exclusive`. */
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly deps: ServiceDeps) {}

  now(): number {
    return this.deps.clock.now();
  }

  // ── author ──────────────────────────────────────────────

  async createVault(input: { author?: unknown; settings?: unknown }): Promise<{ ownerToken: string; vault: VaultView }> {
    const author = cleanPerson(input.author, 'author');
    const settings = cleanSettings(input.settings);
    const ownerToken = randomToken();
    const vault = newVault({ id: randomId(), ownerTokenHash: await sha256(ownerToken), author, settings, now: this.now() });
    await this.deps.store.put(vault);
    return { ownerToken, vault: viewOf(vault, this.now()) };
  }

  async vaultIdForOwner(ownerToken: string | undefined): Promise<string> {
    return this.idForToken('owner', ownerToken, 401, 'Your vault key was not recognised. Open the vault from the device you created it on.');
  }

  async view(vaultId: string): Promise<VaultView> {
    return this.transact(vaultId, (vault) => ({ vault, result: viewOf(vault, this.now()) }));
  }

  async event(vaultId: string, event: SwitchEvent): Promise<VaultView> {
    return this.transact(vaultId, (vault, ctx) => {
      const r = step(vault, event, ctx);
      return { vault: r.vault, effects: r.effects, result: viewOf(r.vault, ctx.now) };
    });
  }

  async updateSettings(vaultId: string, input: unknown): Promise<VaultView> {
    return this.transact(vaultId, (vault, ctx) => {
      editable(vault);
      vault.settings = cleanSettings(input, vault.settings);
      vault.history.push({ at: ctx.now, kind: 'settings', note: 'The vigil settings changed.' });
      const r = step(vault, { type: 'tick' }, ctx);
      return { vault: r.vault, effects: r.effects, result: viewOf(r.vault, ctx.now) };
    });
  }

  async addWitness(vaultId: string, input: unknown): Promise<VaultView> {
    const p = cleanPerson(input, 'witness');
    return this.transact(vaultId, (vault, ctx) => {
      editable(vault);
      if (vault.witnesses.length >= MAX_WITNESSES) throw new ValidationError(`A vigil can have up to ${MAX_WITNESSES} witnesses.`);
      if (vault.witnesses.some((w) => w.email === p.email)) throw new ValidationError('That witness is already named.');
      if (p.email === vault.author.email) throw new ValidationError('You cannot be your own witness.');
      vault.witnesses.push({ id: randomId(), ...p, tokenHash: null, response: 'pending', respondedAt: null, addedAt: ctx.now });
      vault.history.push({ at: ctx.now, kind: 'witness-added', note: `${p.name} was named a witness.` });
      const named: EmailEffect = {
        template: 'witness-named',
        to: p,
        authorName: vault.author.name,
        witnessesRequired: vault.settings.witnessesRequired,
      };
      return { vault, effects: [{ type: 'email', vaultId: vault.id, ...named }], result: viewOf(vault, ctx.now) };
    });
  }

  async removeWitness(vaultId: string, witnessId: string): Promise<VaultView> {
    return this.transact(vaultId, (vault, ctx) => {
      editable(vault);
      const w = vault.witnesses.find((x) => x.id === witnessId);
      if (!w) throw new HttpError(404, 'That witness is not on the list.');
      vault.witnesses = vault.witnesses.filter((x) => x.id !== witnessId);
      vault.history.push({ at: ctx.now, kind: 'witness-removed', note: `${w.name} is no longer a witness.` });
      const r = step(vault, { type: 'tick' }, ctx);
      return { vault: r.vault, effects: r.effects, result: viewOf(r.vault, ctx.now) };
    });
  }

  async addLetter(vaultId: string, input: unknown): Promise<VaultView> {
    const body = (input ?? {}) as {
      id?: unknown;
      recipient?: unknown;
      custody?: unknown;
      sealed?: Partial<Record<keyof SealedLetter, unknown>>;
      keepsakeHalf?: unknown;
    };
    const id = typeof body.id === 'string' && LETTER_ID.test(body.id) ? body.id : null;
    if (!id) throw new ValidationError('The letter needs an id made in the browser.');
    const recipient = cleanPerson(body.recipient, 'recipient');
    const custody: Custody = body.custody === 'vault' ? 'vault' : 'keepsake';
    const s = body.sealed ?? {};
    const field = (v: unknown, name: string, len?: number, max = 200) => {
      if (typeof v !== 'string' || !B64U.test(v) || (len !== undefined && v.length !== len) || v.length > max) {
        throw new ValidationError(`The sealed letter is malformed (${name}).`);
      }
      return v;
    };
    const sealed: SealedLetter = {
      ciphertext: field(s.ciphertext, 'ciphertext', undefined, MAX_CIPHERTEXT),
      iv: field(s.iv, 'iv', 16),
      vaultHalf: field(s.vaultHalf, 'vault half', 43),
      keepsakeTag: field(s.keepsakeTag, 'keepsake tag', 43),
    };
    if (custody === 'vault') {
      const half = field(body.keepsakeHalf, 'keepsake half', 43);
      if ((await keepsakeTagOf(half)) !== sealed.keepsakeTag) throw new ValidationError('The keepsake half does not match its tag.');
      sealed.keepsakeHalf = half;
    } else if (body.keepsakeHalf !== undefined) {
      throw new ValidationError('In keepsake custody the keepsake half must stay with the recipient.');
    }
    return this.transact(vaultId, (vault, ctx) => {
      editable(vault);
      if (vault.letters.length >= MAX_LETTERS) throw new ValidationError(`A vault holds up to ${MAX_LETTERS} letters.`);
      if (vault.letters.some((l) => l.id === id)) throw new ValidationError('A letter with this id already exists.');
      const letter: Letter = {
        id,
        recipient,
        custody,
        sealedAt: ctx.now,
        sealed,
        openTokenHash: null,
        releasedAt: null,
        openedAt: null,
      };
      vault.letters.push(letter);
      vault.history.push({ at: ctx.now, kind: 'letter-sealed', note: `A letter to ${recipient.name} was sealed (${custody} custody).` });
      return { vault, result: viewOf(vault, ctx.now) };
    });
  }

  /** Every unopened letter as the vault holds it, for the author to keep (see core/export.ts). */
  async exportSealed(vaultId: string): Promise<SealedExport> {
    const vault = await this.mustGet(vaultId);
    const letters: ExportedLetter[] = [];
    for (const l of vault.letters) {
      if (!l.sealed) continue;
      letters.push({
        id: l.id,
        recipientName: l.recipient.name,
        custody: l.custody,
        sealedAt: l.sealedAt,
        releasedAt: l.releasedAt,
        ciphertext: l.sealed.ciphertext,
        iv: l.sealed.iv,
        vaultHalf: l.sealed.vaultHalf,
        keepsakeTag: l.sealed.keepsakeTag,
        ...(l.custody === 'vault' && l.sealed.keepsakeHalf ? { keepsakeHalf: l.sealed.keepsakeHalf } : {}),
      });
    }
    return { format: EXPORT_FORMAT, exportedAt: this.now(), authorName: vault.author.name, letters };
  }

  async burnLetter(vaultId: string, letterId: string): Promise<VaultView> {
    return this.transact(vaultId, (vault, ctx) => {
      editable(vault);
      const l = vault.letters.find((x) => x.id === letterId);
      if (!l) throw new HttpError(404, 'That letter is not in the vault.');
      vault.letters = vault.letters.filter((x) => x.id !== letterId);
      vault.history.push({ at: ctx.now, kind: 'letter-burned', note: `The letter to ${l.recipient.name} was burned.` });
      return { vault, result: viewOf(vault, ctx.now) };
    });
  }

  // ── witness ─────────────────────────────────────────────

  // ── one-tap check-in from an email ──────────────────────

  async checkInLinkInfo(token: string) {
    const { vaultId } = await this.lookup('checkin', token, CHECK_IN_LINK_SPENT);
    return this.transact(vaultId, (vault) => ({
      vault,
      result: { authorName: vault.author.name, state: vault.state, lastCheckInAt: vault.lastCheckInAt },
    }));
  }

  async checkInByLink(token: string) {
    const { vaultId } = await this.lookup('checkin', token, CHECK_IN_LINK_SPENT);
    return this.transact(vaultId, (vault, ctx) => {
      const r = step(vault, { type: 'checkIn' }, ctx);
      const view = viewOf(r.vault, ctx.now);
      return {
        vault: r.vault,
        effects: r.effects,
        result: { authorName: view.author.name, state: view.state, lastCheckInAt: view.lastCheckInAt, nextDueAt: view.schedule.dueAt },
      };
    });
  }

  async witnessInfo(token: string) {
    const { vaultId, hash } = await this.lookup('witness', token, 'This witness link has expired or was never valid.');
    return this.transact(vaultId, (vault) => {
      const w = vault.witnesses.find((x) => x.tokenHash === hash);
      if (!w) throw new HttpError(410, 'This witness link is no longer needed.');
      return {
        vault,
        result: {
          authorName: vault.author.name,
          witnessName: w.name,
          state: vault.state,
          lastCheckInAt: vault.lastCheckInAt,
          response: w.response,
          confirmations: vault.witnesses.filter((x) => x.response === 'confirmed').length,
          confirmationsRequired: Math.min(vault.settings.witnessesRequired, vault.witnesses.length),
        },
      };
    });
  }

  async witnessRespond(token: string, response: unknown, rawNote?: unknown) {
    if (response !== 'confirm' && response !== 'deny') throw new ValidationError('Answer "confirm" or "deny".');
    const note = cleanWitnessNote(rawNote);
    const { vaultId, hash } = await this.lookup('witness', token, 'This witness link has expired or was never valid.');
    return this.transact(vaultId, (vault, ctx) => {
      const w = vault.witnesses.find((x) => x.tokenHash === hash);
      if (!w) throw new HttpError(410, 'This witness link is no longer needed.');
      const r = step(vault, response === 'confirm' ? { type: 'witnessConfirm', witnessId: w.id } : { type: 'witnessDeny', witnessId: w.id, ...(note ? { note } : {}) }, ctx);
      return { vault: r.vault, effects: r.effects, result: { state: r.vault.state, response: response === 'confirm' ? 'confirmed' : 'denied' } };
    });
  }

  // ── recipient ───────────────────────────────────────────

  async openInfo(token: string) {
    const { vaultId, hash } = await this.lookup('open', token, 'This letter link is not valid.');
    const vault = await this.mustGet(vaultId);
    const l = vault.letters.find((x) => x.openTokenHash === hash);
    if (!l) throw new HttpError(404, 'This letter link is not valid.');
    return {
      letterId: l.id,
      authorName: vault.author.name,
      recipientName: l.recipient.name,
      custody: l.custody,
      sealedAt: l.sealedAt,
      releasedAt: l.releasedAt,
      openedAt: l.openedAt,
      opened: l.sealed === null,
      keepsakeTag: l.sealed?.keepsakeTag ?? null,
      // Only someone who has read their letter sees the candles the others left.
      candle: l.candle ?? null,
      candles: l.openedAt !== null ? candlesOf(vault) : [],
      // The author's own candle, as they last tended it: the recipient reads by it.
      lastCandle: lastCandleOf(vault),
    };
  }

  /** "A candle lit back": once their letter is read, a recipient may leave one line, once. */
  async lightCandle(token: string, input: unknown) {
    const line = cleanCandleLine(input);
    const { vaultId, hash } = await this.lookup('open', token, 'This letter link is not valid.');
    return this.transact(vaultId, (vault, ctx) => {
      const l = vault.letters.find((x) => x.openTokenHash === hash);
      if (!l) throw new HttpError(404, 'This letter link is not valid.');
      if (l.openedAt === null) throw new HttpError(409, 'Read the letter first; then you can light a candle back.');
      if (l.candle) throw new HttpError(409, 'You have already lit your candle. It stays lit.');
      l.candle = { line, at: ctx.now };
      vault.history.push({ at: ctx.now, kind: 'candle-lit', note: `${l.recipient.name} lit a candle back.` });
      // The witnesses and the other recipients hear of it by email: their links are spent by now.
      const to = [
        ...vault.witnesses.map((w) => ({ name: w.name, email: w.email })),
        ...vault.letters.filter((x) => x !== l && x.releasedAt !== null).map((x) => x.recipient),
      ].filter((p, i, all) => p.email !== l.recipient.email && all.findIndex((q) => q.email === p.email) === i);
      const effects: Effect[] = to.map((p) => ({
        type: 'email',
        vaultId: vault.id,
        template: 'candle-lit',
        to: p,
        authorName: vault.author.name,
        from: l.recipient.name,
        line,
      }));
      return { vault, effects, result: { candle: l.candle, candles: candlesOf(vault) } };
    });
  }

  /** Hands over the sealed copy exactly once, then forgets it. */
  async breakSeal(token: string) {
    const { vaultId, hash } = await this.lookup('open', token, 'This letter link is not valid.');
    return this.transact(vaultId, (vault, ctx) => {
      const l = vault.letters.find((x) => x.openTokenHash === hash);
      if (!l) throw new HttpError(404, 'This letter link is not valid.');
      if (!l.sealed) throw new HttpError(410, 'This seal has already been broken. The letter can only be opened once.');
      const { ciphertext, iv, vaultHalf } = l.sealed;
      l.sealed = null;
      l.openedAt = ctx.now;
      vault.history.push({ at: ctx.now, kind: 'letter-opened', note: `${l.recipient.name} opened their letter.` });
      return { vault, result: { letterId: l.id, ciphertext, iv, vaultHalf } };
    });
  }

  // ── scheduler ───────────────────────────────────────────

  async tickAll(): Promise<{ vaults: number; emails: number }> {
    let emails = 0;
    const ids = await this.deps.store.listIds();
    for (const id of ids) {
      const out = await this.run(id, (vault) => ({ vault, result: null }));
      emails += out.effects.length;
    }
    return { vaults: ids.length, emails };
  }

  async nextEventAt(): Promise<number | null> {
    const now = this.now();
    let next: number | null = null;
    for (const id of await this.deps.store.listIds()) {
      const v = await this.deps.store.get(id);
      const t = v ? nextEventAt(v, now) : null;
      if (t !== null && (next === null || t < next)) next = t;
    }
    return next;
  }

  // ── internals ───────────────────────────────────────────

  private async idForToken(kind: TokenKind, token: string | undefined, status: 401 | 404, message: string): Promise<string> {
    if (!token || token.length > 100 || !B64U.test(token)) throw new HttpError(status, message);
    const id = await this.deps.store.findByToken(kind, await sha256(token));
    if (!id) throw new HttpError(status, message);
    return id;
  }

  private async lookup(kind: TokenKind, token: string, message: string): Promise<{ vaultId: string; hash: string }> {
    const vaultId = await this.idForToken(kind, token, 404, message);
    return { vaultId, hash: await sha256(token) };
  }

  private async mustGet(id: string): Promise<Vault> {
    const v = await this.deps.store.get(id);
    if (!v) throw new HttpError(404, 'That vault does not exist.');
    return v;
  }

  /**
   * Loads the vault, brings it up to date with a tick, applies the mutation,
   * saves, then sends mail. Mail failures are recorded on the vault, never thrown.
   */
  private async transact<T>(vaultId: string, mutate: Mutation<T>): Promise<T> {
    return (await this.run(vaultId, mutate)).result;
  }

  /**
   * Runs one change to a vault at a time, in arrival order. Without this, the background tick could
   * load a vault, yield while it hashes tokens, and save its older copy over a letter or witness
   * that a request added in between. The queue is per process: the Node server has one, and the
   * Worker's scheduled tick runs in its own invocation.
   */
  private async exclusive<T>(vaultId: string, work: () => Promise<T>): Promise<T> {
    const before = this.queues.get(vaultId) ?? Promise.resolve();
    const mine = before.then(work, work);
    const tail = mine.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(vaultId, tail);
    try {
      return await mine;
    } finally {
      if (this.queues.get(vaultId) === tail) this.queues.delete(vaultId);
    }
  }

  private async run<T>(vaultId: string, mutate: Mutation<T>): Promise<{ result: T; effects: Effect[] }> {
    return this.exclusive(vaultId, () => this.runNow(vaultId, mutate));
  }

  /**
   * Saves can lose a race on a store that checks versions (DynamoDB). The losing attempt sent no
   * mail, so it is discarded whole: re-read, re-apply the same change and save again.
   */
  private async runNow<T>(vaultId: string, mutate: Mutation<T>): Promise<{ result: T; effects: Effect[] }> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.runOnce(vaultId, mutate);
      } catch (err) {
        if (!(err instanceof StoreConflictError)) throw err;
        if (attempt >= MAX_SAVE_ATTEMPTS) {
          throw new HttpError(409, 'This vigil was changed by someone else at the same moment. Please try again.');
        }
      }
    }
  }

  private async runOnce<T>(vaultId: string, mutate: Mutation<T>): Promise<{ result: T; effects: Effect[] }> {
    const loaded = await this.mustGet(vaultId);
    const cycle = loaded.cycle;
    const ctx: MachineContext = { now: this.now(), mint: await tokenPool(loaded.witnesses.length + loaded.letters.length + 4) };
    const ticked = step(loaded, { type: 'tick' }, ctx);
    const out = mutate(ticked.vault, ctx);
    const effects = [...ticked.effects, ...(out.effects ?? [])];
    const outgoing = await this.withCheckInLinks(out.vault, cycle, effects);
    await this.deps.store.put(out.vault);
    await this.deliver(out.vault.id, outgoing);
    return { result: out.result, effects };
  }

  /**
   * A check-in spends every link from the cycle before it. Each email to the author that asks
   * them to check in gets a fresh one-tap link, stored only as a hash.
   */
  private async withCheckInLinks(vault: Vault, cycleBefore: number, effects: Effect[]): Promise<OutgoingEmail[]> {
    if (vault.cycle !== cycleBefore || vault.state === 'released') vault.checkInTokenHashes = [];
    const out: OutgoingEmail[] = [];
    for (const e of effects) {
      if (vault.state !== 'released' && CHECK_IN_TEMPLATES.has(e.template) && e.to.email === vault.author.email) {
        const token = randomToken();
        vault.checkInTokenHashes = [...(vault.checkInTokenHashes ?? []), await sha256(token)].slice(-MAX_CHECK_IN_LINKS);
        out.push({ ...e, checkInToken: token });
      } else {
        out.push(e);
      }
    }
    return out;
  }

  private async deliver(vaultId: string, effects: OutgoingEmail[]): Promise<void> {
    const failures: string[] = [];
    for (const e of effects) {
      try {
        await this.deps.mailer.send(renderEmail(e, this.deps.baseUrl));
      } catch (err) {
        failures.push(`${e.template} to ${e.to.email}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }
    if (failures.length) {
      for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt++) {
        const v = await this.deps.store.get(vaultId);
        if (!v) return;
        for (const f of failures) v.history.push({ at: this.now(), kind: 'mail-failed', note: `Mail failed (${f}).` });
        try {
          await this.deps.store.put(v);
          return;
        } catch (err) {
          if (!(err instanceof StoreConflictError)) throw err;
        }
      }
    }
  }
}

type OutgoingEmail = Effect & { checkInToken?: string };

const CHECK_IN_LINK_SPENT = 'This check-in link has been used or has expired. Open your vigil on your own device to check in.';

export const MAX_WITNESS_NOTE = 200;

/** A witness's optional note to the author: text only, trimmed, at most 200 characters; blank means none. */
function cleanWitnessNote(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string' || raw.trim().length > MAX_WITNESS_NOTE) {
    throw new ValidationError(`A note must be text of at most ${MAX_WITNESS_NOTE} characters.`);
  }
  return raw.trim() || undefined;
}

function editable(vault: Vault): void {
  if (vault.state === 'released') {
    throw new SwitchError('These letters have already been released. A released vigil cannot be changed.', 'released');
  }
}

/** Pre-computes token/hash pairs so the pure machine can mint synchronously. */
async function tokenPool(size: number): Promise<() => MintedToken> {
  const pool: MintedToken[] = [];
  for (let i = 0; i < size; i++) {
    const token = randomToken();
    pool.push({ token, hash: await sha256(token) });
  }
  return () => {
    const next = pool.pop();
    if (!next) throw new Error('Token pool exhausted.');
    return next;
  };
}

export type { Person };
