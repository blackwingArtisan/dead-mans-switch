# Changelog

Notable changes to Dead Man's Switch. Work done with Kiro is recorded call by call in [KIRO-LOG.md](KIRO-LOG.md).

## Unreleased

### Live demo
- **A static build that needs no server.** `npm run build:static` runs the same Hono API inside the browser, with the time machine and the outbox, and keeps each visitor's demo in their own localStorage; outbox links opened in other tabs share it. Requests run one at a time across tabs, so none overwrites another. The build carries the server's security headers in a `_headers` file. It is live on Cloudflare Pages, linked at the top of the README.

### Round three
- **What no one else does, above the fold.** Three lines under the hero's buttons and at the top of the README: the recipient holds half the key, any witness can veto, and the room is the state machine. "Twelve taps a year is the whole job."
- **A fuller comparison.** GoodTrust Future Messages, Everplans letters (Sharing After Death) and SafeBeyond join the table, each checked at the product's own pages, with the sources linked under it.
- **Plans that add up.** Keepsake is $39 for ten years of vigil, then $5 a year; the Founder plan (formerly Teams) is a flat $8 a month per business with up to 5 recipients, since most of the market has no employees. A bottom-up projection line is labelled as one.
- **Their candle, your light.** An opened letter is read beside the author's own candle, standing at the wax height and date of their last check-in, and it is the closing shot of Play the whole story. The letter API returns it as `lastCandle`, worked out by `lastCandleOf` in `src/core/time.ts`.
- **A reader that never looks broken.** The hint and "Light the room" sit on the sheet itself, above the fold; the first light is wider and centred on the opening lines; and the room lights itself after eight seconds in the dark.
- **Phones: nothing floats over an action.** The sound switch and the hourglass join the masthead, the time machine's note and the story caption dock to the top, and the page leaves room at the bottom. A phone-only Playwright file checks that no control overlaps a link, button or field as the page scrolls.
- **One masthead on a bad letter link.** The notice page no longer sits inside a second page frame.
- **Play the whole story is the primary button** on the landing page; "Try a demo vigil" is second and "Begin your vigil" is a text link to the form.
- **A haunted tab.** On the vigil, the favicon is a lit, guttering or unlit candle, and the tab title reads "(!) Your candle gutters" in grace and "The candle is out" once witnesses are asked. A browser warning in grace is opt-in ("let this browser warn you if it gutters"), asked for only by a press, and fires once per missed deadline.
- **The costume below the fold.** The three rites are one parchment scroll between two rods, the personas are sealed envelopes whose flap lifts on hover or focus (with no equal-height gaps), and every ten seconds a draught makes the landing flame gutter and rally (still under reduced motion).
- **Readable headings.** Cinzel Decorative's swash capitals are kept for the landing h1 and the brand; section headings and long page titles use plain Cinzel.
- **How the seal works, drawn.** One diagram replaces the A ⊕ B = K row: the key is made and split in your browser, half A travels with the recipient on a keepsake, half B waits in the vault, and only the recipient's browser holds both. Beneath it, what the vault can and cannot see. Under reduced motion the travelling halves are not drawn.
- **A shorter README.** About 110 lines: what no one else does, the captioned walk-through, the judge's path led by Play the whole story, the stakes, the comparison, the costume, the plans and the Kiro table. The feature list and the sunset detail moved to [docs/FEATURES.md](docs/FEATURES.md), and running and testing to [docs/RUNNING.md](docs/RUNNING.md).

### Kiro workspace
- **A custom agent** (`.kiro/agents/dead-mans-switch.json`) that loads the steering and specs, builds one spec task per session, and starts each session by listing the open tasks (`scripts/open-tasks.mjs`).
- **MCP servers** for the AWS documentation and Context7 in `.kiro/settings/mcp.json`.
- **A spec-drift hook** (`PostTaskExec`) beside the existing three. All four use the v1 hook schema that Kiro IDE 1.x and CLI V3 both read, and `tests/unit/kiro-config.test.ts` checks every trigger, matcher, resource and command.

