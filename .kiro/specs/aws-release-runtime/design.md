# Design: AWS Release Runtime

## Overview

A second production runtime beside the Cloudflare Worker. It fills the same ports and reuses `createApp(deps)` and `step` untouched.

Ports: `Clock` is `SystemClock`, `VaultStore` is `DynamoDBStore`, `Mailer` is `SesMailer`, `RateLimiter` is `MemoryRateLimiter` per container. The tick is EventBridge Scheduler `rate(15 minutes)`. Entries are `src/aws/http.ts`, `tick.ts` and `config.ts`.

## Closing task 8.1 here

Lambda runs many containers, so `SwitchService.exclusive` cannot serialise writes. Every save is conditional on the version it read, and the service retries the loser (Requirement 4). Task 8.1 stays open for the Worker.

## Components

### `DynamoDBStore` (`src/server/adapters/dynamodb-store.ts`)
Implements `VaultStore` over a `DynamoDocLike` client and a table name. `get` is a consistent `GetItem` on `vault#<id>` that remembers `{ version, tokens }` in a per-instance `Map`; `put` is below; `findByToken` is a consistent `GetItem` on `tok#<kind>#<hash>`; `listIds` is a consistent `Scan` (`begins_with(pk, :p)`) following `LastEvaluatedKey`. The `VaultStore` interface is unchanged: the read is where the version is learned.

### `StoreConflictError` (`src/server/ports.ts`)
Thrown only by stores that detect a concurrent write; `MemoryStore` and `KvStore` never throw it.

### `DynamoDocLike`
A local client interface (`get`, `transactWrite`, `delete`, `scan`) shaped after the `@aws-sdk/lib-dynamodb` commands. A wrapper over the real client is task 5.1; no SDK package is installed.

### Built in session 14
`SwitchService.runNow` repeats load, tick, mutate, save and mail on `StoreConflictError`, up to 3 attempts, then `HttpError(409)`; a discarded attempt sends no mail. `SesMailer` takes a `SesClientLike { sendEmail(input) }` and its errors carry only the SES error name.

### Later components
`src/aws/config.ts`, `src/aws/http.ts` (`handle(createApp(...))` from `@hono/aws-lambda`), `src/aws/tick.ts` and a `rate(15 minutes)` schedule description.

## Data model

One table, partition key `pk` (string), no sort key.

| Item | `pk` | Attributes |
|---|---|---|
| Vault | `vault#<id>` | `kind: "vault"`, `version: N`, `data: <vault JSON string>` |
| Token index | `tok#<kind>#<hash>` | `kind: "token"`, `vaultId` |

The vault is one JSON string, as in `KvStore`.

Item limit: DynamoDB rejects an item over 400 KB, and a vault of 50 large letters can exceed it. The store refuses a vault whose JSON exceeds 390,000 bytes with a plain error. Splitting letters into their own items is not built.

## Conditional-write flow

Two writers read version 1. The first transaction succeeds at version 2. The second is cancelled (`ConditionalCheckFailed`), so the service re-reads version 2, re-applies and saves version 3.
`put(vault)`:
1. Serialise. Over 390,000 bytes: throw (Req 1.5).
2. If a `{ version, tokens }` is remembered, the condition is `#v = :read` and the new version `read + 1`; otherwise `attribute_not_exists(pk)` and version 1.
3. Send one `TransactWriteItems`: the conditional vault `Put` first, then one unconditional `Put` per token key (at most 1 + 10 witnesses + 50 letters + 6 check-in links + 1 owner, under the 100-action cap).
4. On success, remember `{ version: new, tokens: current }`, then delete each token the vault held at read time and no longer holds, one `DeleteItem` at a time, ignoring failures (Req 3.5).
5. On failure, classify (below).

A transaction keeps the index and the vault in step: a crash between two writes would leave a witness link pointing nowhere.

## Error handling

- A failed condition inside a transaction surfaces as `TransactionCanceledException` with `CancellationReasons` ordered like `TransactItems`; the vault `Put` is item 0. If reason 0 is `ConditionalCheckFailed` or `TransactionConflict` (an ongoing transaction on the same item), the store throws `StoreConflictError` and forgets the remembered version.  `TransactionConflict` was not confirmed in the docs read; both codes mean another writer, so a retry is correct.
- `TransactionConflictException` (a single-item write hitting a transaction) is also mapped to a conflict. Any other cancellation (capacity, validation, size) is rethrown unchanged (Req 2.7).
- SDKs do not retry a cancelled transaction, so the retry lives in `SwitchService` (Requirement 4): three attempts, then 409.

## Testing strategy

`tests/unit/fake-dynamo.ts` is an in-memory `DynamoDocLike` that understands only the two condition forms the store emits (anything else throws), checks every condition before applying any action, and can yield before `get` so writers interleave. `tests/unit/dynamodb-store.test.ts` covers versions, index upkeep, paging, the size refusal and **two writers racing so exactly one wins**. No network or credentials.

## Sources checked

AWS docs for PutItem, TransactWriteItems, CancellationReason, DynamoDB transactions, SES v2 SendEmail, EventBridge Scheduler and Lambda scheduled invoke; context7 `/honojs/website` for `handle` from `@hono/aws-lambda`.

## Deliberately not built

No deployment, IaC, IAM or table creation; no AWS SDK package and no real AWS call; no shared rate limiter; no vault splitting across items; no change to the Worker, `KvStore` or task 8.1; no TTL, streams or backups.
