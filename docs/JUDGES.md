# Evidence map for judges

Each judging criterion, and the file, test, commit or picture that proves each claim. Everything here can be checked from a fresh clone.

## Run it in one command

```bash
npm ci && npm run check   # typecheck, unit suite, production build, Playwright with the axe audit
```

Expected: the counts in the README's [Run and test it](../README.md#run-and-test-it) line, all passing, with zero axe violations.

No install needed for a first look: the [live demo](https://dead-mans-switch-ce1.pages.dev) runs the same API inside your browser. Press **Play the whole story**, or open [the story link](https://dead-mans-switch-ce1.pages.dev/?story=1) to start it at once. `npm run smoke:live` checks that deploy on desktop and phone.

## Potential impact

| Claim | Evidence |
|---|---|
| The pain is real and sourced | The README's [Why it matters](../README.md#why-it-matters): the 1Password survey (63% found the accounts of the person who died harder to get into than expected), CDC deaths, Gallup wills, the SBA's 29.8 million businesses with no employees, each linked and dated |
| People already pay for this category | Published prices for Everplans, Trustworthy and GoodTrust in `src/web/components/Comparison.tsx` (`PAID`), checked 2026-11-18 |
| The numbers are bottom up | `HOSPICE_CHANNEL` and `COST_PER_VIGIL` in `src/web/components/Comparison.tsx`: MedPAC's 1.7 million hospice patients, then one assumption per line; about 2 cents a year to keep a vigil at published Cloudflare and Resend prices |
| Three people it is for | Mara, Priya and Ruth on the landing page; two of them are one-click demo vigils (`DEMO`, `FOUNDER_DEMO` in `src/web/lib/seal.ts`) |
| It is built to outlive its maker | The sealed export and [`offline-open.html`](../src/web/public/offline-open.html), tested in `tests/e2e/lifecycle.spec.ts` ("the sealed export and the saved offline page open a letter with no server") |

## Technological implementation

| Claim | Evidence |
|---|---|
| Real cryptography, split key | `src/core/crypto.ts`: AES-GCM-256, a fresh 96-bit IV, the letter id as additional data, K split into A and B = K xor A; `tests/unit/crypto.test.ts` covers round trip, tamper, wrong half and wrong IV length |
| The server never holds enough to read a keepsake letter | `tests/unit/api.test.ts` and task 9.11: no release email in keepsake custody carries A; `tests/e2e/lifecycle.spec.ts` (Req 3.6, 3.8, 3.9): the keepsake page never sends A |
| A pure state machine behind ports | `src/core/machine.ts` with `tests/unit/machine.test.ts`; four ports in `src/server/ports.ts`, filled by Node, Cloudflare Worker and in-browser adapters, plus a DynamoDB store with conditional versioned writes (`tests/unit/dynamodb-store.test.ts`, a two-writer race where exactly one wins), a service that retries a lost race (`tests/unit/service-retry.test.ts`) and an SES mailer (`tests/unit/ses-mailer.test.ts`), all against fakes |
| Hardened responses | `src/server/security.ts` (CSP, Permissions-Policy, COOP, rate limits) with `tests/unit/security.test.ts` |
| Spec-driven, traceable | Three specs, [`switch-lifecycle`](../.kiro/specs/switch-lifecycle), [`founder-runbook`](../.kiro/specs/founder-runbook) and [`aws-release-runtime`](../.kiro/specs/aws-release-runtime); every EARS criterion has an ID, and tests name the criteria they prove, such as "(Req 10.5)" or "(Founder Req 2.3)" |
| Kiro built and checked real parts | [KIRO-LOG.md](../KIRO-LOG.md) and [docs/kiro-sessions/](kiro-sessions); commits marked `Built-with: Kiro` (`git log --grep "Built-with: Kiro"`) |
| Hooks and MCP ran on the record | [Session 6](kiro-sessions/session-6-mcp-hooks-crypto.md): 8 hook runs and 4 Context7 calls, quoted from Kiro's own session log; 28 hook runs across sessions 6 to 14; [session 12](kiro-sessions/session-12-aws-runtime-spec.md): 11 AWS documentation calls behind the AWS spec |
| Spec work and vibe work side by side | [Session 10](kiro-sessions/session-10-founder-runbook.md): Kiro wrote a spec from a feature description and built it in one session; [session 9](kiro-sessions/session-9-vibe-room-fills.md): one chat-style prompt with no spec built the story's ending |

## Design

| Claim | Evidence |
|---|---|
| The candle is the state machine and the room wears it | [The costume](../README.md#the-costume) stills in `docs/media/`; `tests/e2e/lifecycle.spec.ts` ("each room has its own colour ...", "the room dies and relights with the candle"); `tests/e2e/climax.spec.ts` (the blackout and smoke when it goes out); `tests/e2e/room-objects.spec.ts` (the ledger page, witness candles and brass plaque) |
| Accessible gothic | `tests/e2e/a11y.spec.ts`: axe WCAG 2.2 AA on every page and every room, zero violations; `tests/e2e/keyboard.spec.ts`: the core path by keyboard alone |
| Works on a phone | `tests/e2e/smoke.spec.ts` and `phone.spec.ts` on a Pixel 7 profile: no sideways scroll at 360 px |
| Reduced motion respected | `tests/e2e/smoke.spec.ts` (Req 10.3): the room holds still under reduced motion |

## Idea

| Claim | Evidence |
|---|---|
| The recipient holds half the key | `src/core/crypto.ts`, the [How the seal works](../src/web/pages/HowItWorks.tsx) page and its diagram |
| Any witness can veto | Req 6.4 in the spec; `tests/unit/machine.test.ts` (witness denial cancels); the story's false alarm, where Silas stops a release with a note (`tests/e2e/story.spec.ts`, Req 12.1 to 12.5) |
| Not a timer, a vigil | The thesis line on the landing page and in the share card (`src/web/index.html`) |
| Different from the tools people have | The seven-tool comparison in the README and on the honest page, each row checked at the product's own pages |

## Presentation

| Claim | Evidence |
|---|---|
| A hands-off demo | **Play the whole story** on the landing page, about 68 seconds, through a false alarm to two candles lit back; `tests/e2e/story.spec.ts` plays it end to end and times a real run against the label |
| An honest failure state | If the demo stops answering, the story says so and offers "Reset the demo" and "Play it again" (`tests/e2e/story.spec.ts`, Req 12.8 to 12.10) |
| A live URL | [dead-mans-switch-ce1.pages.dev](https://dead-mans-switch-ce1.pages.dev), checked by `npm run smoke:live` |
| An honest log | [KIRO-LOG.md](../KIRO-LOG.md): who wrote what, minutes, credits and lines per session |
