# Implementation Plan: AWS Release Runtime

- [x] 1. Store layer (first session)
  - [x] 1.1 Add `StoreConflictError` to `src/server/ports.ts` (AWS Req 2.4)
  - [x] 1.2 `tests/unit/fake-dynamo.ts`: in-memory `DynamoDocLike` with strict conditions, atomic transactions and a yield point (AWS Req 9.1, 9.3)
  - [x] 1.3 `DynamoDBStore` in `src/server/adapters/dynamodb-store.ts`: get, listIds, findByToken (AWS Req 1.1-1.4, 3.3)
  - [x] 1.4 Conditional versioned put in one transaction with the token index, stale index deletion, size limit, error classification (AWS Req 1.5, 2.1-2.8, 3.1, 3.2, 3.4-3.6)
  - [x] 1.5 Unit tests including two writers racing with exactly one winner (AWS Req 2.3, 2.8, 9.1)

- [ ] 2. Service retry
  - [ ] 2.1 `SwitchService` re-reads, re-applies and saves again on `StoreConflictError`, up to 3 attempts, 409 after (AWS Req 4.1-4.4)

- [ ] 3. Mailer
  - [ ] 3.1 `SesMailer` against a fake SES client (AWS Req 5.1-5.5)

- [ ] 4. Runtime
  - [ ] 4.1 `src/aws/config.ts`: environment variables, adapter selection (AWS Req 8.1-8.4)
  - [ ] 4.2 `src/aws/http.ts`: `@hono/aws-lambda` handler over `createApp` (AWS Req 7.1-7.3)
  - [ ] 4.3 `src/aws/tick.ts` and the `rate(15 minutes)` schedule description, not applied (AWS Req 6.1-6.5)

- [ ] 5. Real client wrapper
  - [ ] 5.1 Thin wrapper from `@aws-sdk/lib-dynamodb` and `@aws-sdk/client-ses` clients to `DynamoDocLike` and the SES client interface; type-checked, never called (AWS Req 9.2)
