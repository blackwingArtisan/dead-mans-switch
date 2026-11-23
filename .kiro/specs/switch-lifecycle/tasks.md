# Implementation Plan: Switch Lifecycle

- [x] 1. Core domain types and schedule maths
  - [x] 1.1 Define `Vault`, `Witness`, `Letter`, `SealedLetter`, `Settings`, `SwitchState` and defaults in `src/core/types.ts` (Req 1.2)
  - [x] 1.2 Implement `scheduleOf` and `nextEventAt` in `src/core/time.ts` (Req 5.1-5.3, 6.7)
  - [x] 1.3 Implement validation and the author view in `src/core/vault.ts` (Req 1.3, 4.3)

- [x] 2. The pure state machine
  - [x] 2.1 Implement `step` with tick cascade, reminders, grace, last call and confirm entry (Req 5.1-5.5, 6.1)
  - [x] 2.2 Implement k-of-n confirmation, silence release and release effects (Req 6.2, 6.3, 6.7, 7.1)
  - [x] 2.3 Implement check-in, pause, resume and witness denial cancel paths (Req 4.1, 4.2, 6.4, 8.1-8.3)
  - [x] 2.4 Unit tests for every transition, cancel path, guard and idempotence (Req 5.4, 6.5, 7.9)

- [x] 3. Browser crypto
  - [x] 3.1 Implement base64url, Crockford base32, xor and SHA-256 helpers in `src/core/encoding.ts` (Req 3.1)
  - [x] 3.2 Implement `sealLetter` / `openLetter` with AES-GCM-256, AAD binding and key halves (Req 2.2-2.4, 2.7)
  - [x] 3.3 Unit tests: round trip, wrong half, tamper, AAD, malformed keepsake, tag (Req 2.3, 7.4)

- [x] 4. Server and adapters
  - [x] 4.1 Define `Clock`, `VaultStore`, `Mailer` ports and the token index (Req 1.4)
  - [x] 4.2 Local adapters: `MachineClock`, `MemoryStore`, `OutboxMailer` (Req 9.1, 9.2)
  - [x] 4.3 Production adapters: `SystemClock`, `KvStore`, `ResendMailer`, type-checked against Workers types
  - [x] 4.4 `SwitchService` with transact (tick, mutate, save, send) and mail-failure ledger entries
  - [x] 4.5 Email templates in plain text and HTML for every effect (Req 5.1-5.3, 6.1, 6.4, 6.6, 7.1)
  - [x] 4.6 Hono routes with JSON errors, owner auth and dev-only routes (Req 1.5, 9.3)
  - [x] 4.7 API lifecycle tests covering both custody modes and one-time opening (Req 3.4, 3.5, 7.5, 7.6)

- [x] 5. Runtimes
  - [x] 5.1 Node entry serving API and built web app, with env-selected adapters and a local tick interval
  - [x] 5.2 Cloudflare Worker entry with `fetch`, `scheduled` and `wrangler.toml` (KV, assets, cron)

- [x] 6. Web app
  - [x] 6.1 Design tokens, fonts, atmosphere, reduced-motion and print styles (Req 10.1-10.3)
  - [x] 6.2 Candle and wax-seal SVG components with per-state behaviour (Req 4.4, 10.4)
  - [x] 6.3 Landing page with vigil form and demo vigil (Req 1.1)
  - [x] 6.4 Vigil dashboard: status, deadlines, check-in, pause, stage track, letters, witnesses, terms, ledger (Req 4, 6.8, 8). Pause, burn, the stage track and the warnings are tested in 9.8 to 9.10
  - [x] 6.5 Writing desk with rich-text editor, custody choice and keepsake card (Req 2.1, 2.5, 3.1-3.3)
  - [x] 6.6 Witness page with two-step confirm and one-tap denial (Req 6.4, 6.5)
  - [x] 6.7 Keepsake page that remembers A locally (Req 3.6)
  - [x] 6.8 Open page: keepsake entry and tag check, break seal, sanitise, download, print (Req 7.2-7.8)
  - [x] 6.9 Time machine drawer and outbox (Req 9.1, 9.2)
  - [x] 6.10 "How the seal works" page with honest limits (Req 3.3)
  - [x] 6.11 Wax seal draws each mark as one glyph, with the lit edge as an outline on the same text element (Req 10.9, 10.10)

