# Kiro session 7: the costume polish (task group 10)

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@context7 "<prompt>" </dev/null` (not `--trust-all-tools`)
- Date: 2026-11-22, 19:44 to 20:03 UTC. Duration: 18.8 min; exit code 0; credits used: 49.42 (account usage 480.56 before, 529.98 after)
- Result: Vitest 144 of 144, Playwright 47 to 64 on its own run; commit `ed0ab49` (914 lines added, 86 removed)

## What Kiro built

Kiro wrote task group 10 (10.1 to 10.8) into the switch-lifecycle spec, with new criteria 10.11 to 10.20 in `requirements.md` and UI notes in `design.md`, then built each task test first. Seventeen new Playwright tests, in four new files (`intro`, `story-layout`, `grace-room`, `phone-letter`) and four extended ones. Two choices worth noting from its summary:

- The grace room's green had to stay a dark olive: a brighter yellow-green failed WCAG AA for the muted text. Because axe cannot see the fixed room layers, Kiro wrote `grace-room.spec.ts` to screenshot the room on its own and check every piece of unpanelled text against it, including with the new edge flicker forced to its brightest frame.
- It changed two existing tests and said why: the founder demo button lost its leading "or" (the word moved into the quiet line), and the vault letter's reading hint moved above the sheet.

## What Kiro's own log recorded

| Evidence | Log line | What it shows |
|---|---|---|
| Hooks loaded | `hooks.reload.loaded {"read":4,"registered":4}` at 19:44:17 | The four workspace hooks were registered |
| Hook runs | 2 `ContextualHookInvoked` events: 19:44:17 and 20:03:00 | The agent's SessionStart hook at the start (Kiro quoted its open-task list: 8.1 and 8.3) and `verify-before-stop` as the turn ended |
| MCP | both servers connected; no MCP calls | This session needed no outside docs |

Kiro made its edits with in-place replacements this session, and no `test-on-save` run was logged after them; it ran the typecheck and the unit suite itself instead.

## Developer review

The developer reran the full suite from a fresh clone (Vitest 144, Playwright 64, axe zero violations) and checked the landing page, the vigil and the grace room at 390 px and 1440 px. Nothing needed changing.

## Prompt

```text
Session 7 for Last Candle (repository dead-mans-switch): a costume polish batch. A design review measured these layout defects with screenshots. Add them to .kiro/specs/switch-lifecycle/tasks.md as a new group 10, "Costume polish", one task each (10.1 to 10.8), each citing the requirement it serves (mostly Requirement 10; add a new EARS criterion at the end of Requirement 10 where none states the behavior). Then build them in order, one at a time: read the requirement, write or extend the Playwright or unit test first, make it pass, tick the box. The a11y.md steering file applies to every file here.

10.1 Hero buttons (src/web/pages/Landing.tsx, app.css). Exactly two buttons: "▶ Play the whole story" (btn--wax, primary) and "Try a demo vigil" (btn--ghost). Below them, one quiet text line: "or begin your own · a founder's vigil", where "begin your own" links to #begin and "a founder's vigil" starts the founder demo (keep the existing handlers and busy labels). Keep the thesis line (data-testid "thesis") and the stakes line in the hero. Move the "What no one else does" list (data-testid "distinct") below the fold, after the rooms strip, drawn as a strip of three wax seals (use the WaxSeal component, marks I, II, III), each with its title and text. Keep its heading, its three items and "Twelve taps a year is the whole job." When the story is not available (no time machine), "Try a demo vigil" becomes the wax button, as now. Leave the story button's duration label as it is; another task relabels it.
10.2 A one-second match-strike intro on the first load of the landing page in a browser session: the hero candle starts dark, a spark, then the flame catches. Skip it entirely under prefers-reduced-motion and on later visits in the same session (sessionStorage), and never delay the buttons from being usable.
10.3 Phone time-machine toast (.tm-toast, the max-width 520px block near the end of app.css). On phones it currently sits at top:12px over the masthead. Place it below the masthead, and dismiss it on route change (navigation in src/web/lib/router.ts).
10.4 The "Play the whole story" caption (.story) must not cover the stage track labels on the vigil, or the "Keep this letter" and "Print" controls on the open page, at 1440x900 and 390x844. Reserve space for it (for example padding on the page while a story plays) rather than shrinking the caption.
10.5 The stage track (list "Stages of the switch") must be above the fold on the vigil at 1440x900. A one-line track or a rail beside the candle are both fine.
10.6 Phone letter page (src/web/pages/Open.tsx): the reading-light flame marker must not sit on the letter title at 390 px, and the "Move your light over the page." pill must sit above the page, not over it.
10.7 Grace room: make the grace room (body[data-room='grace']) a sickly yellow-green with a slow flicker at the edges of the viewport. Keep every text colour at WCAG AA against it (the axe audit covers the grace room) and give the flicker a reduced-motion path with no animation.
10.8 Small fixes: .btn--brass gets the same pill radius as the other buttons; the terms form grid on the vigil (form.terms) gets a consistent row gap so the fields do not touch.

