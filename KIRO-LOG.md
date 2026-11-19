# Kiro log

How Kiro was used on Dead Man's Switch, call by call, with the evidence for each. Tool: `kiro-cli 3.4.0` (V3 agent).

**Who built what.** The initial build and the security hardening were done with Claude Code, working from the Kiro steering files and a spec written in Kiro's format. Kiro then reviewed that spec against the code, rewrote every acceptance criterion in strict EARS form, added the gap tasks in group 9, and built tasks 8.6 and 6.11 itself, running the typecheck and unit tests before it stopped (Pass 2 below). Every later Kiro call is added here with its prompt, duration, credits, files and test results.

## Kiro features at a glance

| Feature | Where | What it produced | Evidence | Tests after |
|---|---|---|---|---|
| **Spec review** (Pass 2) | [`.kiro/specs/switch-lifecycle/`](.kiro/specs/switch-lifecycle) | Every criterion in Requirements 1 to 11 in strict EARS form, one behavior each; new criteria for headers, the silence window, announcements and the seal; 12 new gap tasks (9.1 to 9.12); tasks marked done only where code and a test exist | 2026-11-19, 02:01 to 02:06 UTC, exit 0, 5.23 credits | Vitest 79 of 79 (68 before), Playwright 11 of 11, 0 axe violations |
| **Spec-driven tasks** (Pass 2) | `tasks.md` 8.6 and 6.11 | A `RateLimiter` port with in-memory and Cloudflare adapters, Worker selection, a commented `wrangler.toml` block; a wax seal that draws each mark as one glyph; three new test files | Same call | Same run |
| **Steering** | [`.kiro/steering/`](.kiro/steering) | `product.md` (false alarms are the worst failure; the server should not read letters), `tech.md` (ports and adapters, crypto and token rules), `structure.md` (layout). Kiro read all three first and updated `tech.md` and `structure.md` for the new port. Two conditional files were added after Pass 2 with Claude Code: `crypto.md` (key custody, loaded when the crypto, seal or letter pages change) and `a11y.md` (accessible gothic, loaded for web files); no Kiro call has run with them yet | Read at the start of every call | n/a |
| **Hooks** | [`.kiro/hooks/`](.kiro/hooks) | `test-on-save` (unit tests on save), `verify-before-stop` (typecheck and tests before the agent stops), `crypto-guard` (an agent hook that re-states the key-custody rules when `crypto.ts` changes). Kiro validated the format and split the crypto hook into its own file. A fourth hook, `spec-drift` (after each spec task), the custom agent in `.kiro/agents/` and the MCP servers in `.kiro/settings/mcp.json` were added after Pass 2 with Claude Code; `tests/unit/kiro-config.test.ts` checks their schema, matchers and commands | Hook output from a live session is not yet captured | n/a |
| **Prompts on file** | [`.kiro/prompts/`](.kiro/prompts) | The exact prompts for the spec generation and for Pass 2, so every call can be re-run | `scripts/kiro-spec.sh` re-runs the spec generation | n/a |

## Pass 2: spec review and two tasks built by Kiro

- **When:** 2026-11-19, 02:01 to 02:06 UTC (4 min 48 s wall time, under a 25-minute cap; exit code 0).
- **Command** (repository root, stdin closed):
  `kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write,run_command "<prompt>" </dev/null`
- **Prompt:** verbatim in [`.kiro/prompts/pass-2-review-and-build.txt`](.kiro/prompts/pass-2-review-and-build.txt). Four jobs: review the spec against the code, build tasks 8.6 and 6.11, validate the hooks, and log the pass.
- **Credits:** 5.23 (`/usage` read 59.13 before the call and 64.36 after).
- **Kiro ran itself:** `npm run typecheck` and `npm test`, and fixed what it broke.
- **Full suite afterwards:** `npm run check` (typecheck, unit, build, Playwright with the axe audit): Vitest 79 of 79 (68 before the pass), Playwright 11 of 11, no axe violations. A screenshot of the landing page confirmed each rite seal shows one numeral (I, II, III). Nothing needed fixing.
- **Design choice Kiro made:** if the Cloudflare binding throws, the adapter lets the request through rather than locking witnesses and recipients out of their links (fail open). The 256-bit tokens remain the real defence.

