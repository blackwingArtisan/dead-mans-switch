# Kiro log

How Kiro was used on Last Candle (repository `dead-mans-switch`), session by session, with the evidence for each. Tools: `kiro-cli 3.4.0` for the first spec calls and Pass 2, `kiro-cli 3.5.0` (V3 engine) from session 3 on.

**In short.** Kiro reviewed the spec against working code, rewrote every acceptance criterion in strict EARS form and found 12 untested behaviors. It then built all 12 and the tasks it added on the way, caught and fixed 2 real app defects, checked a Cloudflare binding against current docs through the Context7 MCP server, ran under the project's custom agent with its hooks firing on the record, gave the costume its final polish, measuring the grace room's colours against WCAG AA itself, scripted the story's false alarm and keepsake beats through the real witness and keepsake paths, built the story's ending from a single vibe prompt with no spec, wrote and built a second spec, the founder runbook, from a feature description, and wrote a third, an AWS runtime, from the AWS documentation through MCP and built its DynamoDB store, conflict retry and SES mailer against fakes, and turned an old optional task into the séance seal, a letter no one can open alone, built from its Shamir core to a 2-of-3 end-to-end test. Every session below lists its prompt, minutes, credits, files and test results. The first build and the security hardening came earlier, from Claude Code working from the Kiro steering files and a spec in Kiro's format (see [Who wrote what](#who-wrote-what)).

## Sessions

