# Kiro session 14: the séance seal, specified, and its Shamir core

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@aws-docs,@context7 "<prompt>" </dev/null` (not `--trust-all-tools`)
- Date: 2026-11-23, 00:29 to 00:42 UTC. Duration: 11.8 min; exit code 0; credits used: 14.53 (account usage 897.68 before, 912.21 after)
- Result: Requirement 13 (15 EARS criteria), a design section and task group 13 written; tasks 13.1 to 13.3 built and ticked, 13.4 built and left open; Vitest 213 to 232 (31 files), Playwright 89; commit `1efa3af` (641 lines added, 106 removed)

## What Kiro built

Task 8.3 had waited since the first spec: "Optional Shamir split of the vault half across witnesses". Kiro turned it into Requirement 13, the séance seal, a third custody mode in which no one can open a letter alone:

- the author's browser splits the vault half B with Shamir's secret sharing over GF(256) into one share per witness, any k of which rebuild it (k is the vigil's required confirmations);
- the server stores only the ciphertext and IV and refuses any vault half, keepsake half or share at upload;
- a witness sends their share with their confirmation; any "they still live", a check-in or a new round discards every share;
- the release link returns the shares, and refuses, unspent, with fewer than k; the recipient's browser rebuilds B, then the key with their keepsake half A.

Kiro chose the details itself and recorded them in the design: shares are per letter, since each letter has its own B; each share carries its x and k so that combining refuses too few, mixed or duplicate shares on its own; the witness list and the quorum are locked while a séance letter is unsealed, so the split cannot drift from the quorum; and séance letters are left out of the sealed export, which cannot open them.

Built and tested: `src/core/shamir.ts` (no dependency) with 7 seeded property tests from 1-of-1 to 5-of-7 (any k shares rebuild the secret, k-1 do not, order does not matter, bad shares are refused); sealing and opening in `crypto.ts`; the vault model, upload validation, the witness confirm route and the release route, with 12 API and service tests including a veto that discards the shares. The open page can already rebuild B (13.4), but Kiro left that box open until an end-to-end test proves it. The witness and author pages (13.5) and the 2-of-3 Playwright test (13.6) were left for the next session.

## Developer review

The developer read the core and server diff and reran the full suite from a fresh clone of `1efa3af`: Vitest 232 of 232, Playwright 89 of 89.

Kiro reported that the agent's preloaded context (steering plus every spec file) had reached the Kiro CLI's 100,000-character limit, which `tests/unit/kiro-config.test.ts` enforces, and that it had cut the AWS runtime design down to fit. The developer changed the agent to preload only the steering and each spec's requirements and tasks, opening a design when a task needs it, and restored the AWS design in full (`45a22e4`).

## What Kiro's own log recorded

| Evidence | Log line | What it shows |
|---|---|---|
| Hooks loaded | `hooks.reload.loaded {"read":4,"registered":4}` at 00:29:53 | The four workspace hooks were registered |
| Hook runs | 2 `ContextualHookInvoked` events: 00:29:54 and 00:41:44 | The SessionStart task list and `verify-before-stop` as the turn ended |
| MCP | no MCP tool calls | |

## Prompt

```text
Session 15 for Last Candle (repository dead-mans-switch): the séance seal, task 8.3 of .kiro/specs/switch-lifecycle ("Optional Shamir split of the vault half across witnesses"). Goal: a letter the author can choose to seal so that no one can open it alone: not the server, not the recipient, not any single witness.

Design to specify (adjust details if the code argues otherwise, and say so in design.md):
- A third custody mode per letter, `witnesses` (shown as "Séance seal"). In the author's browser, the vault half B is split with Shamir's secret sharing over GF(256) into n shares, one per witness, any k of which rebuild B; k is the vigil's `witnessesRequired` (capped at the number of witnesses, as Req 6.3 already does) and n the number of witnesses at sealing time. The server never stores B whole for these letters, only the ciphertext and IV. The recipient still holds half A as a keepsake, as in keepsake custody.
- Each witness gets their share the way a recipient gets a keepsake: from the author, as a share link or card whose share sits in the URL fragment, never sent to the server at sealing time. The server-sent witness emails (Req 6.9, 6.10) stay as they are.
- When a witness confirms on their round link, their page sends their share with the confirmation (from a share link opened on that device, or pasted). The server keeps confirmed shares only while the vigil is in `confirm`. Any witness answering "they still live" still stops everything (Req 6.4, 6.12, 6.13) and the server discards every share it was sent. A confirmation without a share still counts toward the quorum for non-séance letters.
- On release, the letter route returns the k shares instead of a vault half; the recipient's browser rebuilds B, then K = A xor B. Fewer than k shares must fail with a plain message, never garbage plaintext.
- The silence window cannot release a séance letter (there are no shares without witnesses); say so in the spec, and warn the author when choosing the mode if a silence window is on.
- Be honest in design.md about what the server sees: it holds fewer than k shares before quorum, so a breach before release reveals nothing; after quorum it has seen k shares.

This session: add Requirement 13, "The séance seal", with EARS criteria to requirements.md, a design section, and task group 13 in tasks.md (13.1 to 13.6, mark 8.3 as covered by group 13). Then build in order, as far as time allows:
13.1 `src/core/shamir.ts`: split and combine over GF(256), pure, no dependency. Property tests in tests/unit/shamir.test.ts with many random secrets and (k, n) pairs from 1-of-1 to 5-of-7: any k shares rebuild the secret, any k-1 shares do not, shares are order-independent, duplicate or malformed shares are refused. Use a seeded random loop; install no new package.
13.2 Sealing: `sealLetter` (or a sibling) produces shares for `witnesses` custody; types, validation and the vault model accept the mode; the server refuses a vault half for this mode.
13.3 Server: the witness confirm route accepts an optional share, validated, stored per witness for the round; denial and the start of a new round discard them; the letter route returns the shares after release; unit and API tests, including the veto discarding shares.
13.4 Open page: rebuild B from the shares and open the letter; a plain message when shares are missing or wrong.
13.5 Write page option and the witness share links on the vigil page, with the silence-window warning.
13.6 Playwright: a 2-of-3 séance letter where one witness confirming is not enough, the second confirmation releases it and the recipient opens it; and a veto after one confirmation that keeps it sealed.
Stop where time runs out and leave the rest unticked; a later session continues.

