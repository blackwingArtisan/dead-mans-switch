# Kiro log

How Kiro was used on Dead Man's Switch, call by call. Tool: `kiro-cli 3.4.0` (V3 agent), free plan.

## Project rules for Kiro (written first)

- `.kiro/steering/product.md`: who it is for, the seven-stage lifecycle, principles (false alarms are the worst failure; the server should not be able to read letters; accessible gothic), voice, out of scope.
- `.kiro/steering/tech.md`: stack, the adapter table (Clock, VaultStore, Mailer), crypto rules, token rules, commands, free deploy target.
- `.kiro/steering/structure.md`: folder layout and conventions.
- `.kiro/hooks/test-on-save.json`: `PostFileSave` on `src/**` and `tests/unit/**` runs `npm test`.
- `.kiro/hooks/verify-before-stop.json`: `Stop` runs typecheck and unit tests.
- `.kiro/hooks/crypto-guard.json`: a `PostFileSave` agent hook on `src/core/crypto.ts` re-states the key-custody rules.

## Call 1: generate the spec

- **Command** (from the repo root, stdin closed):
  `kiro-cli chat --no-interactive --trust-tools=fs_read,fs_write "<prompt>" </dev/null`
- **Prompt:** saved verbatim in `.kiro/prompts/switch-lifecycle-spec.txt`. It asks Kiro to read the steering files and write `.kiro/specs/switch-lifecycle/requirements.md` (EARS), `design.md` (architecture, state machine, key scheme, honest limits, Mermaid diagram) and `tasks.md`.
- **What happened:** Kiro read the steering files, planned the three files and issued three `write` calls. All three were denied: in CLI 3.x the write tool is named `write` (`fs_write` is only an alias) and the alias did not grant trust in non-interactive mode. Kiro then stopped with:
  `Error: Internal error (code -32603): Encountered an error in the response stream: The request was throttled by the service (request_id: c530b852-022e-4d1e-9da5-60734a483885)`
- **Duration:** 5 min 28 s. **Files produced:** none. **Credits:** no usage figure was printed.

## Call 2: retry with the canonical tool names

- **Command:** `kiro-cli chat --no-interactive --trust-tools=read,write,fs_read,fs_write "<same prompt>" </dev/null`
- **What happened:** throttled before any tool call:
  `Error: Internal error (code -32603): Encountered an error in the response stream: The request was throttled by the service (request_id: 32baf141-469e-4f9f-9c24-ce25dab456fe)`
- **Duration:** 20 s. **Files produced:** none. **Credits:** no usage figure was printed.

## Result

The two-call budget for this build was spent, so the spec in `.kiro/specs/switch-lifecycle/` was written by hand from the same prompt and the steering files, following Kiro's spec format (EARS requirements, design, task checklist). `scripts/kiro-spec.sh` re-runs the exact generation with the corrected tool names when credits allow; diff its output against the hand-written spec before replacing anything.

## Lesson

In Kiro CLI 3.x, trust the canonical tool names (`read`, `write`) in `--trust-tools`; the 2.x names alone are not enough in `--no-interactive` mode.

## Hardening pass (no further calls)

The security hardening (CSP and related headers, token-route rate limit, opt-in time machine) was added to the spec as Requirement 11, Requirement 9.4-9.5 and tasks 8.2-8.6. No further `kiro-cli` calls were made: the two-call budget for this build was already spent.

## Kiro pass 2 (kiro-cli v3, bonus credits)

### Spec changes (`.kiro/specs/switch-lifecycle/`)
- **requirements.md, criteria tightened:** every criterion in Requirements 1 to 11 is now in EARS form with one testable behavior. Compound criteria were split; the first part kept its number and the other parts were appended at the end of the requirement (1.6-1.8, 2.8-2.10, 3.7-3.9, 4.5-4.7, 5.6-5.7, 6.9-6.17, 7.10-7.16, 8.4, 9.6-9.8, 10.6-10.10, 11.4-11.15). Misused keywords were corrected (for example 1.5 and 6.8 were `WHILE`/`WHERE` and are now `IF ... THEN`; 6.3 is now `IF`). New criteria cover behavior the code already had but the spec did not state: Permissions-Policy and COOP headers (11.9, 11.10), the silence window starting when witnesses are asked (6.17), the screen-reader announcements (4.7, 10.8), decorative graphics hidden from assistive technology (10.9), and the single-glyph seal mark (10.10). 11.13-11.15 describe the rate-limiter binding.
- **tasks.md, checked:** 8.6 (rate limiter swap point) and new 6.11 (single-glyph seal mark), both built in this pass.
- **tasks.md, unchecked because code or test is missing:** 6.1 (reduced motion and print not tested), 6.4 (pause, burn, stage track not tested), 6.7 (keepsake page not tested), 6.8 (sanitiser, download, print not tested), 7.6 (axe audit skips the keepsake page and several states). Parent tasks 6 and 7 are unchecked as a result.
- **tasks.md, added:** 6.11, and group 9 (9.1 to 9.12) for the gaps: owner-token hash storage, default settings, sanitiser module and test, download and print, reduced motion and 360 px layout, keepsake page, wider axe audit, pause/resume/burn UI, stage track and announcements, warning texts, release-link contents and released-vigil guards, and header coverage.
- **tasks.md, order:** group 8 lines are now in numeric order (8.1 to 8.6); nothing was renumbered. 8.2 and 8.4 got their new criterion numbers.
- **design.md:** four ports instead of three, a `RateLimiter` row in the adapter table, the Worker selection rule, a rewritten rate-limit paragraph, and the two new test files in the testing strategy.

