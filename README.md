# Dead Man's Switch

**Write letters for the people you love, sealed until you can no longer check in.**

A candle-lit vigil for your last words. Letters are encrypted in your browser. You keep a candle lit with one tap ("I still walk among the living"). If it ever goes out, you get reminders and a grace period; then the people you trust are asked to confirm; only then does each recipient get a one-time link that decrypts their letter in their own browser.

Built for Kiroween 2026, Costume Contest category.

## Who it is for

- Anyone who wants the passwords-to-the-shoebox, the apology, or the "I'm proud of you" to reach the right person, without handing it over today.
- Sole account holders and solo founders who need an "if I go quiet, tell these people" switch.
- Families planning ahead: a parent writing to children, a caregiver leaving instructions.

## What works today

- Begin a vigil with your own cadence, grace period, reminder lead, witnesses-required (k of n) and an optional silence window.
- Write rich-text letters on parchment; seal them with AES-GCM-256 in the browser.
- Two custody modes per letter:
  - **Keepsake** (default): the recipient holds half the key, handed over by you as a link or printed code. The server can never read the letter.
  - **Vault**: the server holds both halves, so there is nothing to hand over. The UI says plainly that the operator could read it.
- One-tap check-in, pause and resume.
- Reminder, grace, last-call, witness, stand-down, denial and release emails (plain text and HTML).
- Witness page with a two-step confirm and a one-tap "they still live" that stops the release.
- Recipient page: keepsake check before spending the link, the seal cracks, the letter unfolds; download and print; the server forgets its copy.
- **Time machine** (local only): move the clock forward a day, a week, a month or to the next event, and read every email in the outbox. The whole lifecycle runs in about a minute.
- An honest "How the seal works" page.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run demo          # builds the web app and serves everything on http://localhost:3140
```

Open http://localhost:3140, choose **Try a demo vigil**, then open the **Time machine** (bottom right):
1. **+30 days**: the flame gutters (grace).
2. **+7 days**: the candle goes out and the witnesses are asked.
3. In the outbox, open **Witness asked** and confirm as the witness.
4. Open **Letter released** for June (vault custody) and break the seal.

For development with hot reload: `npm run dev` (web on :3141, API on :3140).

Local data lives in `./data` (`vaults.json`, `outbox.json`, `clock.json`). Delete the folder or use **Reset the whole demo** to start over.

## Test it

```bash
npm test              # Vitest: state machine, crypto, full API lifecycle
npm run e2e           # Playwright: builds and starts a fresh server on :3142, drives real browsers
npm run typecheck     # web + server, and the Cloudflare Worker against Workers types
npm run check         # all of the above plus a production build
```

The end-to-end suite writes a letter, fast-forwards past the grace period, confirms as a witness in a separate browser, opens the letter as the recipient in a fresh browser with a pasted keepsake, and checks the link refuses a second opening. It also covers a check-in during grace, a vault-custody link, and mobile layout.

## Architecture

```
src/core     pure domain: state machine, schedule, crypto, validation (shared everywhere)
src/server   Hono app (createApp), SwitchService, ports and adapters, email templates, Node entry
src/worker   Cloudflare Worker entry: fetch + Cron Trigger
src/web      React app: candle, wax seals, writing desk, witness, keepsake and recipient pages
tests/unit   Vitest
tests/e2e    Playwright
```

The state machine is a pure function, `step(vault, event, { now, mint }) -> { vault, effects }`. Effects are emails described as data; the service saves the vault first and then sends them. Ticks are idempotent and cascade, so a scheduler that was down for a month catches up in one run without double-sending.

States: `alive -> reminder -> grace -> confirm -> released`, plus `paused`. Check-in cancels from any live state; a witness denial sends `confirm` back to `grace` with a fresh grace window. Full detail in [`.kiro/specs/switch-lifecycle/design.md`](.kiro/specs/switch-lifecycle/design.md).

### The seal

Each letter gets a random key K. K is split into a keepsake half A (random) and a vault half B = K xor A. The server stores the ciphertext, B and a hash of A. At release the recipient's browser joins A and B and decrypts locally; the ciphertext is bound to the letter id so it cannot be swapped. Limits, stated plainly in the app: vault custody is readable by the operator; a compromised device can read letters as they are written; witnesses who collude can release early; the server sees names, emails and timing; browser crypto trusts the code it is served.

## Adapters

| Port | Local (default, free) | Real (written and type-checked, not run in tests) | Env |
|---|---|---|---|
| Clock | `MachineClock` (time machine) | `SystemClock` | `DMS_CLOCK=machine\|system` |
| Store | `MemoryStore` + JSON file | `KvStore` (Workers KV) | `DMS_STORE=file\|memory` |
| Mail | `OutboxMailer` (local outbox) | `ResendMailer` (HTTPS) | `DMS_MAILER=outbox\|resend` |

The time machine and outbox routes exist only when both local adapters are active.

## Deploy target (free, not deployed)

Cloudflare Workers free plan: static assets for the web app, one KV namespace, and a Cron Trigger every 15 minutes that ticks every vigil. Mail through Resend's free tier. See `wrangler.toml` and `src/worker/index.ts`. To deploy you would create the KV namespace, set its id in `wrangler.toml`, `wrangler secret put RESEND_API_KEY`, then `npm run build && wrangler deploy`.

## Built with Kiro

- **Steering** in [`.kiro/steering`](.kiro/steering): product, tech and structure rules that every Kiro session reads.
- **Spec** in [`.kiro/specs/switch-lifecycle`](.kiro/specs/switch-lifecycle): EARS requirements, design (with Mermaid state diagram and the key scheme) and the task plan the build followed.
- **Hooks** in [`.kiro/hooks`](.kiro/hooks): unit tests on every save, typecheck and tests before the agent stops, and a crypto-custody review prompt whenever `src/core/crypto.ts` changes.
- **[KIRO-LOG.md](KIRO-LOG.md)**: every `kiro-cli` call, its prompt, its output and what was learned.

## Accessibility

WCAG AA contrast on every text colour, full keyboard use with a skip link and visible ember-glow focus, every state and deadline stated in text beside the candle, status changes announced to screen readers, and `prefers-reduced-motion` turns off flicker, embers and seal animations.

## License

MIT © 2026 Stubborn Otter Software