Rules:
- crypto.md applies to every file you touch here, and a11y.md to every web file: every new control is labelled, announced and reachable by keyboard; axe stays at zero violations.
- Do not change behavior for keepsake and vault custody, the demo vigils or Play the whole story. Every new test title names its criteria, such as "(Req 13.2)". Do not weaken a test.
- Keep `tests/unit/kiro-config.test.ts` green: the agent's combined context must stay under 100,000 characters. Keep your spec text tight, and trim the aws-release-runtime design's prose if you must; do not raise the limit.

Time budget: this session is stopped at 25 minutes. While building, run only `npx vitest run` on the test files you touch. Run the full gate once, at the end (the Playwright suite takes about 6 minutes). If you reach 15 minutes, finish the task you are on, run the full gate and stop.

- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=4215 npx playwright test` with run_command. Always set E2E_PORT=4215; never use another port. Fix anything that fails.
- If a hook runs during the session, quote its name and output in your summary. List any MCP calls you made.
- No git commands; the developer commits. Leave README.md, KIRO-LOG.md, CHANGELOG.md and .kiro/settings/mcp.json alone.

Finish with a short summary: requirements and criteria written, tasks built and left, files changed, and test counts before and after.
```

## Session output

Kiro's narration and summary, with tool calls collapsed into counts.

```text
I'll start by checking the current code and the size budget.
[6 tool calls]
Context is at the limit, so I'll trim the aws design prose first.
[15 tool calls]
Spec is done and the config test passes. Now 13.1.
[1 tool calls]
The bound was miscalculated. 400 uniform draws from 256 values give about 202 distinct values on average, so the threshold needs to be lower.
[17 tool calls]
Session 15 built the séance seal's spec, its shamir core, and the sealing, upload and server path. The browser sealing code is written but untested. The open-page change is wired but not tested end to end, and the Write page and e2e work are not built. Typecheck, `npm test` (232 tests), `npm run build` and `E2E_PORT=4215 npx playwright test` (89 passed) all pass.

**Spec**
- Requirement 13 has 15 criteria, in `.kiro/specs/switch-lifecycle/requirements.md`.
- The design section is "The séance seal (Req 13)".
- Task group 13 (13.1 to 13.6) is added, and 8.3 now says "covered by group 13".

**Design adjustments (recorded in design.md)**
- Shares are per letter, because each letter has its own B. A witness holds one share per séance letter.
- A share is 34 bytes (`x`, `k`, 32 data), so `combine` can refuse too few, mixed or duplicate shares itself.
- While an unreleased séance letter exists, the witness list and `witnessesRequired` are locked (Req 13.14), so the split can't disagree with the quorum.
- A silence release still mints open links, but the séance letter has no shares, so the break route refuses in plain words.
- Séance letters are left out of the sealed export, since the offline page can't open them.

**Context limit**
- The agent's context was 101.8k characters after my additions, so I trimmed the aws-release-runtime design prose.
- I first corrupted that file with a bad slice, then repaired it. No requirement changed, and `kiro-config.test.ts` passes. The margin is under 100 characters, so any further spec text will need another trim.

**Built and ticked**
- 13.1: `src/core/shamir.ts`, with 7 seeded property tests covering 1-of-1 up to 5-of-7.
- 13.2: `sealLetter` takes an optional `{ k, n }` split and `openSeanceLetter` is added. Types, the vault model, `LetterView.seance` and the upload validation accept `witnesses` custody, and the server refuses a vault half, keepsake half or share at upload.
- 13.3: the confirm route takes validated shares, and the machine discards them on denial, check-in and a new round. The break route returns the shares (409 and unspent if fewer than k), and `witnessInfo` returns `witnessId` and `seanceLetters`.
- Tests are in `tests/unit/seance.test.ts` (12 tests) and `tests/unit/shamir.test.ts` (7 tests).

**Built but not ticked**
- 13.4: `Open.tsx` rebuilds B with `openSeanceLetter`, and `openSeanceLetter` has unit tests. There is no e2e test of the page, so the box stays open.

**Not built**
- 13.5: the Write page option, witness share links, the witness page that sends shares, the silence-window warning and the honest text.
- 13.6: the Playwright 2-of-3 and veto tests.

**Test counts**
- Unit tests went from about 213 to 232 (+19). I didn't capture the exact "before" figure, so 213 is 232 minus the new tests.
- Playwright went to 89 passed, with no new e2e tests this session.

**Other**
- I changed one statistical bound in my own new shamir test. It was 200, but 400 uniform draws from 256 values average about 202 distinct. It is now 150.
- No hook ran during the session beyond the session-start output. I made no MCP calls and no git commands. I left README.md, KIRO-LOG.md, CHANGELOG.md and `mcp.json` untouched.

**Files changed**
- Core and server: `src/core/{shamir (new),crypto,types,machine,vault}.ts`, `src/server/{service,app}.ts`.
- Web: `src/web/lib/{api,seal}.ts`, `src/web/pages/Open.tsx`.
- Specs: `.kiro/specs/switch-lifecycle/{requirements,design,tasks}.md`, `.kiro/specs/aws-release-runtime/design.md`.
- Tests: `tests/unit/{shamir,seance}.test.ts`.
```
