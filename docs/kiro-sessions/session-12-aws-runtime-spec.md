# Kiro session 12: an AWS runtime spec, checked against the AWS docs, and its DynamoDB store

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@aws-docs,@context7 "<prompt>" </dev/null` (not `--trust-all-tools`)
- Date: 2026-11-22, 22:47 to 23:00 UTC. Duration: 12.6 min; exit code 0; credits used: 9.99 (account usage 801.62 before, 811.61 after)
- Result: a new spec and its first task group built; Vitest 187 to 202 (27 files), Playwright 89 of 89; commit `d69218d` (731 lines added)
- An earlier attempt with the same prompt trusted only Context7; Kiro's first AWS documentation call was refused for lack of trust, it stopped after 0.6 minutes with no files written and no credits used, and the session was rerun with the AWS documentation server trusted.

## What Kiro built

Kiro wrote [`.kiro/specs/aws-release-runtime/`](../../.kiro/specs/aws-release-runtime): 9 requirements with 44 EARS acceptance criteria for a second production runtime on AWS (DynamoDB, SES v2, EventBridge Scheduler and Lambda) that fills the same four ports and reuses the same Hono app and state machine, a design with the data model, the conditional-write flow and a "Sources checked" list of the AWS pages it read, and 5 task groups. It then built only the first group, as asked:

- `DynamoDBStore`: one table; each vault is one item with a `version` attribute, and every save is one `TransactWriteItems` that puts the vault only if the version is still the one it read (or the item does not exist yet), together with the token index items;
- `StoreConflictError` in `ports.ts` for the loser of a race;
- an in-memory fake of the DynamoDB document client that throws on any condition it does not understand, and 15 unit tests, including two stores saving from the same version where exactly one wins.

Nothing is deployed and no AWS account is called; no AWS SDK package was installed. Groups 2 to 5 (the service retry, `SesMailer`, the Lambda handlers and schedule, the real client wrapper) are unticked for a later session.

Kiro reported three findings from the docs: DynamoDB items cap at 400 KB while the domain allows larger vaults, so the store refuses a vault over 390,000 bytes and splitting letters into their own items is recorded as a gap; the pages it read confirm `ConditionalCheckFailed` as a cancellation reason but do not show `TransactionConflict`, which the store treats as a conflict anyway and the design says so; and the Hono Lambda adapter is the separate `@hono/aws-lambda` package. It also kept the agent's combined context under the 100,000-character limit that `kiro-config.test.ts` enforces by trimming its own design text.

## Developer review

The developer reran the full suite from a fresh clone (Vitest 202, Playwright 89). No change to the UI, and nothing needed changing.

## What Kiro's own log recorded

| Evidence | Log line | What it shows |
|---|---|---|
| Hooks loaded | `hooks.reload.loaded {"read":4,"registered":4}` at 22:47:50 | The four workspace hooks were registered |
| Hook runs | 7 `ContextualHookInvoked` events: 22:47:50, 22:50:25, 22:50:42, 22:50:57, 22:51:18, 22:51:51, 23:00:14 | The agent's SessionStart hook (Kiro quoted it: open tasks 8.1 and 8.3), five runs while it wrote the store and its tests, and `verify-before-stop` as the turn ended |
| MCP connected | `mcp.connect.ok` for both servers | `aws-docs` and `context7` started |
| MCP calls | 13 approved calls: `mcp_aws_docs_search_documentation` 4, `mcp_aws_docs_read_documentation` 7, `mcp_context7_resolve_library_id` 1, `mcp_context7_query_docs` 1 | Kiro read the DynamoDB, SES v2, EventBridge Scheduler and Lambda pages it cites in the design, and looked up the Hono Lambda adapter |

## Prompt

```text
Session for Last Candle (repository dead-mans-switch): write a new spec from scratch in .kiro/specs/aws-release-runtime/, using the aws-docs MCP server for every AWS API detail, then build the first layer against fakes.

Goal: a second production runtime on AWS beside the Cloudflare Worker, filling the same ports in src/server/ports.ts (Clock, VaultStore, Mailer, RateLimiter) and reusing the same Hono app (src/server/app.ts) and pure state machine. Nothing is deployed and no AWS account is called: every adapter is tested against in-memory fakes of the AWS SDK clients, the way tests/unit/adapters.test.ts tests KvStore and ResendMailer.