### Source and test files
- `src/server/ports.ts`: added the `RateLimiter` port and `RateLimitDecision`.
- `src/server/adapters/memory-rate-limiter.ts` (new): the previous in-memory fixed window, moved behind the port.
- `src/server/adapters/cloudflare-rate-limiter.ts` (new): wraps the Workers Rate Limiting binding, typed locally as `RateLimitBinding`; maps `success: false` to blocked with the configured period as `Retry-After`; lets requests through if the binding throws.
- `src/server/security.ts`: `rateLimit` now takes a `RateLimiter`; the 429 JSON message and `Retry-After` are unchanged.
- `src/server/app.ts`: new optional `rateLimiter` dependency, defaulting to `MemoryRateLimiter` built from `tokenRateLimit`.
- `src/worker/index.ts`: `Env.DMS_RATE_LIMITER` (optional) and exported `selectRateLimiter(env)`.
- `wrangler.toml`: commented-out `[[unsafe.bindings]]` ratelimit block with an explanation. Nothing changes until an operator enables it.
- `tsconfig.worker.json`: includes the two new adapters and `security.ts` so the Worker type-check covers them.
- `src/web/components/WaxSeal.tsx`: the mark is one `<text>` element. The pale offset copy is gone; the lit edge is a pale outline painted under the fill of the same text (`paintOrder="stroke"`). Tones and `aria-hidden` are unchanged.
- `tests/unit/rate-limiter.test.ts` (new): memory limit and reset, Cloudflare adapter mapping, 429 through the middleware with a fake binding, fail-open.
- `tests/unit/adapters.test.ts`: the Worker picks the binding when present and memory when absent.
- `tests/unit/wax-seal.test.ts` (new): mark "I" renders exactly one text glyph at 72 and 150 px, "II" renders once, the sigil has no text, the SVG is `aria-hidden`.
- Steering: `tech.md` and `structure.md` now name the `RateLimiter` port and both adapters.

### Hooks
- `verify-before-stop.json` now holds only the `Stop` hook.
- `crypto-guard.json` (new) holds the crypto `PostFileSave` agent hook, with a `timeout` it lacked.
- All three files use `"version": "v1"` and the documented fields. Added `"enabled": true` to each hook. Matchers are now unanchored at the front (`(^|/)...`) so they match whether the path given is relative or absolute.

### Could not do
- Did not run the Playwright suite (the operator will), so the seal change is not yet checked against the axe audit or by eye at 72 to 150 px. The unit test checks the markup only.
- Did not verify the Workers Rate Limiting binding syntax or the 10 or 60 second period limit against live Cloudflare documentation (no network use). Check the `wrangler.toml` block before enabling it.
- The new group 9 tasks are written but not built.

- **When:** 2026-11-19, 02:01 to 02:06 UTC (4 min 48 s wall time, under a 25-minute cap; exit code 0).
- **Command** (repo root, stdin closed):
  `kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write,run_command "<prompt>" </dev/null`
- **Credits used:** 5.23 of the 4,000 `kiroween2026` bonus credits (`/usage` read 59.13 before the call and 64.36 after).
- **What Kiro did:** reviewed the spec against the code, wrote the rate limiter port, both adapters, the Worker
  selection, the commented `wrangler.toml` block, the single-glyph seal and their tests, split the hooks, updated the
  steering, and ran `npm run typecheck` and `npm test` itself.
- **After the call (operator):** `npm run check` (typecheck, unit, build, Playwright with the axe audit):
  Vitest 79 of 79 (68 before the pass), Playwright 11 of 11, no axe violations. A screenshot of the landing page
  confirmed each rite seal now shows one numeral (I, II, III). Nothing needed fixing.