| Session | What Kiro did | Commit | Minutes | Credits | Kiro's lines | Tests after |
|---|---|---|---|---|---|---|
| Calls 1-2 | Tried to generate the spec; tool writes were denied under 3.4 and the calls ended on a service throttle | none | 5.8 | not recorded | 0 | n/a |
| [Pass 2](#pass-2-spec-review-and-two-tasks-built-by-kiro) | EARS review of Requirements 1 to 11, 12 gap tasks (9.1 to 9.12), built 8.6 (rate limiter port) and 6.11 (single-glyph seal) | `7ddc068` | 4.8 | 5.23 | 388 | Vitest 79, Playwright 11 |
| [3](docs/kiro-sessions/session-3-unit-and-api-gaps.md) | 9.1, 9.2, 9.3, 9.11, 9.12: token hash, defaults, the sanitiser module, release links, every header | `ac00f56` | 3.8 | 3.73 | 263 | Vitest 136, Playwright 31 |
| [4](docs/kiro-sessions/session-4-e2e-gaps.md) | 9.4 to 9.7: download and print, reduced motion and 360 px, the keepsake page, axe in every room; fixed a 360 px overflow and an unfocusable ledger | `b20f263` | 5.6 | 7.97 | 242 | Playwright 39 |
| [5](docs/kiro-sessions/session-5-dashboard-and-keyboard.md) | 9.8 to 9.10, plus 9.13 (keyboard-only core path) and 9.14 (the seal button's glow), which Kiro added | `2977dbf` | 6.9 | 6.75 | 325 | Playwright 47 |
| [6](docs/kiro-sessions/session-6-mcp-hooks-crypto.md) | 8.7: the rate-limit binding checked with Context7 and rewritten in the documented form; 9.15: `openLetter` refuses a wrong-length IV; the agent's hook format checked against the Kiro CLI docs | `69975ba` | 3.6 | 3.04 | 53 | Vitest 144, Playwright 47 |
| [7](docs/kiro-sessions/session-7-costume-polish.md) | Group 10, the costume polish it wrote into the spec: two hero buttons, a match-strike intro, the phone toast, the story caption and stage track kept clear, the reading light off the title, a green grace room it measured for contrast | `ed0ab49` | 18.8 | 49.42 | 914 | Vitest 144, Playwright 64 |
| [8](docs/kiro-sessions/session-8-story-beats.md) | Group 11, the story beats: a false alarm with a witness note through the real denial path, June's keepsake card before her seal breaks, an honest failure state, `?story=1`, and a measured 54-second label. Stopped by the 25-minute limit during its final test run, with every task built and ticked | `a3d4774` | 25.1 | 37.96 | 655 | Vitest 150, Playwright 74 |
| [9](docs/kiro-sessions/session-9-vibe-room-fills.md) | A vibe prompt with no spec: the story now ends as the room fills, with June and Theo each lighting a candle back and the line "One went out. Two were lit."; label re-measured at 68 s. Stopped by the 25-minute limit during its final test run | `768bee0` | 25.2 | 30.24 | 234 | Vitest 151, Playwright 77 |
| [10](docs/kiro-sessions/session-10-founder-runbook.md) | A second spec written from scratch, `founder-runbook` (5 requirements, 42 EARS criteria, 6 tasks), then built: the runbook template, the secret warning, Priya's demo letter and a yearly review nudge through the existing state machine | `f49c053` | 12.6 | 26.36 | 1,007 | Vitest 179, Playwright 82 |
| [11](docs/kiro-sessions/session-11-climax-and-room-objects.md) | Group 12: the candle keeps its height as its wax pools, a blackout and smoke plume when it goes out, the ledger as a book page, witnesses as small named candles, the terms on a brass plaque | `ce21ee7` | 11.9 | 22.64 | 436 | Vitest 187, Playwright 89 |
| [12](docs/kiro-sessions/session-12-aws-runtime-spec.md) | A third spec, `aws-release-runtime` (9 requirements, 44 EARS criteria, 5 task groups), checked against the AWS documentation through 11 aws-docs MCP calls; built its first group, a DynamoDB store with conditional versioned writes, tested against a fake client with a two-writer race. Minutes include a 0.6-minute first try that stopped when the AWS docs server was not yet trusted | `d69218d` | 13.2 | 9.99 | 731 | Vitest 202, Playwright 89 |
| [13](docs/kiro-sessions/session-13-aws-retry-and-ses.md) | AWS task groups 2 and 3: `SwitchService` retries a change up to 3 times when the store reports a conflicting write, sending mail only after a save succeeds; `SesMailer` against a fake SES v2 client, with header-safe display names | `22f2405` | 9.2 | 3.40 | 261 | Vitest 213, Playwright 89 |
| [14](docs/kiro-sessions/session-14-seance-seal-core.md) | Task 8.3 turned into Requirement 13, the séance seal (15 EARS criteria): the vault half split with Shamir's secret sharing across the witnesses so no one can open a letter alone; built the GF(256) core with seeded property tests, sealing, upload validation, shares on witness confirmation, discarded on any veto, and the release route | `1efa3af` | 11.8 | 14.53 | 641 | Vitest 232, Playwright 89 |
| [15](docs/kiro-sessions/session-15-seance-seal-finish.md) | Group 13 finished: the open page rebuilds the vault half from the witnesses' shares, the Write page offers the séance seal with a silence-window warning, the vigil page hands out each witness's share link, the witness page sends its share with the confirmation, and a Playwright test drives a 2-of-3 letter and a veto through the real pages. Stopped by the 25-minute limit during its final test run, with every task built and ticked | `4e9659a` | 25.4 | 5.77 | 365 | Vitest 232, Playwright 92 |
| **Total** | | | **183.7** | **227.03** | **6,515** | |

Kiro's lines are the lines it added in each commit, counted with `git show --numstat`, leaving out the lockfile and the session excerpts the developer copied into `docs/kiro-sessions/`.

## Who wrote what

| Who | What |
|---|---|
| Kiro | Everything in the sessions table: the EARS spec review, 34 tasks it wrote into the spec and built (9.1 to 9.15, 8.7, 10.1 to 10.8, 11.1 to 11.5 and 12.1 to 12.5), tasks 8.6 and 6.11, the whole founder-runbook spec and its 6 tasks, the AWS runtime spec, its store layer, the conflict retry and the SES mailer, Requirement 13 (the séance seal), its Shamir core and its pages, with the 2-of-3 end-to-end test, two app fixes, and every test those tasks needed |
| Claude Code | The first build and the security hardening (before Pass 2), the copy, the README and these logs, running the shell and the commits, and 25 lines in three small fixes around Kiro's work. First, 11 lines in Kiro's own change: a screenshot at 360 px showed Kiro's width fix clipped the seal button's glow (sent back to Kiro as 9.14), and Kiro's fix for that clipped the stamp's sides on desktop, so the clip was limited to screens of 520 px or less (`3d3394e`, 7 lines added, 4 removed). Second, a separate commit before session 8's (`b4bac7f`, 10 lines added, 1 removed): the in-memory rate limiter never reopened its window after the demo clock was reset, which the longer suite after session 8 exposed as 429s. Third, after a screenshot review of session 11 (`09d4d4f`, 2 lines added, 1 removed): the new witness candle and tag split email addresses mid-word on a 360 px phone, so the tag now wraps below the address |
| The developer | The idea, the product decisions, and review of each commit |

## Kiro features, with evidence

| Feature | Where | Evidence |
|---|---|---|
| **Specs** | [`.kiro/specs/switch-lifecycle/`](.kiro/specs/switch-lifecycle) and [`.kiro/specs/founder-runbook/`](.kiro/specs/founder-runbook) | Pass 2 rewrote the first into EARS form, and sessions 3 to 8, 11, 14 and 15 built its tasks and added groups 10 to 13. Kiro wrote the second from a feature description in session 10 and built it in the same session. It wrote the third, [`.kiro/specs/aws-release-runtime/`](.kiro/specs/aws-release-runtime), in session 12 from the AWS documentation and built its first three task groups in sessions 12 and 13 |
| **Steering** | [`.kiro/steering/`](.kiro/steering) | `product.md`, `tech.md` and `structure.md` load in every session. `crypto.md` and `a11y.md` load only when a matching file is in play; they were in the workspace from sessions 3 to 5, and in session 6 Kiro reported `crypto.md` arriving when it read `src/core/crypto.ts` |
| **Hooks** | [`.kiro/hooks/`](.kiro/hooks) and the agent's SessionStart hook | Session 6's log: `hooks.reload.loaded {"read":4,"registered":4}` and 8 `ContextualHookInvoked` events. By hook: SessionStart (open tasks) 1, quoted by Kiro; `crypto-guard` 1, quoted by Kiro; `test-on-save` 5, each just after a save to `src/` or `tests/unit/`; `verify-before-stop` 1, as the turn ended. `spec-drift` (PostTaskExec) has not fired in a CLI session yet. Across sessions 6 to 15 the logs record 30 hook runs: SessionStart in all ten, `verify-before-stop` at the end of the seven that finished inside the time limit, `crypto-guard` once, `test-on-save` five times in session 6, one more in session 8 five more during session 12's writes, and one during session 15's build that the log does not name |
| **Custom agent** | [`.kiro/agents/dead-mans-switch.json`](.kiro/agents/dead-mans-switch.json) | Ran sessions 3 to 15; Kiro checked its hook format against the Kiro CLI v3 docs in session 6 |
| **MCP** | [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json) | Session 6: both servers connected (`mcp.connect.ok` for `context7` and `aws-docs`); 4 Context7 calls (2 `resolve-library-id`, 2 `query-docs`) for the Workers Rate Limiting binding and the Kiro agent hook format. Session 12: 13 calls, 11 to the AWS documentation server (4 searches, 7 page reads for DynamoDB, SES v2, EventBridge Scheduler and Lambda, each cited in the spec's design) and 2 to Context7 for the Hono Lambda adapter |
| **Vibe coding** | [Session 9](docs/kiro-sessions/session-9-vibe-room-fills.md) | One conversational prompt with no spec, IDs or task list built the story's ending, tests included, to show the other way of working beside spec-driven sessions |
| **Prompts on file** | [`.kiro/prompts/`](.kiro/prompts) and each session excerpt | Every prompt is kept verbatim, so each call can be re-run |

**What Kiro's tests caught in the app.** Two real defects, each fixed in the app, not the test: the unpressed wax stamp on the writing desk made the page 30 px too wide on a 360 px phone, and the vigil's scrolling ledger could not take keyboard focus, an axe `scrollable-region-focusable` violation in the grace room (`b20f263`). Kiro also said, unprompted, that ticking 6.1 overstated the evidence because nothing tested full keyboard use (Req 10.2); the next session added and passed that test as 9.13.

## Group 9: built by Kiro

Group 9 was the list of untested behavior Kiro found when it reviewed the spec against the code in Pass 2. Kiro built it task by task under the `dead-mans-switch` agent, with one kiro-cli call per layer: unit and API tests, then end-to-end tests, then the dashboard and keyboard tests. Each call was `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@aws-docs,@context7 "<prompt>"` with a 25-minute limit. Kiro ran the typecheck, Vitest, the build and Playwright itself; the developer ran them again from a fresh clone before each commit. The prompts and Kiro's output are in [docs/kiro-sessions/](docs/kiro-sessions).

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
- With kiro-cli 3.5 and `--v3 --trust-workspace`, `--trust-tools=fs_read,fs_write,run_command` granted writes and shell in non-interactive mode; the earlier denial was under 3.4 without `--trust-workspace`.
- Grouping tasks by layer (unit, end-to-end, dashboard) kept each call between 4 and 7 minutes. Screenshot every UI change Kiro makes: its width fix passed every test and still cut the button's glow.
