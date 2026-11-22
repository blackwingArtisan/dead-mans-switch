# Implementation Plan: Founder Runbook

- [x] 1. Template builder in core
  - [x] 1.1 `src/core/runbook.ts`: account kinds, sections, `runbookHtml`, `runbookIsBlank`, escaping, allow-list tags only (Req 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 3.4)
  - [x] 1.2 `findLikelySecrets` with the three rules and masked preview (Req 2.2, 2.3, 2.4, 2.9)

- [x] 2. Yearly review in the pure machine
  - [x] 2.1 `src/core/review.ts` `reviewOf` with the 365-day boundary and the released/opened exclusions (Req 5.1, 5.2, 5.8, 5.11, 5.12)
  - [x] 2.2 Add `reviewAgeDays` to the `reminder` effect; no state, history, sent-key or recipient/witness change; idempotent (Req 5.3, 5.4, 5.5, 5.6, 5.10, 5.11)
  - [x] 2.3 Render the review line in the reminder email, plain text and HTML (Req 5.3, 5.4)
  - [x] 2.4 `VaultView.review` from `viewOf` (Req 5.7, 5.8, 5.12)

- [x] 3. Writing desk
  - [x] 3.1 Template choice and `RunbookBuilder` with the warning text, add and remove sections, blank refusal (Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.9, 2.1)
  - [x] 3.2 `SecretWarning`: live, in-theme, non-blocking, on both modes (Req 2.5, 2.6, 2.7, 2.8, 2.10)
  - [x] 3.3 E2E: a sealed runbook uploads no plaintext and the same fields as any letter; custody choices intact (Req 3.1, 3.2, 3.3)

- [x] 4. Founder demo
  - [x] 4.1 Priya's letter to Tomás built from the template: four sections, March renewal, no payroll, no findings, custody kept (Req 4.1-4.6)

- [x] 5. Vigil note and time machine
  - [x] 5.1 "Review your letters" note on the vigil with the age of the oldest letter (Req 5.7, 5.8)
  - [x] 5.2 E2E: the time machine moves a year, the note appears and the reminder email carries the line (Req 5.9)

- [x] 6. Accessibility
  - [x] 6.1 Axe audit of the runbook desk with a warning shown and of the vigil with the review note, inside `tests/e2e/runbook.spec.ts` (Req 2.10, 5.7)
