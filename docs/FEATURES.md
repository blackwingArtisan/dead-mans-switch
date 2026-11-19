# Features

Everything Dead Man's Switch does today, in more detail than the [README](../README.md). Running and testing it is in [RUNNING.md](RUNNING.md); layers, the state machine and the seal are in [ARCHITECTURE.md](ARCHITECTURE.md).

## What works today

- Begin a vigil with your own cadence, grace period, reminder lead, witnesses-required (k of n) and an optional silence window.
- Write rich-text letters on parchment; seal them with AES-GCM-256 in the browser.
- Two custody modes per letter:
  - **Keepsake** (default): the recipient holds half the key, handed over by you as a link or a printed card with a QR code. The server can never read the letter. Sealing shows the split: half A goes on the card, half B stays in the vault, and neither opens anything alone.
  - **Vault**: the server holds both halves, so there is nothing to hand over. The UI says plainly that the operator could read it.
- One-tap check-in, pause and resume, and an **Add it to your calendar** reminder (a repeating `.ics` event on your cadence, with nothing secret in it).
- Reminder, grace, last-call, witness, stand-down, denial and release emails (plain text and HTML).
- Witness page with a two-step confirm and a one-tap "they still live" that stops the release.
- Recipient page: keepsake check before spending the link, the seal cracks, the letter unfolds; download and print; the server forgets its copy.
- **A candle lit back**: after reading, a recipient can leave one line ("I found the blue tin"). The witnesses and the other recipients are told by email, the others see it beside their own letters, and the author's headstone carries it.
- **One-tap check-in from email**: reminder and grace emails carry a link that checks in from any device, even one that has never opened the vigil. The page asks for a press first (mail scanners that follow links change nothing), the link can do nothing but check in, and a check-in spends every link from that cycle. Only a SHA-256 hash of each link is stored.
- **Time machine** (local only): move the clock forward a day, a week, a month or to the next event, and read every email in the outbox. The whole lifecycle runs in about a minute.
- **Play the whole story** (local only): a captioned, hands-off run from a lit candle to a letter read by candlelight.
- **The room follows the candle**: glow, embers, smoke, moonlight and palette change with the state, and a check-in relights it.
- **Their candle, your light**: the opened letter starts dark, with a wide warm light on its first lines that then follows the reader's pointer or finger, and the room lights itself after eight seconds. Beside it stands the author's own candle, at the wax height and date of their last check-in: "This is the candle Mara kept until ...". It is the closing shot of Play the whole story.
- **Two demo vigils**: Mara writing to her family, and Priya, a founder, writing to her co-founder about the accounts only she holds.
- A demo guide that says what to try next at each stage.
- An honest "How the seal works" page, with one drawing of the key's journey (made and split in your browser, half A with the recipient, half B in the vault, joined only in the recipient's browser) and what the vault can and cannot see.

## What if this service ends before you do?

A vigil can outlast a web service, so it is built not to depend on one:

- **MIT-licensed and self-hostable** on a free Cloudflare Workers plan (see [docs/ARCHITECTURE.md](ARCHITECTURE.md)).
- **A stated sunset policy:** if the service ever closes, every author gets at least 90 days' notice and a sealed export of their letters, released letters stay openable until the notice ends, and nothing is deleted silently.
- **Your own sealed copy, any time:** **Export the sealed letters** on the vigil downloads each unopened letter exactly as the vault holds it. A keepsake-custody letter in the export is still unreadable without its keepsake.
- **[`offline-open.html`](../src/web/public/offline-open.html):** one self-contained page that opens a letter from the export and a keepsake in any browser, offline, with no server. It is tested against the app's own sealing code (Vitest) and opened from disk with the network off (Playwright).
