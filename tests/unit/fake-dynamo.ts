/** An in-memory stand-in for the DynamoDB DocumentClient, strict about the conditions it accepts. */
import type { DynamoDocLike, ScanInput, TransactPut } from '../../src/server/adapters/dynamodb-store';

type Item = Record<string, unknown>;

export class FakeDynamo implements DynamoDocLike {
  items = new Map<string, Item>();
  calls = { get: 0, transactWrite: 0, delete: 0, scan: 0 };
  transactSizes: number[] = [];
  /** Awaited at the start of every `get`, so two writers can be made to interleave. */
  beforeGet: (() => Promise<void>) | null = null;
  /** Makes the next matching call throw. */
  failNext: { method: 'transactWrite' | 'delete'; error: unknown } | null = null;
  pageSize = 2;

  async get(i: { TableName: string; Key: { pk: string }; ConsistentRead: boolean }) {
    this.calls.get++;
    if (!i.ConsistentRead) throw new Error('fake: reads must be strongly consistent');
    await this.beforeGet?.();
    const item = this.items.get(i.Key.pk);
    return { Item: item ? structuredClone(item) : undefined };
  }

  async transactWrite(i: { TransactItems: TransactPut[] }) {
    this.calls.transactWrite++;
    this.transactSizes.push(i.TransactItems.length);
    if (this.failNext?.method === 'transactWrite') {
      const e = this.failNext.error;
      this.failNext = null;
      throw e;
    }
    if (i.TransactItems.length > 100) throw Object.assign(new Error('too many actions'), { name: 'ValidationException' });
    const keys = i.TransactItems.map((t) => String(t.Put.Item.pk));
    if (new Set(keys).size !== keys.length) throw Object.assign(new Error('two actions on one item'), { name: 'ValidationException' });

    // Evaluate every condition first; apply nothing unless all hold (atomic, no awaits in between).
    const reasons = i.TransactItems.map((t) => {
      const existing = this.items.get(String(t.Put.Item.pk));
      return this.holds(t.Put, existing) ? { Code: 'None' } : { Code: 'ConditionalCheckFailed', Message: 'The conditional request failed' };
    });
    if (reasons.some((r) => r.Code !== 'None')) {
      throw Object.assign(new Error('Transaction cancelled'), { name: 'TransactionCanceledException', CancellationReasons: reasons });
    }
    for (const t of i.TransactItems) this.items.set(String(t.Put.Item.pk), structuredClone(t.Put.Item));
    return {};
  }

  async delete(i: { TableName: string; Key: { pk: string } }) {
    this.calls.delete++;
    if (this.failNext?.method === 'delete') {
      const e = this.failNext.error;
      this.failNext = null;
      throw e;
    }
    this.items.delete(i.Key.pk);
    return {};
  }

  async scan(i: ScanInput) {
    this.calls.scan++;
    if (i.FilterExpression !== 'begins_with(pk, :p)') throw new Error(`fake: unsupported filter ${i.FilterExpression}`);
    const prefix = String(i.ExpressionAttributeValues[':p']);
    const keys = [...this.items.keys()].sort();
    const from = i.ExclusiveStartKey ? keys.findIndex((k) => k > String(i.ExclusiveStartKey!.pk)) : 0;
    if (from === -1) return { Items: [] };
    // DynamoDB filters after it pages, so a page can come back empty yet carry a LastEvaluatedKey.
    const page = keys.slice(from, from + this.pageSize);
    const last = from + this.pageSize < keys.length ? { pk: page[page.length - 1] } : undefined;
    return { Items: page.filter((k) => k.startsWith(prefix)).map((pk) => ({ pk })), LastEvaluatedKey: last };
  }

  private holds(put: TransactPut['Put'], existing: Item | undefined): boolean {
    const cond = put.ConditionExpression;
    if (cond === undefined) return true;
    if (cond === 'attribute_not_exists(pk)') return existing === undefined;
    if (cond === '#v = :read' && put.ExpressionAttributeNames?.['#v'] === 'version') {
      return existing !== undefined && existing.version === put.ExpressionAttributeValues?.[':read'];
    }
    throw new Error(`fake: unsupported condition ${cond}`);
  }
}
