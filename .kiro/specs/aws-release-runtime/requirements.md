# Requirements: AWS Release Runtime

## Introduction

Last Candle runs in production on a Cloudflare Worker. This spec adds a second production runtime on AWS that fills the same ports in `src/server/ports.ts` and reuses `createApp` and the pure state machine unchanged. The runtime is a DynamoDB table (`VaultStore`), Amazon SES (`Mailer`), an EventBridge Scheduler schedule (the tick) and two Lambda handlers (the Hono app and the tick).

Nothing is deployed and no AWS account is called. Every adapter is written against a small local client interface and tested with in-memory fakes. The `Clock` port needs no new adapter: `SystemClock` already fits. The `RateLimiter` port keeps `MemoryRateLimiter`, per Lambda container; a shared limiter on AWS is out of scope.

Terms: **store** is the DynamoDB-backed `VaultStore`. **Version** is the numeric attribute on a vault item that counts its writes. **Conflict** is a write rejected because the version in the table no longer equals the version the writer read.

Criteria use EARS, as in the switch-lifecycle spec. Numbers are stable: new criteria are appended at the end of their requirement. Tests cite criteria as "(AWS Req N.M)".

## Requirement 1: Store vaults in one DynamoDB table

**User story:** As an operator on AWS, I want vaults kept in a single table, so that the runtime needs one resource to hold state.

#### Acceptance criteria
1. THE SYSTEM SHALL keep each vault as one item whose partition key is `vault#<id>`, with the vault JSON in a `data` attribute and a numeric `version` attribute.
2. WHEN `get` is called for an id with no item THE SYSTEM SHALL return null.
3. WHEN `get` is called for an existing id THE SYSTEM SHALL read with a strongly consistent read and return the parsed vault.
4. WHEN `listIds` is called THE SYSTEM SHALL return the id of every vault, following `LastEvaluatedKey` until the scan is complete, and SHALL NOT return token index items.
5. IF the serialised vault is larger than 390,000 bytes THEN THE SYSTEM SHALL refuse to write it with an error that names the DynamoDB item limit, and SHALL write nothing.
6. THE SYSTEM SHALL NOT log or put in an error message any vault content, token or key.

## Requirement 2: Conditional writes on the version

**User story:** As an author, I want two simultaneous writers never to overwrite each other, so that a check-in cannot erase a witness's answer or the reverse.

#### Acceptance criteria
1. WHEN a vault is saved that this store instance read at version N THE SYSTEM SHALL write it with `version = N + 1` under the condition that the stored version still equals N.
2. WHEN a vault is saved that this store instance has not read THE SYSTEM SHALL write it at version 1 under the condition that no item with that key exists.
3. WHEN two writers read the same version and both save THE SYSTEM SHALL let exactly one write succeed and reject the other with a conflict error.
4. IF a write is rejected by its condition THEN THE SYSTEM SHALL throw a `StoreConflictError` whose message says the vigil changed while it was being saved and that the change can be retried, and SHALL leave the table as the winning writer left it.
5. WHEN a conflict is thrown THE SYSTEM SHALL forget the version it remembered for that vault, so that the next save without a fresh read cannot overwrite.
6. WHEN a save succeeds THE SYSTEM SHALL remember the new version, so that a second save in the same instance needs no extra read.
7. IF DynamoDB rejects a write for any reason other than a failed condition or a transaction conflict THEN THE SYSTEM SHALL rethrow that error unchanged.
8. WHERE the same instance reads a vault again after a conflict THE SYSTEM SHALL write the retried change successfully.

## Requirement 3: Token index kept in step, atomically

**User story:** As a witness or recipient, I want my link to find the right vigil, and never a vigil that no longer lists it.

#### Acceptance criteria
1. THE SYSTEM SHALL keep one index item per token, with partition key `tok#<kind>#<hash>` and the owning vault id, for every key `tokenKeys(vault)` returns.
2. WHEN a vault is saved THE SYSTEM SHALL write the vault item and every current index item in one `TransactWriteItems` request of at most 100 actions, so that either all are written or none.
3. WHEN `findByToken` is called THE SYSTEM SHALL return the vault id for a known kind and hash, and null otherwise, using a strongly consistent read.
4. WHEN a saved vault no longer holds a token it held when it was read THE SYSTEM SHALL delete that token's index item after the vault write succeeds.
5. IF deleting a stale index item fails THEN THE SYSTEM SHALL still report the save as successful, because the service resolves every token against the vault's own hashes and a stale index item resolves to a refusal.
6. IF a write is rejected by its condition THEN THE SYSTEM SHALL write no index item.