Rules:
- Tests prove what the page shows through the real UI, on the projects the existing specs use (desktop and the mobile project where layout matters). Every new test title names its criteria, such as "(Req 10.5)". Do not weaken a test or add a fixed wait. Update existing tests only where the behavior was meant to change (for example the hero button and Distinct assertions in tests/e2e/smoke.spec.ts), and say which.
- Keep axe at zero violations.
- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=4215 npx playwright test` with run_command. Always set E2E_PORT=4215 for Playwright; never use another port. Fix anything that fails.
- If a hook runs during the session, quote its name and output in your summary.
- No git commands; the developer commits. Leave README.md, KIRO-LOG.md, CHANGELOG.md and .kiro/settings/mcp.json alone.

Finish with a short summary: files changed, test counts before and after, which existing tests you changed and why, and anything you could not finish.
```

## Session output

Kiro's narration and summary, with tool calls collapsed into counts.

```text
I'll start by reading the spec files and the code involved.
[28 tool calls]
macOS sed choked on the `&&`; I'll use str_replace instead.
[9 tool calls]
Now the test, appended to dashboard.spec.ts (desktop project only), covering the 1440x900 fold and the 390 check-in guard.
[3 tool calls]
Now edit Open.tsx and CSS, then write the phone letter test.
[19 tool calls]
All eight tasks (10.1 to 10.8) are built and ticked. The full gate passes: `npm run typecheck`, `npm test` (144 of 144), `npm run build`, and `E2E_PORT=4215 npx playwright test` (64 of 64). Axe still reports zero violations.

## Spec and files
- **Spec:** `.kiro/specs/switch-lifecycle/tasks.md` has the new group 10 with tasks 10.1 to 10.8. `requirements.md` has new Requirement 10 criteria 10.11 to 10.20, one for each behaviour no existing criterion stated. `design.md` has the UI notes and the test map.
- **Source:** `Landing.tsx`, `Comparison.tsx`, `Vigil.tsx`, `Open.tsx`, `Chrome.tsx`, `TimeMachine.tsx`, `StoryCaptions.tsx` and `app.css`.
- **New e2e specs:** `intro`, `story-layout`, `grace-room` and `phone-letter`.
- **Extended e2e specs:** `smoke`, `phone`, `dashboard` and `lifecycle`.

## Test counts
| | Before | After |
|---|---|---|
| Unit | 144 | 144 |
| Playwright | 47 | 64 |

All 17 new tests are Playwright. The unit count is unchanged because every change is in the web layer.

## Existing tests I changed
- **`lifecycle.spec.ts`, founder demo:** the button is now named "a founder’s vigil" (was "or a founder’s vigil"), because the "or" moved into the quiet line.
- **`lifecycle.spec.ts`, vault-custody letter:** the reading hint now sits above the sheet, so it is found on the page and no longer inside the sheet.
- **`smoke.spec.ts`:** the existing hero and Distinct assertions still pass unchanged. I added the new checks as separate tests.

## Choices to review
- **10.6:** to put the hint pill "above the page" I moved it out of the sheet, above it and sticky. That applies on desktop too. The flame marker now stays hidden until the light is first moved, so it can't sit on the title.
- **10.5:** the stage track now sits under the lede inside the status column, and the column is a flex column. On phones the track drops to the end, so the check-in stays above the fold at 390 px.
- **10.7:** the grace room had to stay dark olive, because a brighter yellow-green would have failed AA for the muted text. The footer and the masthead tag use the muted tone in grace for the same reason. The flicker is a new `.atmosphere__flicker` layer that animates opacity only, so the existing "grace stays smooth" test still holds.
- **10.7 measurement:** axe can't see the fixed room layers, so `grace-room.spec.ts` screenshots the room alone and checks every piece of unpanelled text against it, including with the flicker forced to its peak.
- **10.3:** the phone toast sits at `top: 78px`, which is a fixed estimate of the masthead height. The test asserts it clears the real masthead.
- **10.4:** `story-layout.spec.ts` fails at 1440x900 when I disable the fix, but it passes at 390x844 without it, so on phones it is a regression guard only.

## Hooks
- **Session start:** the "Session Start Hook Output" listed 2 open tasks, 8.1 and 8.3. I left them alone.
- **Others:** none of the save, task or stop hooks printed anything into the session. I ran the stop hook's commands (`npm run typecheck` and `npm test`) myself.

## Not done
- The README test counts are stale. You told me to leave the README alone, so `scripts/sync-counts.mjs` is yours to run.
- I ran no git commands.
```
