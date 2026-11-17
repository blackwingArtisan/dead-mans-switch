/** The three ports every deployment fills: time, storage and mail. */
import type { Vault } from '../core/types';

export interface Clock {
  now(): number;
}

/** A clock the demo can move forward. Only wired up when dev tools are on. */
export interface AdjustableClock extends Clock {
  advance(ms: number): void;
  set(at: number): void;
  reset(): void;
  offset(): number;
}

export type TokenKind = 'owner' | 'witness' | 'open';

export interface VaultStore {
  get(id: string): Promise<Vault | null>;
  /** Saves the vault and keeps the token index in step with it. */
  put(vault: Vault): Promise<void>;
  /** Looks up the vault that owns a token, by the token's SHA-256 hash. */
  findByToken(kind: TokenKind, hash: string): Promise<string | null>;
  listIds(): Promise<string[]>;
}

export interface MailMessage {
  to: { name: string; email: string };
  subject: string;
  text: string;
  html: string;
  /** Template name, for logs and the demo outbox. */
  kind: string;
  vaultId: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Every token key a vault currently owns, used to maintain store indexes. */
export function tokenKeys(vault: Vault): { kind: TokenKind; hash: string }[] {
  const keys: { kind: TokenKind; hash: string }[] = [{ kind: 'owner', hash: vault.ownerTokenHash }];
  for (const w of vault.witnesses) if (w.tokenHash) keys.push({ kind: 'witness', hash: w.tokenHash });
  for (const l of vault.letters) if (l.openTokenHash) keys.push({ kind: 'open', hash: l.openTokenHash });
  return keys;
}
