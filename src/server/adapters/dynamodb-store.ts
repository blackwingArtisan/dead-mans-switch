/**
 * DynamoDB implementation of VaultStore for the AWS runtime (written and tested against a fake;
 * never called against a real account from this repository).
 *
 * One table, partition key `pk`:
 *   vault#<id>            { kind: 'vault', version, data: <vault JSON> }
 *   tok#<kind>#<hash>     { kind: 'token', vaultId }
 *
 * Every save is one TransactWriteItems that puts the vault item under a condition on the version
 * this instance read (or on the item not existing) and puts every current token index item. Two
 * writers that read the same version cannot both win: the loser gets a StoreConflictError, which
 * SwitchService retries. See .kiro/specs/aws-release-runtime/design.md.
 */
import type { Vault } from '../../core/types';
import { StoreConflictError, tokenKeys, type TokenKind, type VaultStore } from '../ports';

type Item = Record<string, unknown>;

export interface TransactPut {
  Put: {
    TableName: string;
    Item: Item;
    ConditionExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, unknown>;
  };
}

export interface ScanInput {
  TableName: string;
  ConsistentRead: boolean;
  FilterExpression: string;
  ProjectionExpression: string;
  ExpressionAttributeValues: Record<string, unknown>;
  ExclusiveStartKey?: Record<string, unknown>;
}

/**
 * The subset of the DynamoDB DocumentClient this store needs, with native JavaScript values.
 * A thin wrapper over `@aws-sdk/lib-dynamodb` fills it in production; tests use an in-memory fake.
 */
export interface DynamoDocLike {
  get(input: { TableName: string; Key: { pk: string }; ConsistentRead: boolean }): Promise<{ Item?: Item }>;
  transactWrite(input: { TransactItems: TransactPut[] }): Promise<unknown>;
  delete(input: { TableName: string; Key: { pk: string } }): Promise<unknown>;
  scan(input: ScanInput): Promise<{ Items?: Item[]; LastEvaluatedKey?: Record<string, unknown> }>;
}

/** DynamoDB rejects an item over 400 KB; leave room for the other attributes and names. */
export const MAX_VAULT_BYTES = 390_000;
/** TransactWriteItems takes at most 100 actions. */
const MAX_TRANSACT_ACTIONS = 100;

const VAULT_PREFIX = 'vault#';
const vaultKey = (id: string) => `${VAULT_PREFIX}${id}`;
const tokenPk = (kind: string, hash: string) => `tok#${kind}#${hash}`;

interface Seen {
  version: number;
  /** Index keys the stored vault held when this instance read it. */
  tokens: string[];
}

export class DynamoDBStore implements VaultStore {
  /** What this instance last read or wrote for each vault; the basis of the version condition. */
  private readonly seen = new Map<string, Seen>();

  constructor(
    private readonly db: DynamoDocLike,
    private readonly table: string,
  ) {}

  async get(id: string): Promise<Vault | null> {
    const { Item } = await this.db.get({ TableName: this.table, Key: { pk: vaultKey(id) }, ConsistentRead: true });
    if (!Item) {
      this.seen.delete(id);
      return null;
    }
    const vault = JSON.parse(String(Item.data)) as Vault;
    this.seen.set(id, { version: Number(Item.version), tokens: tokenKeys(vault).map((k) => tokenPk(k.kind, k.hash)) });
    return vault;
  }

  async put(vault: Vault): Promise<void> {
    const data = JSON.stringify(vault);
    if (new TextEncoder().encode(data).length > MAX_VAULT_BYTES) {
      throw new Error('This vault is too large to store. DynamoDB items are limited to 400 KB; burn or shorten a letter.');
    }
    const before = this.seen.get(vault.id);
    const version = (before?.version ?? 0) + 1;
    const current = tokenKeys(vault).map((k) => ({ pk: tokenPk(k.kind, k.hash) }));
    if (1 + current.length > MAX_TRANSACT_ACTIONS) throw new Error('This vault holds too many links to store in one write.');

    const vaultPut: TransactPut = {
      Put: {
        TableName: this.table,
        Item: { pk: vaultKey(vault.id), kind: 'vault', version, data },
        ...(before
          ? { ConditionExpression: '#v = :read', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':read': before.version } }
          : { ConditionExpression: 'attribute_not_exists(pk)' }),
      },
    };
    const indexPuts: TransactPut[] = current.map(({ pk }) => ({
      Put: { TableName: this.table, Item: { pk, kind: 'token', vaultId: vault.id } },
    }));

    try {
      await this.db.transactWrite({ TransactItems: [vaultPut, ...indexPuts] });
    } catch (err) {
      if (isConflict(err)) {
        this.seen.delete(vault.id);
        throw new StoreConflictError();
      }
      throw err;
    }

    const now = new Set(current.map((c) => c.pk));
    this.seen.set(vault.id, { version, tokens: [...now] });
    // A stale index item resolves to a refusal (the service checks the vault's own hashes), so a
    // failed cleanup must not fail a save that already happened.
    const stale = (before?.tokens ?? []).filter((pk) => !now.has(pk));
    await Promise.all(stale.map((pk) => this.db.delete({ TableName: this.table, Key: { pk } }).catch(() => undefined)));
  }

  async findByToken(kind: TokenKind, hash: string): Promise<string | null> {
    const { Item } = await this.db.get({ TableName: this.table, Key: { pk: tokenPk(kind, hash) }, ConsistentRead: true });
    return typeof Item?.vaultId === 'string' ? Item.vaultId : null;
  }

  async listIds(): Promise<string[]> {
    const ids: string[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const page = await this.db.scan({
        TableName: this.table,
        ConsistentRead: true,
        FilterExpression: 'begins_with(pk, :p)',
        ProjectionExpression: 'pk',
        ExpressionAttributeValues: { ':p': VAULT_PREFIX },
        ...(start ? { ExclusiveStartKey: start } : {}),
      });
      for (const item of page.Items ?? []) ids.push(String(item.pk).slice(VAULT_PREFIX.length));
      start = page.LastEvaluatedKey;
    } while (start);
    return ids;
  }
}

/**
 * A failed condition on the vault item (the first action) or a clash with another transaction on
 * the same item. Anything else (capacity, validation, size) is not a conflict and is rethrown.
 */
function isConflict(err: unknown): boolean {
  const e = err as { name?: string; CancellationReasons?: { Code?: string }[] } | null;
  if (!e) return false;
  if (e.name === 'ConditionalCheckFailedException' || e.name === 'TransactionConflictException') return true;
  if (e.name !== 'TransactionCanceledException') return false;
  const code = e.CancellationReasons?.[0]?.Code;
  return code === 'ConditionalCheckFailed' || code === 'TransactionConflict';
}
