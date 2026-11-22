# Running and testing

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run demo          # builds the web app and serves everything on http://localhost:3140, time machine on
```

Then follow the [judge's 60-second path](../README.md#judges-60-second-path) above.

For development with hot reload: `npm run dev` (web on :3141, API on :3140, time machine on).

`npm start` runs the same server the way a deployment would: system clock, no time machine, no demo routes. The time machine is opt-in (`--time-machine` or `DMS_CLOCK=machine`) and the server refuses to start it for anything but a localhost origin.

Local data lives in `./data` (`vaults.json`, `outbox.json`, `clock.json`). Delete the folder or use **Reset the whole demo** to start over.

For a screen recording, add `?presenter=1` to the address: the demo guide and the outbox badge disappear and the Time machine button fades until you hover or tab to it (`?presenter=0` brings them back).

### Static demo (no server)

```bash
npm run build:static  # dist/web, ready for any static host such as Cloudflare Pages
```

This build runs the same Hono API inside the browser ([`src/web/lib/browser-server.ts`](../src/web/lib/browser-server.ts)) with the time machine and the outbox on. Each visitor gets a private demo kept in their own localStorage, and links opened from the outbox in another tab share it. No email leaves the browser. The build also writes a `_headers` file with the server's security headers. The live demo is this build on Cloudflare Pages: `npx wrangler pages deploy dist/web --project-name dead-mans-switch`.

To refresh the README media, start `npm run demo` and run `node scripts/capture-media.mjs` (the GIF needs ffmpeg).

## Test it

```bash
npm test              # Vitest: state machine, crypto, full API lifecycle, security headers and rate limit, production adapters and Worker (with fakes), Node entry as a CLI
npm run e2e           # Playwright: builds and starts a fresh server on :3142 (or E2E_PORT), drives real browsers
npm run typecheck     # web + server, and the Cloudflare Worker against Workers types
npm run check         # all of the above plus a production build
node scripts/sync-counts.mjs   # refresh the counts below from a real run (--check to verify)
npm run smoke:live    # 3 checks on desktop and phone against the live demo (LIVE_URL to point elsewhere); not part of check
```

Current suite (kept in step with the README by `scripts/sync-counts.mjs`): see the README's **Test it** line.



The end-to-end suite writes a letter, fast-forwards past the grace period, confirms as a witness in a separate browser, opens the letter as the recipient in a fresh browser with a pasted keepsake, and checks the link refuses a second opening. It also covers a check-in during grace, a one-tap check-in from the grace email on a second device, a vault-custody link, a candle lit back by a recipient, the sealed export opened by the offline page from disk with the network off, the calendar reminder, the founder's demo, the hands-off story, in-theme form errors, broken and unknown links, the room relighting on check-in, mobile layout, and an axe WCAG 2.2 AA audit of every page and state.

GitHub Actions runs `npm run check` on every push and pull request ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
