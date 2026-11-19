# Kiro session 3: group 9 unit and API tests (tasks 9.1, 9.2, 9.3, 9.11, 9.12)

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@aws-docs,@context7 "<prompt>" </dev/null` (not `--trust-all-tools`)
- Duration: 3 min 46 s; exit code 0; credits used: 3.73 (kiroween2026 balance 220.84 before, 224.57 after)
- No MCP calls in this session.

## Prompt

```text
Build tasks 9.1, 9.2, 9.3, 9.11 and 9.12 of .kiro/specs/switch-lifecycle/tasks.md in this session, in that order, following requirements.md and design.md in the same folder and the steering files. The developer asked for these five together because they are all unit and API tests (plus the sanitiser move in 9.3); treat each as its own task: read the requirement it cites, write or extend the test, make it pass, then tick its box.

Rules:
- Tests prove the behavior the requirement states. If the code and the requirement disagree, fix whichever is wrong and say which in your summary. Do not weaken a test to make it pass.
- 9.3: move the letter sanitiser out of src/web/pages/Open.tsx into src/web/lib/sanitize.ts with no change in behavior, import it back into Open.tsx, and unit test that scripts, event handlers and unknown tags are stripped.
- Every new test title names its criteria, such as "(Req 7.7)", in the style the existing tests use.
- When a task in groups 6 or 7 only waited on one of these gap tasks, tick it too, and say so.
- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=3826 npx playwright test` with run_command (always set that port; never use another), and fix anything that fails.
- Do not run git commands; the developer commits. Leave README.md, KIRO-LOG.md and CHANGELOG.md alone.

Finish with a short summary: the files you wrote or changed, the test counts before and after, and anything in the spec you had to change.
```

## Session output

Kiro's narration and tool calls as printed by kiro-cli. Tool status lines and client log lines are removed; nothing else is edited.

```text
I'll start by looking at the existing tests and the sanitiser.
[tool] Run Command
[tool] Run Command
[tool] status: Failed: Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
The `sed` failed on the macOS syntax, so I'll add the import with the edit tool.
[tool] Replace in File
[tool] status: Pending
[tool] Run Command
That failure is a bug in my test. I didn't await the first `knock`, so it ran in parallel and used up the limit. I'll fix the test.
[tool] Run Command
[tool] Run Command
[tool] Run Command
Everything passes. Now I'll tick the five boxes.
[tool] Run Command
Tasks 9.1, 9.2, 9.3, 9.11 and 9.12 are done and ticked. `npm run typecheck`, `npm test`, `npm run build` and `E2E_PORT=3826 npx playwright test` all pass.

**Test counts:** unit tests went from 120 in 19 files to 136 in 20 files. The Playwright count is unchanged at 31 runs.

**Files changed**
- **`src/web/lib/sanitize.ts` (new):** holds `ALLOWED_TAGS` and `sanitizeLetterHtml`, moved out of `Open.tsx` with the same DOMPurify options.
- **`src/web/pages/Open.tsx`:** imports `sanitizeLetterHtml` instead of calling DOMPurify directly.
- **`tests/unit/sanitize.test.ts` (new, 5 tests, Req 7.7):** checks that scripts, event handlers, other attributes, unknown tags and mutation-style payloads are stripped, and that allowed tags are kept.
- **`tests/unit/api.test.ts` (7 new tests):**
  - 9.1: only the SHA-256 hash of the owner token is stored (Req 1.4, 1.7).
  - 9.2: a new vigil gets the default settings (Req 1.2).
  - 9.2: 401 on every author route, with no token and with a wrong one, leaves the store and outbox unchanged (Req 1.5, 1.8).
  - 9.2: a rejected vigil creation stores nothing.
  - 9.11: no keepsake-custody release email carries A, and the vault-custody link does (Req 7.11, 7.12).
  - 9.11: a released vigil answers 409 to every change and changes nothing (Req 7.9).
- **`tests/unit/security.test.ts` (4 new tests):**
  - The closed Permissions-Policy and Cross-Origin-Opener-Policy are sent on 200, 404, 401 and 429 responses.
  - `withSecurityHeaders` sets every header on an immutable response.
  - CSP blocks plugins, framing and base-tag changes by directive (Req 11.4, 11.5).
  - CSP limits scripts and connections to the page's own origin (Req 11.1, 11.6).
- **`package.json` and the lockfile:** I added `jsdom` as a dev dependency. DOMPurify needs a DOM, and the sanitiser test opts in per file with `// @vitest-environment jsdom`, so `vitest.config.ts` is unchanged.
- **`tasks.md`:** boxes 9.1, 9.2, 9.3, 9.11 and 9.12 are ticked.

**Spec and code:** I found no disagreement, so I changed nothing in the spec or the code beyond the sanitiser move.

**Groups 6 and 7:** I ticked none. Task 6.8 still waits on 9.4 as well as 9.3, and 6.1, 6.4, 6.7 and 7.6 wait on other gap tasks (9.5 to 9.10).

The README test counts are now stale (120 unit tests in 19 files). I left README.md alone as you asked, so `scripts/sync-counts.mjs` will need a run.
```
