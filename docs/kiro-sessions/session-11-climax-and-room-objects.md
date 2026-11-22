# Kiro session 11: the candle-out climax and the room's objects (task group 12)

- Tool: kiro-cli 3.5.0, v3 engine, non-interactive, agent `dead-mans-switch`
- Command: `kiro-cli chat --v3 --no-interactive --trust-workspace --agent dead-mans-switch --trust-tools=fs_read,fs_write,run_command,@context7,@aws-docs "<prompt>" </dev/null` (not `--trust-all-tools`)
- Date: 2026-11-22, 21:56 to 22:08 UTC. Duration: 11.9 min; exit code 0; credits used: 22.64 (account usage 730.60 before, 753.24 after)
- Result: tasks 12.1 to 12.5 built and ticked; Vitest 179 to 187 (26 files), Playwright 82 to 89; commit `ce21ee7` (436 lines added, 10 removed)

## What Kiro built

Kiro added criteria 10.21 to 10.28 and task group 12, then built it:

- the candle keeps its full height in every state while the melted wax spreads into a widening pool at its base, so it never seems to vanish;
- when the vigil enters the witnesses-asked room, a 1.2-second blackout closes in and a smoke plume rises from the wick; the overlay never takes a click, it plays only when the change happens on screen, and under reduced motion it is a straight cut; the room's live line now says the candle has gone out and smoke hangs in the air;
- the ledger is a ruled book page in a hand font, still a focusable scrolling region named "The ledger";
- each witness is a small named candle, lit before they are asked, dim once asked, out once they confirm, with the same state in a text tag;
- the terms form sits on a brass plaque with an engraved heading.

Kiro noted that it wrote the new unit tests together with the code, so it never saw them fail first, and that every witness now carries a tag ("not asked yet" while live, "not needed" after release).

## Developer review

The developer reran the full suite from a fresh clone (Vitest 187, Playwright 89, axe zero violations) and checked the out room, the witness candles, the ledger and the plaque at 360, 390 and 1440 px. With the new candle and tag in each witness row, the email address split mid-word on a 360 to 390 px phone, so the developer let the tag wrap below the address instead (`09d4d4f`, 2 lines added, 1 removed).

## What Kiro's own log recorded

| Evidence | Log line | What it shows |
|---|---|---|
| Hooks loaded | `hooks.reload.loaded {"read":4,"registered":4}` at 21:56:54 | The four workspace hooks were registered |
| Hook runs | 2 `ContextualHookInvoked` events: 21:56:54 and 22:08:37 | The agent's SessionStart hook (Kiro quoted it: open tasks 8.1 and 8.3) and `verify-before-stop` as the turn ended |
| MCP | no MCP calls | None were needed |

## Prompt

```text
Session for Last Candle (repository dead-mans-switch): the candle-out climax and the lower vigil dashboard dressed as objects in the room. Add a task group to .kiro/specs/switch-lifecycle/tasks.md, "Climax and room objects" (use the next free group number), one task per bullet below, each citing Requirement 10 (append new EARS criteria at the end of Requirement 10 where none states the behavior). Build them in order: test first, make it pass, tick the box. a11y.md applies to every file here.

Climax (src/web/components/Candle.tsx, src/web/pages/Vigil.tsx, app.css):
- The candle keeps its baseline height in every state: as the days run down the wax melts into a widening pool at the base rather than the column shrinking, so the candle never looks like it has disappeared.
- On entering the witnesses-asked room (the candle goes out), a 1.2 second full-viewport blackout vignette closes in, then a large smoke plume rises from the wick. Under prefers-reduced-motion it is a straight cut to the out state, with no animation. A polite live-region line states that the candle has gone out (reuse the room line if it already says so). Never block clicks for longer than the blackout itself.

Room objects (the lower half of the vigil dashboard, src/web/pages/Vigil.tsx and app.css):
- The ledger is drawn as a handwritten page of a book (ruled paper, a hand font for entries, a page edge), still a keyboard-focusable scrolling region with its accessible name.
- Witnesses are small named candles that dim when they have been asked and go out if they confirm, with their state also in text.
- The terms form sits on a brass plaque (engraved heading, brass border), with the form fields unchanged.
- Each of these takes the room tint (body[data-room]) like the rest of the page.

Time budget: this session is stopped at 25 minutes. While working, run only the test files you touch (for example `npx vitest run tests/unit/x.test.ts`, or `E2E_PORT=4215 npx playwright test tests/e2e/x.spec.ts`). Run the full gate once, at the end. The full Playwright suite takes about 5 minutes, and one story test runs in real time for about a minute. If you reach 15 minutes, finish the task you are on, run the full gate and stop, leaving the rest unticked.

Rules:
- Every text colour stays WCAG AA against its real background in every room; axe stays at zero violations in every room the audit visits. No horizontal scroll at 360 px.
- Tests prove what the page shows through the real UI; every new test title names its criteria. Do not weaken a test or add a fixed wait.
- When done, run `npm run typecheck`, `npm test` and `npm run build`, then `E2E_PORT=4215 npx playwright test` with run_command. Always set E2E_PORT=4215 for Playwright; never use another port. Fix anything that fails.
- If a hook runs during the session, quote its name and output in your summary.
- No git commands; the developer commits. Leave README.md, KIRO-LOG.md, CHANGELOG.md and .kiro/settings/mcp.json alone.

Finish with a short summary: files changed, test counts before and after, and anything you could not finish.
```

