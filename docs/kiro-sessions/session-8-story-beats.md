# Kiro session 8: story beats for "Play the whole story" (task group 11)

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@context7,@aws-docs "<prompt>" </dev/null` (not `--trust-all-tools`)
- Date: 2026-11-22, 20:17 to 20:42 UTC. Duration: 25.1 min, stopped by the 25-minute session limit during its final full-suite run; credits used: 37.96 (account usage 566.38 before, 604.34 after)
- Result: all five tasks (11.1 to 11.5) built and ticked; Vitest 144 to 150, Playwright 64 to 74; commit `a3d4774` (655 lines added, 77 removed)

## What Kiro built

Kiro added Requirement 12, "The whole story" (13 criteria), two witness-note criteria to Requirement 6 (6.18, 6.19), a design section and task group 11, then built each task test first:

- **11.1 The false alarm.** The witness page gained an optional note, carried through the pure state machine's denial event into the author's email and the ledger. In the story, Silas types "Mara was hiking", presses "Mara still lives", the vigil returns to grace, Mara relights the candle, and the clock moves on until the candle goes out a second time and Silas confirms.
- **11.2 The keepsake card.** June's letter moved to keepsake custody and Theo's to vault custody. The story shows June's printed card, then opens her release link with that half of the key, so the seal breaks for real.
- **11.3 An honest failure state.** Any failed API call stops the story with "The demo stopped responding." and two buttons, "Reset the demo" and "Play it again"; reset uses the dev route when it answers and clears the static demo's stored state otherwise.
- **11.4** `?story=1` starts the story from a link once the time machine is known to be there, muted.
- **11.5** The button label is now the measured running time, 54 s, with a unit test against the sum of the story's pauses and an end-to-end test that times a real run at normal pace.

Ten new Playwright tests and six new unit tests, each naming its criteria.

## Developer review

The full suite run after the session found two failures, both from one cause outside Kiro's change: the in-memory rate limiter kept a window that started in the future after the demo clock was reset, so the longer suite met 429s on witness and letter links. The developer fixed the limiter in a separate commit just before this one (`b4bac7f`, 10 lines added, 1 removed, including a unit test), after which the suite passed from a fresh clone: Vitest 151, Playwright 74. The real-time story test measured 52.9 s against the 54 s label.

## What Kiro's own log recorded

| Evidence | Log line | What it shows |
|---|---|---|
| Hooks loaded | `hooks.reload.loaded {"read":4,"registered":4}` at 20:17:28 | The four workspace hooks were registered |
| Hook runs | 2 `ContextualHookInvoked` events: 20:17:28 and 20:19:53 | The agent's SessionStart hook, and one later run; the session ended at the time limit, so `verify-before-stop` did not run |
| MCP | no MCP calls | None were needed |

## Prompt

```text
Session 8 for Last Candle (repository dead-mans-switch): story beats for "Play the whole story" (src/web/lib/story.ts). Add a Requirement 12, "The whole story", to .kiro/specs/switch-lifecycle/requirements.md with EARS criteria for the behavior below, a short section on it in design.md, and a task group 11 in tasks.md (11.1 to 11.5). Then build the tasks in order: write or extend the test first, make it pass, tick the box. Do not build "the room fills" ending in this session; a later session does that.

11.1 The false alarm (a 6 to 8 second beat, after the candle first goes out). Silas, the witness, presses "They still live" on his witness page with the note "Mara was hiking", the vigil cancels through the real witness-denial path (Req 6.4), and the room relights with the match-strike relight the check-in already uses. Then the story moves the clock on again until the candle goes out a second time and Silas confirms, as now. The captions say what happens in plain words.
11.2 The keepsake card. Switch the demo so June's letter is in keepsake custody and Theo's is in vault custody (src/web/lib/seal.ts DEMO; the demo must still show both custody modes). Just before June breaks the seal, show the printed keepsake card on screen as June brings half A (the existing keepsake page or card component), with a caption, then open her release link with that keepsake so the seal breaks for real. Update any test that relied on June being in vault custody, and say which.
11.3 An honest failure state. If any API call fails while the story plays (the demo server stopped, or in the static build the in-browser API threw), the story stops and shows "The demo stopped responding." with two buttons, "Reset the demo" (resets through the dev reset route when it answers, otherwise clears the static demo's localStorage key) and "Play it again". The wording must fit both the Node server and the static build (`npm run build:static`). Test it in Playwright by making /api/* fail with page.route after the story starts, and check both buttons are shown and reachable by keyboard.
11.4 Start from a link: `?story=1` on the landing page starts the story once the page knows the time machine is available, so a README link can play it. Sound stays muted by default.
11.5 Relabel the duration. Measure the real running time at normal pace (sum the waits, or time one run at pace 1 in a test) and set the button label to the rounded real time in seconds, for example "▶ Play the whole story (45 s)". Update the comment at the top of story.ts. Keep a test that checks the label matches the computed total within 5 seconds, so the label can never drift again.

Rules:
- Keep every beat driven through the real app (same routes, buttons and API a person would use), as story.ts already does. Keep `?story-pace=0.2` working; the existing story tests use it.
- crypto.md applies if you touch the keepsake or open pages, and a11y.md applies to every web file: every new caption is announced, every new effect has a reduced-motion path, axe stays at zero violations.
- Every new test title names its criteria, such as "(Req 12.1)". Do not weaken a test or add a fixed wait.
- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=4215 npx playwright test` with run_command. Always set E2E_PORT=4215 for Playwright; never use another port. Fix anything that fails.
- If a hook runs during the session, quote its name and output in your summary.
- No git commands; the developer commits. Leave README.md, KIRO-LOG.md, CHANGELOG.md and .kiro/settings/mcp.json alone.

Finish with a short summary: files changed, the measured story length, test counts before and after, and which existing tests you changed and why.
```

## Session output

Kiro was stopped at the time limit before writing its summary. Its narration, with tool calls left out (76 calls in all):

```text
I'll start by reading the story code and the files around it.
Now the failing tests for the note (machine and API), written before the code.
Newest first. I'll have the test read the ledger oldest first.
Test 1 fails as expected. I'll implement it now.
```