### Spec changes
- **requirements.md, criteria tightened:** compound criteria were split; the first part kept its number and the rest were appended at the end of the requirement (1.6-1.8, 2.8-2.10, 3.7-3.9, 4.5-4.7, 5.6-5.7, 6.9-6.17, 7.10-7.16, 8.4, 9.6-9.8, 10.6-10.10, 11.4-11.15). Misused keywords were corrected (1.5 and 6.8 were `WHILE`/`WHERE` and are now `IF ... THEN`; 6.3 is now `IF`). New criteria cover behavior the code had but the spec did not state: Permissions-Policy and COOP headers (11.9, 11.10), the silence window starting when witnesses are asked (6.17), screen-reader announcements (4.7, 10.8), decorative graphics hidden from assistive technology (10.9) and the single-glyph seal mark (10.10). 11.13-11.15 describe the rate-limiter binding.
- **tasks.md, checked:** 8.6 (rate limiter swap point) and new 6.11 (single-glyph seal mark), both built in this pass.
- **tasks.md, unchecked because a test is missing:** 6.1, 6.4, 6.7, 6.8 and 7.6, so parent tasks 6 and 7 are open.
- **tasks.md, added:** group 9 (9.1 to 9.12) for the gaps: owner-token hash storage, default settings, the sanitiser module and its test, download and print, reduced motion and 360 px layout, the keepsake page, a wider axe audit, pause/resume/burn, the stage track and announcements, warning texts, release-link contents and released-vigil guards, and header coverage.
- **design.md:** four ports instead of three, a `RateLimiter` row in the adapter table, the Worker selection rule, a rewritten rate-limit paragraph, and the two new test files in the testing strategy.

### Source and test files
- `src/server/ports.ts`: the `RateLimiter` port and `RateLimitDecision`.
- `src/server/adapters/memory-rate-limiter.ts` (new): the previous in-memory fixed window, moved behind the port.
- `src/server/adapters/cloudflare-rate-limiter.ts` (new): wraps the Workers Rate Limiting binding, typed locally; maps `success: false` to blocked with the configured period as `Retry-After`; fails open if the binding throws.
- `src/server/security.ts`: `rateLimit` takes a `RateLimiter`; the 429 message and `Retry-After` are unchanged.
- `src/server/app.ts`: optional `rateLimiter` dependency, defaulting to `MemoryRateLimiter`.
- `src/worker/index.ts`: `Env.DMS_RATE_LIMITER` (optional) and `selectRateLimiter(env)`.
- `wrangler.toml`: a commented-out rate-limit binding block with an explanation; nothing changes until it is enabled.
- `tsconfig.worker.json`: covers the two new adapters and `security.ts`.
- `src/web/components/WaxSeal.tsx`: the mark is one `<text>` element, with the lit edge as a pale outline painted under its own fill (`paintOrder="stroke"`).
- `tests/unit/rate-limiter.test.ts` (new), `tests/unit/wax-seal.test.ts` (new), and Worker selection cases in `tests/unit/adapters.test.ts`.

### Hooks
- `verify-before-stop.json` holds only the `Stop` hook; `crypto-guard.json` (new) holds the crypto `PostFileSave` agent hook, with the `timeout` it lacked.
- All three files use `"version": "v1"`, the documented fields and `"enabled": true`. Matchers are unanchored at the front (`(^|/)...`) so they match relative and absolute paths.

### Open after Pass 2
- The rate-limit binding syntax in `wrangler.toml` is still to be checked against current Cloudflare documentation before it is enabled.
- The group 9 tasks are written and not yet built.

## Earlier calls: spec generation

The first two calls asked Kiro to write the spec from the steering files, using the prompt in [`.kiro/prompts/switch-lifecycle-spec.txt`](.kiro/prompts/switch-lifecycle-spec.txt).

- **Call 1:** `kiro-cli chat --no-interactive --trust-tools=fs_read,fs_write "<prompt>" </dev/null`. Kiro read the steering files, planned the three files and issued three `write` calls, which were denied (see Lessons); the call then ended on a service throttle (request `c530b852-022e-4d1e-9da5-60734a483885`). 5 min 28 s, no files.
- **Call 2:** the same prompt with `--trust-tools=read,write,fs_read,fs_write`; throttled before any tool call (request `32baf141-469e-4f9f-9c24-ce25dab456fe`). 20 s, no files.

The spec was then written in Kiro's format (EARS requirements, design, task checklist) from the same prompt and steering files, and Pass 2 had Kiro review and tighten it. `scripts/kiro-spec.sh` re-runs the generation with the corrected tool names so the output can be diffed against the reviewed spec.

## Lessons

- In Kiro CLI 3.x the write tool is named `write`; `fs_write` is only an alias and does not grant trust in `--no-interactive` mode. Trust the canonical names (`read`, `write`).
- A throttled call ends the session. Short, single-purpose prompts with an explicit file list finished in under five minutes; the long generation prompt did not.
- Asking Kiro to review a spec against working code and to check a task only when a test exists produced the most useful output per credit: it found twelve real gaps.
