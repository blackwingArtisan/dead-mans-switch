import type { Vault } from '../../core/types';
import { tokenKeys, type TokenKind, type VaultStore } from '../ports';

export interface StoreSnapshot {
  vaults: Vault[];
}

/** In-memory store for local runs and tests. `onChange` lets the Node entry persist to disk. */
export class MemoryStore implements VaultStore {
  private readonly vaults = new Map<string, Vault>();
  private readonly index = new Map<string, string>();

  constructor(
    snapshot?: StoreSnapshot,
    private readonly onChange?: (snapshot: StoreSnapshot) => void,
  ) {
    for (const v of snapshot?.vaults ?? []) this.save(v);
  }

  async get(id: string): Promise<Vault | null> {
    const v = this.vaults.get(id);
    return v ? structuredClone(v) : null;
  }

  async put(vault: Vault): Promise<void> {
    this.save(structuredClone(vault));
    this.onChange?.(this.snapshot());
  }

  async findByToken(kind: TokenKind, hash: string): Promise<string | null> {
    return this.index.get(`${kind}:${hash}`) ?? null;
  }

  async listIds(): Promise<string[]> {
    return [...this.vaults.keys()];
  }

  snapshot(): StoreSnapshot {
    return { vaults: [...this.vaults.values()].map((v) => structuredClone(v)) };
  }

  clear(): void {
    this.vaults.clear();
    this.index.clear();
    this.onChange?.(this.snapshot());
  }

  private save(vault: Vault): void {
    const old = this.vaults.get(vault.id);
    if (old) for (const k of tokenKeys(old)) this.index.delete(`${k.kind}:${k.hash}`);
    this.vaults.set(vault.id, vault);
    for (const k of tokenKeys(vault)) this.index.set(`${k.kind}:${k.hash}`, vault.id);
  }
}
