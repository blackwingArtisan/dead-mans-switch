# Architecture

How Dead Man's Switch is put together: the layers, the state machine, the seal, the adapters behind each port, the deploy target and the security headers. The product overview is in the [README](../README.md); the full lifecycle spec is in [`.kiro/specs/switch-lifecycle`](../.kiro/specs/switch-lifecycle).

## Layers

```
src/core     pure domain: state machine, schedule, crypto, validation (shared everywhere)
src/server   Hono app (createApp), SwitchService, ports and adapters, email templates, Node entry
src/worker   Cloudflare Worker entry: fetch + Cron Trigger
src/web      React app: candle, wax seals, writing desk, witness, keepsake and recipient pages
tests/unit   Vitest
tests/e2e    Playwright
```

The state machine is a pure function, `step(vault, event, { now, mint }) -> { vault, effects }`. Effects are emails described as data; the service saves the vault first and then sends them. Ticks are idempotent and cascade, so a scheduler that was down for a month catches up in one run without double-sending.

States: `alive -> reminder -> grace -> confirm -> released`, plus `paused`. Check-in cancels from any live state; a witness denial sends `confirm` back to `grace` with a fresh grace window. Full detail in [`.kiro/specs/switch-lifecycle/design.md`](../.kiro/specs/switch-lifecycle/design.md).

## The seal

Each letter gets a random key K. K is split into a keepsake half A (random) and a vault half B = K xor A. The server stores the ciphertext, B and a hash of A. At release the recipient's browser joins A and B and decrypts locally; the ciphertext is bound to the letter id so it cannot be swapped. Limits, stated plainly in the app: vault custody is readable by the operator; a compromised device can read letters as they are written; witnesses who collude can release early; someone reading your email could use a check-in link to keep the candle lit; the server sees names, emails and timing; browser crypto trusts the code it is served.

## Adapters

| Port | Local (default, free) | Real (written and type-checked, not run in tests) | Env |
|---|---|---|---|
| Clock | `MachineClock` (time machine, opt-in for demos) | `SystemClock` (default) | `DMS_CLOCK=machine\|system`, or `--time-machine` |
| Store | `MemoryStore` + JSON file | `KvStore` (Workers KV) | `DMS_STORE=file\|memory` |
| Mail | `OutboxMailer` (local outbox) | `ResendMailer` (HTTPS) | `DMS_MAILER=outbox\|resend` |

The time machine and outbox routes exist only when both local adapters are active.

## Deploy target (free, not deployed)

Cloudflare Workers free plan: static assets for the web app, one KV namespace, and a Cron Trigger every 15 minutes that ticks every vigil. Mail through Resend's free tier. See `wrangler.toml` and `src/worker/index.ts`. To deploy you would create the KV namespace, set its id in `wrangler.toml`, `wrangler secret put RESEND_API_KEY`, then `npm run build && wrangler deploy`.

## Security headers and limits

Every response, including the Worker's static assets, carries a strict Content-Security-Policy (scripts from the same origin only, no plugins, no framing, same-origin network calls), `X-Frame-Options: DENY`, `nosniff`, `no-referrer` and a closed Permissions-Policy. The end-to-end run checks that the policy never blocks the app. Witness and letter links are rate-limited per client (60 a minute, then 429). The limiter lives in memory per process or isolate; a global limit would use a Durable Object.