## Requirement 4: The conflict is retried by the service

**User story:** As an author, I want a conflict to be invisible to me, so that I see my check-in succeed.

#### Acceptance criteria
1. WHEN `SwitchService` receives a `StoreConflictError` while saving a change THE SYSTEM SHALL re-read the vault, re-apply the same change and save again, up to 3 attempts.
2. IF the third attempt also conflicts THEN THE SYSTEM SHALL answer 409 with a plain message asking the author to try again.
3. WHEN a conflicted attempt is discarded THE SYSTEM SHALL send none of its emails.
4. THE SYSTEM SHALL keep the retry out of the stores that cannot conflict (`MemoryStore`, `KvStore`), which never throw `StoreConflictError`.

## Requirement 5: Send email through SES

**User story:** As an operator on AWS, I want every email sent through Amazon SES, so that no second mail provider is needed.

#### Acceptance criteria
1. WHEN `send` is called THE SYSTEM SHALL call SES v2 `SendEmail` once with a Simple content message: the subject, an HTML body part and a plain-text body part, both UTF-8.
2. THE SYSTEM SHALL address the message to the recipient as `Name <email>` in `Destination.ToAddresses` and set `FromEmailAddress` from configuration.
3. THE SYSTEM SHALL NOT log the message body or any link in it.
4. IF SES rejects the request THEN THE SYSTEM SHALL throw an error with the SES error name and no message body, so that `SwitchService` records a `mail-failed` ledger entry as it does for Resend.
5. WHERE a configuration set name is configured THE SYSTEM SHALL pass it as `ConfigurationSetName`.

## Requirement 6: The tick runs every 15 minutes

**User story:** As an author, I want reminders to arrive on time, so that the AWS runtime behaves like the Worker's cron.

#### Acceptance criteria
1. THE SYSTEM SHALL describe an EventBridge Scheduler schedule with the expression `rate(15 minutes)` and a Lambda target.
2. WHEN the schedule invokes the tick handler THE SYSTEM SHALL call `SwitchService.tickAll` once.
3. WHEN the tick handler finishes THE SYSTEM SHALL return the number of vaults and emails, with no vault content.
4. IF `tickAll` throws THEN THE SYSTEM SHALL let the invocation fail so that Scheduler's retry policy applies.
5. THE SYSTEM SHALL NOT apply, create or call the schedule in this repository.

## Requirement 7: The Hono app on Lambda

**User story:** As an operator, I want the same app on AWS, so that a fix to a route reaches both runtimes.

#### Acceptance criteria
1. THE SYSTEM SHALL serve `createApp(deps)` through the Hono AWS Lambda adapter, with the same security headers as every other runtime.
2. THE SYSTEM SHALL NOT expose the dev routes (time machine, outbox, reset) on Lambda.
3. WHEN the request carries a client address THE SYSTEM SHALL pass it to the rate limiter as the key.

## Requirement 8: Configuration from environment variables

**User story:** As an operator, I want one place that reads configuration, so that a missing value fails loudly at start.

#### Acceptance criteria
1. THE SYSTEM SHALL read the table name, the base URL, the sender address and the optional SES configuration set from environment variables.
2. IF a required variable is missing or blank THEN THE SYSTEM SHALL throw an error that names the variable.
3. THE SYSTEM SHALL build the adapters once per container and reuse them across invocations.
4. THE SYSTEM SHALL select `SystemClock`, `DynamoDBStore`, `SesMailer` and `MemoryRateLimiter`, and SHALL NOT select the machine clock or the outbox.

## Requirement 9: Tests need no network

**User story:** As a developer, I want the AWS adapters tested with fakes, so that the suite stays free and offline.

#### Acceptance criteria
1. THE SYSTEM SHALL test every AWS adapter against an in-memory fake of its client interface.
2. THE SYSTEM SHALL NOT import an AWS SDK package into `src/core` or into any test.
3. THE SYSTEM SHALL keep the fake's condition handling strict: a condition expression the fake does not understand throws.
