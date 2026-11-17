---
inclusion: always
---
# Product: Dead Man's Switch

## One line
Write letters for the people you love, sealed until you can no longer check in.

## Who it is for
- People who want their last words, passwords-to-the-shoebox, apologies and instructions to reach the right person, without handing them over today.
- Solo founders and sole account-holders who need a plain "if I go quiet, tell these people" switch.
- Families planning ahead (a parent writing to children, a caregiver writing instructions).

## The lifecycle (the heart of the product)
1. **Vigil set up.** The author picks a check-in cadence (default 30 days), a grace period (default 7 days) and how many witnesses must confirm (default 1).
2. **Letters sealed.** Each letter is rich text, encrypted in the author's browser, addressed to one recipient.
3. **Check-in.** One tap: "I still walk among the living." It resets the candle.
4. **Reminder.** Before the deadline the author is reminded.
5. **Grace.** After the deadline the author gets urgent reminders until the grace period ends.
6. **Confirm.** Witnesses (trusted contacts) are asked to confirm before anything is released. Any witness can say "they still live", which stops the release.
7. **Released.** Each recipient gets a one-time link. The letter decrypts in the recipient's browser and the server forgets the sealed copy.

The author can check in, pause or edit at any point before release. Release is final.

## Principles
- **False alarms are the worst failure.** Never release without either witness confirmation or a long, explicit silence window the author opted into.
- **The server should not be able to read letters.** Keep plaintext and full keys in the browser. Where a convenience mode weakens this, say so in plain words in the UI.
- **Clear before clever.** The interface is theatrical (candles, wax, parchment) but every state, deadline and action is stated in plain text too.
- **Accessible gothic.** WCAG AA contrast, full keyboard use, visible focus, `prefers-reduced-motion` honoured, status changes announced to screen readers.
- **Demo in 60 seconds.** A local "time machine" moves the clock so the full lifecycle can be shown live.

## Voice
Gothic and warm, never morbid or flippant. Buttons speak plainly with a candle-lit flourish ("Seal the letter", "I still walk among the living"). Error messages say what happened and what to do.

## Out of scope (for now)
Accounts with passwords, payments, mobile apps, SMS, legal estate services.
