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
                   Comparison, FieldError
    lib/           api client, router, seal (browser-side sealing), format, room (body data-room),
                   tour (demo guide), validate (in-theme form errors)
    styles/        app.css: design tokens on :root, then one section per component
tests/
  unit/        Vitest (machine, crypto, API, adapters, security, rate limiter, wax seal, format, Node entry)
  e2e/         Playwright (lifecycle, axe accessibility audit, smoke on desktop and mobile)
```

## Conventions
- File names are kebab-case or lowerCamel for modules; React components are PascalCase.
- `core/` imports nothing from `server/`, `worker/` or `web/`.
- Every route validates its input and returns JSON `{ error }` with a clear message on failure.
- One test file per core module. New behaviour lands with a test.
- Sample data uses invented people, `example.com` emails and 555-01xx phone numbers.
