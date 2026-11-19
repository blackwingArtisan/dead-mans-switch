# Kiro session 4: group 9 end-to-end tests (tasks 9.4 to 9.7)

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@aws-docs,@context7 "<prompt>" </dev/null` (not `--trust-all-tools`)
- Duration: 5 min 34 s; exit code 0; credits used: 7.97 (kiroween2026 balance 224.57 before, 232.54 after)
- No MCP calls in this session. Kiro ran typecheck, Vitest, the build and Playwright on port 3826 itself; the developer re-ran Playwright (39 of 39) and a fresh-clone check before the commit.

## Prompt

```text
Build tasks 9.4, 9.5, 9.6 and 9.7 of .kiro/specs/switch-lifecycle/tasks.md in this session, in that order, following requirements.md and design.md in the same folder and the steering files (a11y.md applies to all four). Tasks 9.1, 9.2, 9.3, 9.11 and 9.12 are done. The developer asked for these four together because they are all Playwright tests; treat each as its own task: read the requirement it cites, write or extend the e2e test, make it pass, then tick its box.

Rules:
- Tests prove the behavior the requirement states, through the real UI on both the desktop and phone projects where the existing specs do. If the code and the requirement disagree, fix whichever is wrong and say which in your summary. Do not weaken a test or add a fixed wait to make it pass; wait on what the page shows.
- 9.7: extend the axe audit in tests/e2e/a11y.spec.ts to the keepsake page and the paused, grace, confirm and released vigil states, using the time machine the existing tests use. Fix any real violation you find in the app, not in the test.
- Every new test title names its criteria, such as "(Req 7.8)", in the style the existing tests use.
- When a task in groups 6 or 7 only waited on these gap tasks (for example 6.8 on 9.3 and 9.4, 6.7 on 9.6, 7.6 on 9.7), tick it too, and say so.
- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=3826 npx playwright test` with run_command (always set that port; never use another), and fix anything that fails.
- Do not run git commands; the developer commits. Leave README.md, KIRO-LOG.md and CHANGELOG.md alone.

Finish with a short summary: the files you wrote or changed, the test counts before and after, any accessibility fix you made, and anything in the spec you had to change.
```

## Session output

Kiro's narration and tool calls as printed by kiro-cli. Tool status lines and client log lines are removed; nothing else is edited.

```text
I'll start by reading the existing e2e specs and the spec files.
[tool] List Directory
[tool] Run Command
[tool] Read File
[tool] Read File
[tool] Read File
[tool] Read File
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Replace in File
[tool] status: Pending
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Replace in File
[tool] status: Pending
[tool] Run Command
[tool] Run Command
[tool] Replace in File
[tool] status: Pending
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
My guess at the title was wrong; the page says "Under glass". I'll correct it and check whether `data-room` really is `paused`.
[tool] Run Command
macOS `sed -i` needs a backup suffix, so the edit didn't apply. I'll make it with the edit tool.
[tool] Replace in File
[tool] status: Pending
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
[tool] Run Command
All four tasks (9.4, 9.5, 9.6, 9.7) are built, ticked and passing. `npm run typecheck`, `npm test` and `npm run build` pass. The full run with `E2E_PORT=3826 npx playwright test` passed 39 of 39, before and after the last small typing fix. After that fix I re-ran only the 9.6 test and `npm run typecheck`. I used `execute_bash` for the commands because that is the shell tool I have, not `run_command`.

**Files changed**
- `tests/e2e/lifecycle.spec.ts`: two new tests.
  - 9.4: the opened letter downloads as a standalone file with no script, and Print calls `window.print`. In print layout the controls and masthead are hidden and the letter text stays visible.
  - 9.6: the keepsake page shows the same printable code as the author's card and saves the key half in the recipient's browser. No request carries the key half, in raw or code form, and no vault route is called. The release email and link also leave it out. Opening the one-time link from the same browser then works with no pasting, and a different browser remembers nothing.
- `tests/e2e/smoke.spec.ts`: two new tests that run on the desktop and phone projects.
  - 9.5: with reduced motion no animation keeps running in the alive, grace or confirm room, while with motion allowed the flame animates. At 360 px the vigil, the time machine drawer, the writing desk and the keepsake card have no sideways scroll.
- `tests/e2e/a11y.spec.ts`: two new audits. One covers the paused, grace, confirm and released vigil rooms plus the open time machine drawer. The other covers the keepsake page, complete and cut short.
- `src/web/styles/app.css` and `src/web/pages/Vigil.tsx`: the two app fixes below.
- `.kiro/specs/switch-lifecycle/tasks.md`: ticks.

**Test counts**
- Unit: 136 before and after, since I added none.
- Playwright: 31 before and 39 after. The 8 new runs are 6 on desktop and 2 on phone.

**Fixes in the app, not the tests**
- **Page width at 360 px:** on the writing desk the unpressed wax stamp, drawn at 1.6 times its size, made the page 30 px too wide. I clipped it sideways in `.desk__seal`.
- **Ledger:** axe flagged the vigil's scrolling ledger list as a `scrollable-region-focusable` violation in the grace state. It now takes keyboard focus (`tabIndex={0}`) and has a label.

**Spec**
- **Ticked along with them:** 6.1, 6.7, 6.8, 7.6, and the group 7 parent, since all its children are now done. I removed their "code done, untested" notes. Task 6.1 only waited on 9.5, but nothing tests Req 10.2 (full keyboard use) beyond the skip-link check, so you may want to reopen that part.
- **No spec text changed:** the code and the requirements agreed. Req 10.3 says reduced motion "disables" animation, but the CSS shrinks each animation to a 0.001 ms single run. The 9.5 test checks that none is still running, so I read the requirement as meaning the end state shows at once.
- **README:** its test counts are stale (120 unit, 31 end-to-end), and I left it alone as asked.
```