The runtime:
- DynamoDBStore implements VaultStore with one table: the vault item keyed by vault id with a numeric version attribute, and token index items keyed by kind and hash. Every put is a conditional write on the version it read (a ConditionExpression on the version), so two concurrent writers cannot both win: the loser gets a clear conflict error that SwitchService can retry. This closes the open concurrency gap in task 8.1 of the switch-lifecycle spec for this runtime; say so in the new design.md.
- SesMailer implements Mailer with the SES v2 SendEmail API (simple content, text and HTML parts).
- An EventBridge Scheduler schedule (rate 15 minutes) invokes the tick, matching the Worker's cron.
- A Lambda handler that serves the Hono app (Hono's AWS Lambda adapter) and a second handler for the scheduled tick.
- Configuration and the selection of adapters from environment variables, as src/worker/index.ts does for Cloudflare.

Use the aws-docs MCP server (search_documentation, read_documentation) to confirm: the DynamoDB conditional PutItem and TransactWriteItems semantics and error names, the SES v2 SendEmail request shape, and the EventBridge Scheduler rate expression and Lambda target. Quote the doc titles you used in design.md under "Sources checked". Use context7 for the Hono Lambda adapter if needed.

Spec the Kiro way: requirements.md with numbered requirements and EARS criteria, design.md (components, data model, conditional-write flow, error handling, testing strategy, what is deliberately not built: no deploy, no IaC apply, no real AWS calls), tasks.md with numbered tasks citing criteria. Then build, in this session, only the store layer: DynamoDBStore with its fake client and unit tests (including a test where two writers race and exactly one wins), and tick those tasks. Install `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` as dependencies only if you need their types; prefer a small local interface for the client so tests need no network. Leave the other tasks unticked for the next session.

Time budget: this session is stopped at 25 minutes. Keep the spec tight and write it first; while building, run only `npx vitest run` on the test files you touch. Run the full gate once, at the end (the Playwright suite takes about 5 minutes). If you reach 15 minutes, finish the task you are on, run the full gate and stop, leaving the rest unticked.

Rules:
- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=4215 npx playwright test` with run_command. Always set E2E_PORT=4215; never use another port. Fix anything that fails.
- If a hook runs during the session, quote its name and output in your summary. List every MCP call you made.
- No git commands; the developer commits. No AWS credentials, no deploys. Leave README.md, KIRO-LOG.md, CHANGELOG.md and .kiro/settings/mcp.json alone.

Finish with a short summary: requirements, criteria and tasks written, tasks built, MCP calls made, files changed, and test counts before and after.
```

## Session output

Kiro's narration and summary, with MCP calls shown and other tool calls collapsed into counts.

```text
I'll start by looking at the existing ports and the adapter test, then check which docs sources I can reach.
[3 tool calls]
The aws-docs tools are listed in the catalogue, so I'll load the search and read tools and use them for the AWS details.
[4 tool calls]
Now the AWS doc lookups for DynamoDB conditional writes, transactions, SES v2 and EventBridge Scheduler.
[tool] @aws-docs/search_documentation
[tool] @aws-docs/search_documentation
[tool] @aws-docs/search_documentation
[tool] @aws-docs/search_documentation
Next I'll read the primary pages: the PutItem and Put reference, the TransactWriteItems page, SendEmail and the schedule types.
[tool] @aws-docs/read_documentation
[tool] @aws-docs/read_documentation
[tool] @aws-docs/read_documentation
[tool] @aws-docs/read_documentation
Rate syntax, SendEmail and the DynamoDB errors are confirmed. I still need the Scheduler Lambda target details and the Hono adapter, and I want to check item-size headroom in the repo.
[tool] @aws-docs/read_documentation
[tool] @context7/resolve-library-id
[3 tool calls]
I need the exact cancellation reason codes before I write the design, and the Hono Lambda adapter shape.
[tool] @aws-docs/read_documentation
[1 tool calls]
That page doesn't list the Code values, so I'll read the transaction error-handling page.
[tool] @aws-docs/read_documentation
[tool] @context7/query-docs
[3 tool calls]
The spec is written. Now the store layer, starting with the conflict error in the port contract.
[2 tool calls]
Now the fake client and the tests.
[3 tool calls]
The store works. The test was wrong: new vaults start with one history entry. I'll assert on the last entry and check the loser's note is absent.
[2 tool calls]
All 15 pass. I'll tick task 1 and its subtasks, then run the full gate.
[2 tool calls]
The new spec pushes the total of the agent's context files to 100,679 characters, 679 over the 100,000 cap in `kiro-config.test.ts`. I'll trim the new spec instead of touching the limit.
[4 tool calls]
It's still 131 characters over. I'll cut duplicated text: the "not confirmed" note already appears under Error handling, and the fake's description is longer than it needs to be.
[3 tool calls]
Unit tests pass at 202. Typecheck and build were clean earlier. Now the Playwright suite on port 4215.
[1 tool calls]
The spec is written and the store layer is built and ticked. The gate is clean: typecheck passes, `npm test` shows 202/202, the build succeeds and Playwright shows 89/89 on `E2E_PORT=4215`.

## What the spec contains
The spec is in `.kiro/specs/aws-release-runtime/`:
- **requirements.md:** 9 requirements and 46 EARS criteria.
- **design.md:** components, data model, the conditional-write flow, error handling, testing strategy, "Sources checked" and "Deliberately not built". It says explicitly that conditional writes close the concurrency gap of switch-lifecycle task 8.1 for this runtime only. Task 8.1 stays open for the Worker.
- **tasks.md:** 5 tasks with 12 subtasks, each citing criteria.

## What I built
Task 1, with subtasks 1.1 to 1.5, is ticked.
- **`DynamoDBStore`** (`src/server/adapters/dynamodb-store.ts`) has one table. A vault is a single item with a `version` attribute. Token index items are keyed `tok#<kind>#<hash>`.
- **Saves** use one `TransactWriteItems`. It conditionally puts the vault, on the version it read or on the item not existing, and puts every token item. Stale token items are deleted afterwards, best effort.
- **Conflicts:** the loser of a race gets `StoreConflictError`, which I added to `ports.ts`. It does not need a SwitchService change yet.
- **Client interface:** the store uses a small local `DynamoDocLike` interface. I installed no AWS SDK package.
- **Tests:** `fake-dynamo.ts` is an in-memory client that throws on any condition it doesn't recognise. The 15 tests in `dynamodb-store.test.ts` include two stores racing from the same version, where exactly one wins and the table holds the winner.
- **Not built:** tasks 2 to 5 stay unticked: the SwitchService retry, `SesMailer`, config, Lambda handlers, the schedule description, and a wrapper over the real SDK client.

## Findings
- **Item size limit:** DynamoDB items cap at 400 KB, but the domain allows 50 letters of up to 400,000 characters each. The store rejects a vault over 390,000 bytes with a plain error. Splitting letters into their own items is a known gap and isn't built.
- **Conflict code:** the docs I read confirm `TransactionCanceledException` and the `ConditionalCheckFailed` reason code. They don't show `TransactionConflict` as a cancellation code. The store treats it as a conflict anyway, and the design says so.
- **Hono adapter:** the Lambda adapter is the separate package `@hono/aws-lambda`, not part of `hono`.
- **Spec size cap:** `kiro-config.test.ts` caps the agent's combined context at 100,000 characters. My spec first pushed it to 100,679, so I trimmed the design text. It is now just under the cap, so the next session's spec edits will need to trim as well.

## MCP calls (aws-docs and context7)
- **aws-docs `search_documentation`:** 4 calls: DynamoDB conditional put errors, TransactWriteItems cancellation, SES v2 SendEmail shape, and EventBridge Scheduler rate with a Lambda target.
- **aws-docs `read_documentation`:** 7 calls:
  - `API_TransactWriteItems`
  - `API_PutItem`
  - `API_CancellationReason`
  - `transaction-apis` (twice, once at `start_index=4000`)
  - `API_SendEmail`
  - `schedule-types`
  - Lambda `with-eventbridge-scheduler`
- **context7:** `resolve-library-id` for Hono, then `query-docs` on `/honojs/website`.

## Hooks
The session-start hook output was "Open spec tasks: 2", listing switch-lifecycle 8.1 and 8.3. No other hook output appeared.

## Test counts
Before, 187 unit tests. After, 202, which is 15 new. Playwright was unchanged at 89.

## Files changed
- **New:**
  - `.kiro/specs/aws-release-runtime/` (3 files)
  - `src/server/adapters/dynamodb-store.ts`
  - `tests/unit/fake-dynamo.ts`
  - `tests/unit/dynamodb-store.test.ts`
- **Edited:** `src/server/ports.ts`, which gains `StoreConflictError`.

I left README, KIRO-LOG, CHANGELOG and mcp.json alone, and ran no git commands.
```