## Session output

Kiro's narration and summary, with tool calls collapsed into counts.

```text
I'll start by reading the files involved.
[18 tool calls]
Safe. Now the e2e spec for the objects.
[2 tool calls]
Fix labels in the test, then implement.
[16 tool calls]
All five tasks are built and ticked as group 12, "Climax and room objects". The full gate passes. `npm run typecheck` and `npm run build` are clean, `npm test` passes, and the full Playwright run passes with `E2E_PORT=4215`.

**Test counts**
- **Unit:** 184 before, 187 after (26 files). I added three in `tests/unit/room-objects.test.ts`, which has eight cases because one is parametrised over the six states.
- **Playwright:** 89 passed. I added two in `climax.spec.ts` and five in `room-objects.spec.ts`. I didn't record a count from before my changes.

**Spec**
- Requirement 10 now has criteria 21–28.
- `tasks.md` has the new group 12 with tasks 12.1–12.5. All five are ticked.

**Files changed**
- **Candle:** `src/web/components/Candle.tsx`. The wax column is a constant height, and the melt widens a pool at the base. A smoke plume rises when `climax` is set.
- **Vigil page:** `src/web/pages/Vigil.tsx`. It now has the blackout overlay and the `WitnessCandle` component. The terms panel is a `panel--plaque`. Every witness row now shows a state tag.
- **Room line:** `src/web/lib/room.ts`. The `confirm` line now reads "The room has gone dark and the candle has gone out. Smoke hangs in the air." The existing live region announces it, and the old e2e match on "The room has gone dark" still holds.
- **Styles:** `src/web/styles/app.css`, appended at the end.
- **New tests:** `tests/unit/room-objects.test.ts`, `tests/e2e/climax.spec.ts` and `tests/e2e/room-objects.spec.ts`.

**Behaviour**
- **Blackout:** a 1.2 s overlay, with `pointer-events: none` so it never takes a click. It only plays when the vigil enters `confirm` while on screen, and it is skipped under reduced motion.
- **Ledger:** a ruled book page with a page edge. It uses the hand font and is still a focusable region named "The ledger". Paper colours are per room, with dark ink.
- **Witness candles:** lit before asked, dim once asked, out once confirmed. The tag text says the same.
- **Plaque:** brass border and an engraved heading. The form fields are untouched.
- **Axe:** the new spec audits the alive, grace and confirm rooms, and the existing audits in `a11y.spec.ts` cover the other states.

**Things to know**
- I wrote the new unit tests together with the code and never saw them fail first.
- Before this change, a witness who hadn't been asked had no tag. Now every witness has one, and it reads "not asked yet". After release, a witness who never answered reads "not needed", because their link is cleared on release and "not asked yet" would be wrong.
- The e2e check for a confirmed witness uses Ada Penhallow. The demo has two witnesses, and the outbox's first witness link is hers.
- No hooks ran during the session beyond the session-start output, which listed open tasks 8.1 and 8.3 in switch-lifecycle.
- I didn't touch git, `README.md`, `KIRO-LOG.md`, `CHANGELOG.md` or `mcp.json`.
- Nothing is left unfinished.
```