- **Design choice to note:** if the Cloudflare binding throws, the adapter lets the request through rather than
  locking witnesses and recipients out of their links (fail open). The 256-bit tokens remain the real defence.

### Exact prompt

> You are working in the Dead Man's Switch repository (TypeScript, React 18, Hono, Cloudflare Worker, Vitest, Playwright with axe). Read .kiro/steering/product.md, tech.md and structure.md first and follow them. Work only inside this repository. Do not add, remove or upgrade any npm dependency, do not run npm install, do not use git or wrangler, and do not deploy or call any network service. Keep wording professional and use invented sample people and example.com emails only.
>
> Do these four jobs in order.
>
> 1. Spec review. Read .kiro/specs/switch-lifecycle/requirements.md, design.md and tasks.md and compare them with the code in src/ and the tests in tests/. Tighten every acceptance criterion into strict EARS form (WHEN / WHILE / IF ... THEN / WHERE ... THE SYSTEM SHALL ...), one testable behavior per criterion, keeping existing numbering so task references stay valid (append new criteria at the end of a requirement). Mark a task [x] only if code and a test really implement it. Add a new unchecked task for every gap you find, with its requirement numbers. Task group 8 ("Hardening (next)") is out of order (8.6 before 8.3); renumber nothing, just order the lines by number.
>
> 2. Implement two real tasks (add each to tasks.md first, then build it, then check it off):
>    a. Rate limiter swap point (task 8.6, Requirement 11.3). src/server/security.ts keeps the token-route fixed-window counts in an in-memory Map, so a restart or a new Worker isolate resets them. Put the counting behind a small port, for example `interface RateLimiter { hit(key: string, now: number): Promise<{ allowed: boolean; retryAfterSec: number }> }` in src/server/ports.ts, keep the current in-memory fixed window as the default adapter (src/server/adapters/memory-rate-limiter.ts), and add a production adapter that wraps Cloudflare's Workers Rate Limiting binding (an env binding with `limit({ key }): Promise<{ success: boolean }>`), selected in src/worker/index.ts only when the binding is present, else falling back to the in-memory adapter. Type the binding locally (do not assume new types from @cloudflare/workers-types). Add the binding to wrangler.toml as a commented-out, clearly explained block, so nothing changes until an operator turns it on. The middleware keeps the same 429 JSON message and Retry-After header. Add Vitest tests: the memory adapter still limits and resets after the window; the Cloudflare adapter maps success false to a 429 using a fake binding; the Worker picks the binding when present and memory when absent. Update design.md and tech.md so the adapter table names this port and both adapters.
>    b. Duplicated seal numeral. On the landing page the three "rite" steps show wax seals marked I, II and III (src/web/pages/Landing.tsx). src/web/components/WaxSeal.tsx draws each mark twice, a pale copy offset by about one unit under the dark copy, to fake an embossed edge. For thin glyphs such as "I" and "II" the two copies separate and read as a doubled numeral ("I I"). Fix it so each mark reads as one stamped glyph at every size used in the app (72 to 150 px): for example draw the highlight as a stroke or blurred filter on a single text element, or use a clip so the highlight never shows as a separate glyph. Keep the SVG aria-hidden and keep the existing tones. Add a Vitest test (react-dom/server renderToStaticMarkup is fine, no new dependencies) that a rendered seal with mark "I" contains exactly one visible text glyph for the mark, and keep the Playwright axe audit passing.
>    Keep `npm run typecheck` green for both tsconfig.json and tsconfig.worker.json.
>
> 3. Hooks. Kiro's current hook format is .kiro/hooks/<name>.json with "version": "v1" and a "hooks" array (fields: name, description, trigger in PascalCase such as PostFileSave or Stop, matcher regex against the file path, action with type "command" + command or type "agent" + prompt, timeout in seconds, enabled). Check the two files in .kiro/hooks/ against that format and fix anything invalid. verify-before-stop.json mixes a Stop hook and an unrelated crypto PostFileSave hook; move the crypto hook into its own file, crypto-guard.json, so each file has one purpose. Keep the steering files accurate: update tech.md / structure.md / product.md where anything you changed makes them wrong (for example the new rate limiter adapter and file).
>
> 4. Append a new section "## Kiro pass 2 (kiro-cli v3, bonus credits)" to KIRO-LOG.md listing: each spec change (criteria tightened, tasks checked, tasks added), each source and test file you changed and why, the hook changes, and anything you could not do. Leave a line "Credits used: TO BE FILLED" for the operator to fill in.
>
> If run_command is available, run `npm run typecheck` and `npm test` when you finish and fix any failures you caused. Do not run the Playwright suite yourself; the operator will.
