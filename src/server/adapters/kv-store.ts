/**
 * Workers KV implementation of VaultStore (production path; not exercised by tests).
 *
 * Keys:
 *   vault:<id>            the vault JSON
 *   tok:<kind>:<hash>     -> vault id
 *
 * KV is eventually consistent and has no transactions. That is acceptable here because
 * every write for a vault comes from the author, one witness link, one recipient link or
 * the cron tick, and each write is a full idempotent snapshot. A Durable Object per vault
 * is the upgrade path if concurrent writes ever matter.
 */
import type { Vault } from '../../core/types';
import { tokenKeys, type TokenKind, type VaultStore } from '../ports';

/** The subset of the KVNamespace API this store needs, so it type-checks without Workers types. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export class KvStore implements VaultStore {
  constructor(private readonly kv: KvLike) {}

  async get(id: string): Promise<Vault | null> {
    const raw = await this.kv.get(`vault:${id}`);
    return raw ? (JSON.parse(raw) as Vault) : null;
  }

  async put(vault: Vault): Promise<void> {
    const old = await this.get(vault.id);
    const next = new Set(tokenKeys(vault).map((k) => `tok:${k.kind}:${k.hash}`));
    const stale = old ? tokenKeys(old).map((k) => `tok:${k.kind}:${k.hash}`).filter((k) => !next.has(k)) : [];
    await this.kv.put(`vault:${vault.id}`, JSON.stringify(vault));
    await Promise.all([...next].map((k) => this.kv.put(k, vault.id)));
    await Promise.all(stale.map((k) => this.kv.delete(k)));
  }

  async findByToken(kind: TokenKind, hash: string): Promise<string | null> {
    return this.kv.get(`tok:${kind}:${hash}`);
  }

  async listIds(): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix: 'vault:', cursor });
      ids.push(...page.keys.map((k) => k.name.slice('vault:'.length)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return ids;
  }
}