- [x] 7. End-to-end tests
  - [x] 7.1 Full lifecycle: write, fast-forward, witness confirms, recipient opens once (Req 2, 5, 6, 7)
  - [x] 7.2 Check-in during grace cancels (Req 4.1)
  - [x] 7.3 Vault-custody link opens on its own (Req 3.2)
  - [x] 7.4 Landing and honest page on desktop and mobile, no horizontal scroll (Req 10.2, 10.5)
  - [x] 7.5 Production adapters (KvStore, ResendMailer) and the Worker entry tested against in-memory fakes, no network
  - [x] 7.6 Automated accessibility audit (axe, WCAG 2.2 AA) on every page and state in the e2e suite (Req 10.1)

- [ ] 8. Hardening (next)
  - [ ] 8.1 Durable Object per vigil to serialise concurrent writes in production
  - [x] 8.2 Rate limiting on token routes, per process or isolate (Req 11.3, 11.11, 11.12, 11.14)
  - [ ] 8.3 Optional Shamir split of the vault half across witnesses (covered by group 13)
  - [x] 8.4 Security headers on every response, including Worker static assets (Req 11.1, 11.2, 11.4-11.10)
  - [x] 8.5 Time machine opt-in and refused for public origins (Req 9.4, 9.5)
  - [x] 8.6 Rate limiter swap point: a `RateLimiter` port with an in-memory default and a Cloudflare Workers Rate Limiting binding adapter, chosen in the Worker only when the binding is present (Req 11.3, 11.13-11.15)
  - [x] 8.7 Check the commented rate-limit binding in `wrangler.toml` against the current Cloudflare docs via context7 and rewrite it in the documented `[[ratelimits]]` form; the adapter's `limit({ key }) -> { success }` already matched (Req 11.13-11.15)

- [x] 9. Test and spec gaps found in the second review
  - [x] 9.1 Test that only the SHA-256 hash of the owner token is stored and the raw token is never in the vault (Req 1.4, 1.7)
  - [x] 9.2 Test the default settings of a new vigil and that a failed request changes nothing (Req 1.2, 1.8)
  - [x] 9.3 Move the letter sanitiser out of `src/web/pages/Open.tsx` into a module and unit test that scripts, event handlers and unknown tags are stripped (Req 7.7)
  - [x] 9.4 E2E: download and print the opened letter (Req 7.8, 7.16)
  - [x] 9.5 E2E: reduced-motion media query disables animation; 360 px layout for the writing desk and vigil (Req 10.3, 10.5)
  - [x] 9.6 E2E: the keepsake page remembers A in the browser, shows the printable code and makes no request carrying A (Req 3.6, 3.8, 3.9)
  - [x] 9.7 Extend the axe audit to the keepsake page and the paused, grace, confirm and released vigil states (Req 10.1)
  - [x] 9.8 E2E: pause, resume and burn a letter from the dashboard (Req 2.6, 8.1, 8.3)
  - [x] 9.9 Test the five-step stage track, the relative deadline and the screen-reader announcement after check-in (Req 4.3, 4.4, 4.7, 10.8)
  - [x] 9.10 Test the warning shown when the silence window is off and no witness is named, and the vault-custody warning before choosing it (Req 6.8, 3.3)
  - [x] 9.11 Test that no release email in keepsake custody contains A, and that a released vigil rejects settings, witness and letter changes (Req 7.9, 7.12)
  - [x] 9.12 Test that every Permissions-Policy and Cross-Origin-Opener-Policy header is sent, and that CSP blocks plugins and connect to other origins by directive (Req 11.4-11.10)
  - [x] 9.13 E2E: the core path by keyboard alone (demo vigil, check in, writing desk, Seal the letter) with a visible focus ring on every stop (Req 10.2, 10.6, 10.7)
  - [x] 9.14 "Seal the letter" glow is not clipped: only the unpressed stamp is clipped, and no ancestor of the button between it and `main` has overflow-x clip or hidden (Req 10.5)
  - [x] 9.15 `openLetter` rejects an IV that is not 12 bytes with a SealError before decrypting; tested with a truncated and a 16-byte IV (Req 2.11)

