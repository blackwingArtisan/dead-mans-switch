---
inclusion: always
---
# Structure

```
src/
  core/        pure domain code shared by web, server and worker
    types.ts       Vault, Letter, Witness, Recipient, SwitchState
    machine.ts     the switch state machine (pure)
    crypto.ts      AES-GCM letter sealing and key halves (WebCrypto)
    encoding.ts    base64url helpers
    export.ts      the sealed export format (what offline-open.html reads)
    time.ts        day/ms helpers and deadline maths
  server/      HTTP API and adapters
    app.ts         createApp(deps): every route
    service.ts     use-cases: load vault, apply event, perform effects, save
    ports.ts       Clock, VaultStore, Mailer, RateLimiter interfaces
    adapters/      local and real implementations of each port (memory-rate-limiter.ts, cloudflare-rate-limiter.ts for RateLimiter)
    emails.ts      email templates (plain text + HTML)
    node.ts        local Node entry (serves the built web app too)
  worker/      Cloudflare Worker entry (fetch + scheduled)
  web/         React app
    pages/         one file per route (Landing, Vigil, Write, Witness, Keepsake, Open, HowItWorks)
    components/    Candle, WaxSeal, Chrome (shell and room atmosphere), Editor, TimeMachine (with the outbox),
                   Comparison, FieldError, SoundToggle, Lost (the 404 page and spent-link notices)
    lib/           api client, router, seal (browser-side sealing), format, room (body data-room),
                   tour (demo guide), validate (in-theme form errors), sound (generated Web Audio,
                   off by default), presenter (?presenter=1 for recordings), calendar (.ics reminder)
    styles/        app.css: design tokens on :root, then one section per component
    public/        static files, including offline-open.html (opens an exported letter with no server;
                   its script is a self-contained copy of the opening code, tested against core/crypto.ts)
tests/
  unit/        Vitest (machine, crypto, API, adapters, security, rate limiter, wax seal, format, Node entry, Kiro config,
               sound, calendar, outbox order, link notices, the offline page)
  e2e/         Playwright (lifecycle, axe accessibility audit, smoke on desktop and mobile)
scripts/       dev server, media capture, open-tasks.mjs (lists open spec tasks for the agent's SessionStart hook)
.kiro/         steering, specs, hooks (v1 JSON), agents/dead-mans-switch.json, settings/mcp.json
```

## Conventions
- File names are kebab-case or lowerCamel for modules; React components are PascalCase.
- `core/` imports nothing from `server/`, `worker/` or `web/`.
- Every route validates its input and returns JSON `{ error }` with a clear message on failure.
- One test file per core module. New behaviour lands with a test.
- Sample data uses invented people, `example.com` emails and 555-01xx phone numbers.
