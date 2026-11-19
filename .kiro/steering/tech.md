---
inclusion: always
---
# Tech

## Stack
- TypeScript everywhere, `strict` on. Node 20+ for local tooling.
- **Web:** React 18 + Vite. No UI kit; hand-made CSS with design tokens on `:root`. Fonts self-hosted via `@fontsource`.
- **API:** Hono. The same `createApp(deps)` runs on Node locally and on a Cloudflare Worker in production.
- **Tests:** Vitest for unit and API tests, Playwright for end-to-end tests against the real built server.

## Adapters (every external service sits behind one)
| Port | Local (default) | Real (written, type-checked) |
|---|---|---|
| `Clock` | `MachineClock` with a time-machine offset | `SystemClock` |
| `VaultStore` | `MemoryStore`, optionally persisted to a JSON file | `KvStore` on Workers KV |
| `Mailer` | `OutboxMailer` writing to a local outbox | `ResendMailer` over HTTPS |
| `RateLimiter` | `MemoryRateLimiter` (fixed window, per process) | `CloudflareRateLimiter` over the Workers Rate Limiting binding, used only when the `DMS_RATE_LIMITER` binding is configured |

Selection is by env var (the Worker picks `RateLimiter` by the presence of its binding): `DMS_CLOCK`, `DMS_STORE`, `DMS_MAILER`. Store and mail default to the free local implementations. The clock defaults to the system clock; the time machine is opt-in (`--time-machine`) because its routes act on every vault. Tests never call a paid or networked service.

## Rules
- The switch state machine is a **pure function**: `(vault, event, now) -> { vault, effects }`. No I/O inside it. Effects (emails) are performed by the caller.
- `tick` is idempotent: running it twice at the same instant produces no new effects.
- Crypto uses WebCrypto only (`crypto.subtle`), AES-GCM 256 with a fresh 96-bit IV per encryption. No hand-rolled ciphers. Random bytes from `crypto.getRandomValues`.
- Never log letter content, keys or key halves. Never send a full letter key to the server.
- Tokens (owner, witness, open) are 32 random bytes, base64url. Compare in constant time on the server.
- Decrypted letter HTML is sanitised (DOMPurify) before it is rendered, and every response carries the strict CSP from `src/server/security.ts`. No inline scripts and no third-party origins in the web app.
- Keep dependencies few and well known.

## Commands
- `npm run dev` web on :3141 with the API on :3140
- `npm test` unit + API tests
- `npm run e2e` Playwright against a fresh built server on :3142
- `npm run typecheck` web, server and worker
- `npm run build` production bundle into `dist/`

## Deploy target (free)
Cloudflare Workers (free plan) with static assets, one KV namespace and a Cron Trigger every 15 minutes. Email through Resend's free tier. Not deployed from this repo by default.