- [x] 10. Costume polish (layout defects measured in a design review)
  - [x] 10.1 Landing hero has exactly two buttons plus one quiet line; "What no one else does" moves below the rooms strip as three wax seals (Req 10.11, 10.12)
  - [x] 10.2 One-second match-strike intro on the first landing visit in a session; skipped under reduced motion and on later visits; never delays the buttons (Req 10.13, 10.3)
  - [x] 10.3 Phone time-machine toast sits below the masthead and is dismissed on route change (Req 10.14)
  - [x] 10.4 The story caption does not cover the stage track labels or the "Keep this letter" and "Print" controls at 1440x900 and 390x844 (Req 10.15)
  - [x] 10.5 The stage track is above the fold on the vigil at 1440x900 (Req 10.16)
  - [x] 10.6 Phone letter page: the reading-light flame is off the title and the hint pill sits above the page at 390 px (Req 10.17)
  - [x] 10.7 Grace room is a sickly yellow-green with a slow edge flicker, AA text contrast, and no animation under reduced motion (Req 10.18, 10.1, 10.3)
  - [x] 10.8 Brass buttons get the pill radius and the terms form rows get a row gap (Req 10.19, 10.20)

- [x] 11. The whole story: story beats for "Play the whole story" (the "room fills" ending is a later session)
  - [x] 11.1 The false alarm: a witness note on the denial path, then Silas denies with "Mara was hiking", Mara relights the candle, the clock moves on and Silas confirms (Req 6.18, 6.19, 12.1-12.5, 12.13)
  - [x] 11.2 The keepsake card: June's letter in keepsake custody and Theo's in vault custody, the card on screen before the seal breaks (Req 12.6, 12.7)
  - [x] 11.3 An honest failure state with "Reset the demo" and "Play it again" (Req 12.8-12.10)
  - [x] 11.4 Start from a link: `?story=1` on the landing page (Req 12.11)
  - [x] 11.5 Relabel the duration from the measured running time, with a test that keeps the label true (Req 12.12)

- [x] 12. Climax and room objects
  - [x] 12.1 The candle keeps its baseline height in every state; the wax melts into a widening pool at the base (Req 10.21, 10.1)
  - [x] 12.2 Candle-out climax: a 1.2 s blackout vignette, then a smoke plume, a polite "candle has gone out" line, and a straight cut under reduced motion (Req 10.22-10.24, 10.3, 10.8)
  - [x] 12.3 The ledger is a handwritten book page, still a focusable named scrolling region (Req 10.25, 10.28, 10.1)
  - [x] 12.4 Witnesses are small named candles that dim when asked and go out on confirm, with the state in text (Req 10.26, 10.28, 10.4)
  - [x] 12.5 The terms form sits on a brass plaque with the fields unchanged (Req 10.27, 10.28)

- [ ] 13. The séance seal (Req 13)
  - [x] 13.1 `src/core/shamir.ts`: split and combine over GF(256), with seeded property tests (Req 13.3)
  - [x] 13.2 Sealing, types, validation and upload for `witnesses` custody (Req 13.1, 13.2, 13.4, 13.14)
  - [x] 13.3 Server: shares on confirm, discarded on denial, check-in and new round, returned on break (Req 13.6-13.11)
  - [ ] 13.4 Open page rebuilds B from shares with plain messages (Req 13.11, 13.12)
  - [ ] 13.5 Write page option, witness share links, silence-window warning, honest text (Req 13.1, 13.5, 13.13, 13.15)
  - [ ] 13.6 E2E: 2-of-3 needs a second confirmation; a veto after one keeps it sealed (Req 13.6-13.12)