### The costume
- **A warm candlelight reader.** The light on an opened letter is amber, its radius breathes like a flame, and a small flame follows the reader's pointer or finger.
- **The story ends in full light.** Play the whole story finishes on the whole letter, lit and signed, instead of a dark page.
- **Three rooms you can tell apart at a glance.** Grace washes the room a sickly green-grey and the vignette closes in; when the candle goes out the room turns a cold blue-black with smoke over the whole page. The panels take on each room's colour too.
- **A landing candle that answers.** The flame leans toward the pointer and its glow follows, scrolling down burns the wax, and a click snuffs it before a match strikes it alight again. **Play the whole story** is now a full button beside the demo.
- **Test counts kept true.** `scripts/sync-counts.mjs` runs the unit suite, lists the Playwright suite and rewrites the counts in the README (`--check` fails if they are stale). The Kiro tables now say their counts are from the pass they describe, and list all five steering files and the hooks, agent and MCP servers added after Pass 2. README media and the Open Graph image were regenerated with the new lede.
- **Smoother rooms.** The summons pulse on the check-in seal now moves only by transform and opacity (it had been repainting the seal's SVG filters every frame), the film grain uses plain alpha instead of a blend mode, nothing in the room is filtered, and the warmth stops breathing once the flame gutters. Measured in headless Chromium at 1440 by 900 over three 2-second samples: alive went from 41-44 to 59-61 frames a second, grace from 26-27 to 59-60, and the dark room from 32-36 to 49-52.
- **Sound, if you ask for it.** "Hear the room" (bottom left) turns on sound generated in the browser with Web Audio: a wick crackling while the candle burns, wind and a dying hiss in grace, a faint heartbeat once it is out, a match strike on check-in and wax cracking when a seal breaks. It is off by default and the choice is remembered on that device.
- **Let it go.** After keeping or printing a copy, a recipient can let the opened letter go: the parchment chars inward from its edges, the words fade to ash, and only a notice is left ("It is ash now"). Under reduced motion it goes at once.
- **The seal is pressed on screen.** Sealing scrolls back to the top so the fold and the seal play in view, and focus moves to the heading.

### For the people using it
- **Add it to your calendar.** Beside the check-in seal: one tap a month is twelve taps a year, and a repeating calendar event (`.ics`) on your cadence lands a day before each deadline. It carries the app's address and nothing secret.
- **Sourced stakes.** The landing page and the honest page cite the CDC's 3,072,666 U.S. deaths in 2024 beside Gallup's 46% will rate, the SBA's 29.8 million U.S. businesses with no employees, and the published prices of Everplans, Trustworthy and GoodTrust, each checked at its source.
- **A shorter landing comparison** that links to the full table on the honest page, and a third persona: Ruth, a hospice social worker.

- **A candle lit back.** After reading, a recipient can leave one line, once, plain text. The witnesses and the other recipients get an email, the other recipients see it beside their own letters, and the released vigil's headstone carries every candle.
- **If this service ends before you do.** A stated sunset policy (90 days' notice, a sealed export for every author, nothing deleted silently), **Export the sealed letters** on the vigil, and `offline-open.html`, a single saved page that opens a letter from the export and its keepsake with no server and no network.
- **Plans, stated plainly.** Free for one vigil; Keepsake at $39 once with the printed kit; Teams at $4 a seat a month for founders and ops leads. Both paid plans come after Kiroween, and the landing page says so.
- **Lost addresses and spent links lead somewhere.** An unknown address shows an unlit candle and "No vigil is kept here"; a bad letter, witness or check-in link says what to check and offers "Return to the threshold" and "How the seal works", without repeating its heading.
- **Polish.** The landing page shows one candle in its three rooms; the writing desk's placeholder sits on the first line inside the margin rule; the formatting toolbar stays on one row on a phone and scrolls sideways; a released vigil's epitaph is an arched headstone with the words cut into it.

### For judges and reviewers
- **A README that starts with the point.** The first screen says what it is and is not, shows the three rooms side by side, and leads to the judge's path; the architecture moved to [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The story GIF is now 960 px wide and 2.5 MB.
- **A cleaner demo path.** A new demo vigil starts with an empty outbox; mail sent in the same moment is listed in the order it was sent, so Silas, whom the guide names, comes first; the Time machine drawer steps aside after each jump and leaves its note by the button; and opening a letter ends the demo guide with "The story is complete".
- **Presenter mode.** `?presenter=1` hides the demo guide and the outbox badge and fades the Time machine button, for clean recordings.

## 2026-11-18: the second round

### For the people using it
- **One-tap check-in from email.** Reminder, grace, last-call and witnesses-asked emails carry a link that checks in from any device. Opening it changes nothing; a press checks in. Each link can only check in, works once, and is stored as a hash.
- **The keepsake made visible.** Sealing shows the key split in two (half A on the recipient's card, half B in the vault), and the keepsake card carries a QR code and prints on its own, ready for an envelope.
- **A founder's vigil.** A second demo, Priya Raman writing to her co-founder about the accounts only she holds, beside Mara's family letters.
- **In-theme form errors** beside each field instead of browser bubbles, with focus on the first problem.
- **Dates in the reader's own time zone.**

### The costume
- **The room follows the candle.** Glow, embers, moonlight, smoke and palette change with each state; the room dies when the candle goes out, and a check-in relights it with a match strike and sparks.
- **Read by their last candle.** An opened letter starts dark and a circle of light follows the reader's pointer or finger, until they light the room.
- **Ceremony.** An inkwell, brass keys and ruled parchment at the writing desk; the letter folds into its envelope under a pressed seal; a witness's answer is pressed in indigo wax and released letters lift away; a released vigil reads like a headstone.
- **Display type fixed.** Ligatures and kerning are off in the display face, so "THE" no longer renders as "TĦE".

### For judges and reviewers
- **Play the whole story:** a captioned, hands-off run of the full lifecycle in about 40 seconds.
- **A demo guide** that says what to try next at each stage, and a pulsing time-machine button until it is first opened.
- **README first screen:** the stakes, the people it is for, a comparison with Google, Apple, Bitwarden and deadmansswitch.net, a story GIF and screenshots (`scripts/capture-media.mjs` regenerates them), and Open Graph tags.
- **Kiro log** leads with a feature table; conditional steering files for the crypto and accessibility code.

### Reliability
- Changes to one vault are applied one at a time, so the background tick can no longer overwrite a letter added at the same moment.
- The time machine shows only its newest poll, so a slow answer cannot hide new emails.
- GitHub Actions runs typecheck, unit tests, the production build, the Playwright suite and the axe audit on every push and pull request.

Tests: 89 unit tests and 17 end-to-end tests (desktop and phone), with a WCAG 2.2 AA audit of every page and state.

## 2026-11-16: first build
- The switch lifecycle (alive, reminder, grace, witnesses asked, released, paused) as a pure state machine, with browser-side AES-GCM sealing, split keys, witness confirmation and one-time release links.
- Hardened responses (CSP, security headers, rate-limited token routes) and an opt-in time machine for demos.
- Node and Cloudflare Worker entry points behind ports and adapters.
