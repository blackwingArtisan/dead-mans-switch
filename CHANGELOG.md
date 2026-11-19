# Changelog

Notable changes to Dead Man's Switch. Work done with Kiro is recorded call by call in [KIRO-LOG.md](KIRO-LOG.md).

## Unreleased

### Kiro workspace
- **A custom agent** (`.kiro/agents/dead-mans-switch.json`) that loads the steering and specs, builds one spec task per session, and starts each session by listing the open tasks (`scripts/open-tasks.mjs`).
- **MCP servers** for the AWS documentation and Context7 in `.kiro/settings/mcp.json`.
- **A spec-drift hook** (`PostTaskExec`) beside the existing three. All four use the v1 hook schema that Kiro IDE 1.x and CLI V3 both read, and `tests/unit/kiro-config.test.ts` checks every trigger, matcher, resource and command.

### The costume
- **A warm candlelight reader.** The light on an opened letter is amber, its radius breathes like a flame, and a small flame follows the reader's pointer or finger.
- **The story ends in full light.** Play the whole story finishes on the whole letter, lit and signed, instead of a dark page.
- **Three rooms you can tell apart at a glance.** Grace washes the room a sickly green-grey and the vignette closes in; when the candle goes out the room turns a cold blue-black with smoke over the whole page. The panels take on each room's colour too.
- **A landing candle that answers.** The flame leans toward the pointer and its glow follows, scrolling down burns the wax, and a click snuffs it before a match strikes it alight again. **Play the whole story** is now a full button beside the demo.
- **Let it go.** After keeping or printing a copy, a recipient can let the opened letter go: the parchment chars inward from its edges, the words fade to ash, and only a notice is left ("It is ash now"). Under reduced motion it goes at once.
- **The seal is pressed on screen.** Sealing scrolls back to the top so the fold and the seal play in view, and focus moves to the heading.

### For judges and reviewers
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
