# Last Candle: a dead man's switch for letters

**[Live demo](https://dead-mans-switch-ce1.pages.dev) · [Play the whole story](https://dead-mans-switch-ce1.pages.dev/?story=1) · [Judge's 60-second path](#judges-60-second-path) · [Evidence map](docs/JUDGES.md) · [Kiro log](KIRO-LOG.md)**

The live demo runs entirely in your browser and keeps its data in this browser's storage; real email delivery needs the Node server or the Cloudflare Worker.

**Write letters for the people you love, sealed until you can no longer check in.**

*Every other dead man's switch is a timer. This one is a vigil: a candle you keep lit, witnesses who can veto, and a key that is half on paper.*

> **What no one else does**
> 1. **The recipient holds half the key.** In keepsake custody the vault never holds enough to read a letter, so not even we can.
> 2. **Any witness can veto.** A lost phone or a long holiday never sends a letter: one "they still live" stops the release.
> 3. **The room is the state machine.** Lit, guttering, out: the candle and the whole page show exactly where the vigil stands.
>
> *Twelve taps a year is the whole job.* Success is candles still lit after twelve months.

[![CI](https://github.com/blackwingArtisan/dead-mans-switch/actions/workflows/ci.yml/badge.svg)](https://github.com/blackwingArtisan/dead-mans-switch/actions/workflows/ci.yml)

![The whole story, hands-off: the candle burns, gutters in grace and goes out as the room dies with it; a witness stops a false alarm, then confirms; the recipients read by the author's own candle and light two candles back.](docs/media/story.gif)

*A 7-second time-lapse of the story, as **Play the whole story** runs it in about 68 seconds: Mara's candle burns, a missed month turns the room green and the candle goes out, her witness Silas stops a false alarm, the second time he confirms, June brings her keepsake and reads by Mara's own candle, and June and Theo each light a candle back.*

**Costume Contest: the candle is the state machine, and the whole room wears it.** Built for Kiroween 2026. Not an account handover: a letter, in your words, that nobody (not even us) can open until the people you trust agree you are gone.

[Judge's 60-second path](#judges-60-second-path) · [Why not Google or Apple?](#why-not-the-tools-you-already-have) · [The costume](#the-costume) · [Built with Kiro](#built-with-kiro) · [Evidence map](docs/JUDGES.md) · [Features](docs/FEATURES.md) · [Running and testing](docs/RUNNING.md) · [Architecture](docs/ARCHITECTURE.md) · [Kiro log](KIRO-LOG.md) · [Changelog](CHANGELOG.md)

> ### Judge's 60-second path
>
> Open the [live demo](https://dead-mans-switch-ce1.pages.dev) (or run `npm install && npm run demo` and open http://localhost:3140) and press **▶ Play the whole story**: a captioned, hands-off run from a lit candle, through a false alarm, to two letters read by candlelight, in about 68 seconds. To drive it yourself instead:
>
> 1. Press **Try a demo vigil**. You are Mara, with two sealed letters and two witnesses.
> 2. Open the **Time machine** (the hourglass) and press **+30 days**: the flame gutters, the tab reads "(!) Your candle gutters" and the grace email lands in the outbox.
> 3. Press **+7 days**: the candle goes out. In the outbox, open the first **Witness asked** and confirm as Silas.
> 4. Open **Letter released** for June and break the seal. The letter decrypts in that tab, once, beside Mara's own candle.

## Why it matters

- **[63% of people who had carried out a will said getting into the dead person's accounts was harder than they expected](https://www.helpnetsecurity.com/2021/11/15/digital-handover/)** (1Password survey of 1,000 U.S. adults aged 25 to 40, 2021). The missing piece is rarely money; it is the note that says where things are.
- **[3,072,666 people died in the U.S. in 2024](https://www.cdc.gov/nchs/fastats/deaths.htm)** (CDC), and **[only 46% of U.S. adults have a will](https://news.gallup.com/poll/351500/how-many-americans-have-will.aspx)** (Gallup, 2021). Not one of those wills tells your sister where the password sheet is.
- **[29.8 million U.S. small businesses have no employees](https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf)** (SBA Office of Advocacy, 2026, from 2022 data). In each one, a single person holds every account.
- **People already pay for a place to leave things behind:** [Everplans Premium](https://www.everplans.com/pricing) is $99.99 a year, [Trustworthy](https://www.trustworthy.com/pricing) starts at $10 a month billed yearly, and [GoodTrust](https://mygoodtrust.com/pricing) lists $149 for a will or trust. Figures checked at each linked source on 2026-11-18; the 1Password survey was checked on 2026-11-22.

**Who keeps a vigil:** Mara, 58, writing to her son and her best friend; Priya, who runs a two-person company with no employees and whose co-owner needs the recovery codes if she is in hospital when the contractors' invoices and the domain renewal fall due; and Ruth, a hospice social worker who hands families a printed keepsake kit.

## Why not the tools you already have?

| Tool | What it hands over | Who can read it first | Who checks before it goes | Works for |
|---|---|---|---|---|
| Google Inactive Account Manager | Google account data, plus one notice email | Google holds the data | No one: an inactivity timer decides | Google accounts only |
| Apple Legacy Contact | Apple account data | Apple holds the data | Apple, after a death certificate | Apple accounts only |
| Bitwarden Emergency Access | The whole password vault | No one (end-to-end encrypted) | Only you, by rejecting within a wait time | Bitwarden Premium users |
| deadmansswitch.net | Pre-written emails | Not stated on its site | No one: missed reminders release them | Any email address |
| [GoodTrust Future Messages](https://mygoodtrust.com/future-message) | Video, photo or text messages | GoodTrust stores them (AES-256; not stated as end-to-end) | No one: they go out on dates you choose | Email or your social accounts |
| [Everplans letters](https://www.everplans.com/blog/keep-things-private-until-after-youre-gone) (Sharing After Death) | A "Letters to Family & Friends" section of your plan | Everplans stores the plan | One deputy reports your death; only you can block it, by email, within up to 30 days | Everplans members and their deputies |
| [SafeBeyond](https://www.prnewswire.com/news-releases/safebeyond-launches-the-worlds-first-posthumous-message-delivery-platform-300150111.html) | Messages, videos and files on a date, event or place | Stored in its cloud; encryption not stated | Trustees you name report your death | Its mobile app (safebeyond.com no longer resolves) |
| **Last Candle** | **A sealed letter for each person, in your words** | **No one in keepsake custody: the recipient holds half the key** | **Witnesses you name; any one of them can stop it** | **Any browser, any email** |

The big platforms hand over accounts. This hands over the words, and even we cannot read them. The three posthumous-message rows were checked at each product's own pages on 2026-11-19.

## The costume

| | |
|---|---|
| ![Landing page: a lit candle beside "Some words should wait."](docs/media/landing.jpg) | ![Grace: the flame gutters and the room turns sickly green](docs/media/grace.jpg) |
| ![Witnesses asked: the candle is out, the room is cold blue-black and smoky](docs/media/candle-out.jpg) | ![The recipient reads by candlelight](docs/media/letter-by-candlelight.jpg) |

The app wears its own state. The candle is the state machine, drawn, and the whole room follows it:

| Stage | What you see | What it means |
|---|---|---|
| Alive | A full candle, a steady flame, warm embers drifting | You checked in; nothing will be sent |
| Reminder | The wax burns down with the days left | Your check-in is due soon |
| Grace | The flame gutters, the glow halves, the embers slow, and the browser tab reads "(!) Your candle gutters" | You missed it; reminders keep coming |
| Witnesses asked | The candle is out and smoking; the room goes near black, cold and smoky | The people you trust are asked to confirm |
| Check-in | A match strike: the wick flares, the wax grows back, sparks leave the seal, the warmth returns | Everything is cancelled and the witnesses stand down |
| Released | A cracked seal, a moonlit room, and a letter read by the light of one candle | Each recipient opens their letter once |

Wax seals carry each recipient's initial, the check-in is a seal you press, and the recipient breaks a seal to read beside the author's own candle. Every fact the room shows is also stated in text and announced to screen readers; under reduced motion each change is instant.

## Plans, after Kiroween

- **Free** for one vigil with a few letters. Today every vigil is free.
- **Keepsake, $39 for ten years of vigil, then $5 a year:** more letters and witnesses, and a printed keepsake kit, one card per person. Hospice social workers and estate attorneys are the referrers.
- **Founder, a flat $8 a month per business, with up to 5 recipients:** a bus-factor plan where the letter is the runbook for the accounts only one person holds.
- **What a vigil costs to keep:** about 20 emails a year ([Resend](https://resend.com/pricing), $0.90 per 1,000 past the plan) and under 1 MB of sealed letters ([Cloudflare Workers KV](https://developers.cloudflare.com/kv/platform/pricing/), $0.50 per GB-month): about 2 cents a year, or about 20 cents over ten years, on top of about $25 a month in fixed plans ([Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) $5, Resend Pro $20). That is why $39 for ten years is a deliberate wedge, not a loss. Prices checked on 2026-11-22.
- **The hospice channel, one assumption per line:**
  1. More than 1.7 million Medicare patients received hospice care in 2023, from about 6,500 hospices ([MedPAC, March 2025](https://medpac.gov/wp-content/uploads/2025/03/Mar25_Ch9_MedPAC_Report_To_Congress_SEC.pdf), checked 2026-11-22).
  2. Assume 1 hospice in 100 hands families the keepsake kit: about 17,000 families a year.
  3. Assume 1 family in 10 then keeps a vigil at $39: about 1,700 vigils, or about $66,000 a year.
  4. A channel to test with a few hospices first, not a forecast.
- **Built to outlive us:** MIT-licensed and self-hostable, a stated sunset policy, a sealed export of every letter, and [`offline-open.html`](src/web/public/offline-open.html), which opens a letter and its keepsake with no server. Details in [docs/FEATURES.md](docs/FEATURES.md).

## Run and test it

Node 20 or newer. `npm install && npm run demo` serves everything on http://localhost:3140 with the time machine on; `npm run check` runs the typecheck, the unit suite, a production build and Playwright. Current suite: <!-- test-counts -->232 unit tests in 31 files, all passing, and 89 end-to-end runs (desktop and phone) in 14 Playwright files.<!-- /test-counts -->

The end-to-end suite seals a letter, lets the candle go out, confirms as a witness and opens the letter once in a fresh browser, and runs an axe WCAG 2.2 AA audit of every page and state. More in [docs/RUNNING.md](docs/RUNNING.md).

## How it is built

React and Vite in the browser, a Hono API, and a pure state machine shared by both, with the clock, the store and the mailer behind ports. It runs on Node locally and is written for the Cloudflare Workers free plan. Each letter gets a random key K, split into a keepsake half A that the recipient holds and a vault half B = K xor A that the server holds. See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Built with Kiro

**Kiro reviewed the spec, found 12 untested behaviors, built all 12 plus 22 tasks it added, caught 2 real app defects, checked a Cloudflare binding and an AWS runtime design against live docs through MCP, polished the costume, scripted the story's false alarm, keepsake card and ending, dressed the climax and the room's objects, wrote two more specs from scratch and built them, specified a séance seal that no one can open alone, and added 6,150 lines of tests, code and spec in 13 logged sessions.** Every session is in **[KIRO-LOG.md](KIRO-LOG.md)** with its prompt, minutes, credits, files and test results, and Kiro's own output is in [docs/kiro-sessions/](docs/kiro-sessions). The evidence for each judging criterion is mapped in [docs/JUDGES.md](docs/JUDGES.md).

**Who wrote what**

| Who | What | Lines |
|---|---|---|
| Kiro (kiro-cli 3.4.0 and 3.5.0, custom agent) | The EARS review of the spec and the 34 tasks it wrote into it; the `RateLimiter` port and adapters; every test in group 9; two app fixes; the rate-limit binding checked against Cloudflare's docs; the IV length check; the costume polish in group 10; the story beats in group 11; the story's ending, from a vibe prompt; the founder-runbook spec, written and built; the climax and room objects in group 12; the AWS runtime spec, its DynamoDB store, conflict retry and SES mailer; the séance seal's spec and Shamir core | 6,150 added, across 13 commits marked `Built-with: Kiro` |
| Claude Code | The first build and the security hardening, from the Kiro steering files and a spec in Kiro's format; the copy, the README and the logs; three small fixes, 25 lines in all: two after screenshot reviews, and a rate-limiter fix that the longer suite exposed | Everything else |
| The developer | The idea, the product decisions, and review of every commit | |

**Kiro feature checklist**

| Feature | Used | Evidence |
|---|---|---|
| Specs | Yes: the switch-lifecycle spec, reviewed into EARS form by Kiro, with 34 tasks Kiro wrote and built; the founder-runbook spec, which Kiro wrote from a feature description and built in one session; and the aws-release-runtime spec, written from the AWS docs, with its store, conflict retry and SES mailer built against fakes | [`.kiro/specs/`](.kiro/specs), [session 3](docs/kiro-sessions/session-3-unit-and-api-gaps.md) to [session 8](docs/kiro-sessions/session-8-story-beats.md), [session 10](docs/kiro-sessions/session-10-founder-runbook.md), [sessions 12](docs/kiro-sessions/session-12-aws-runtime-spec.md) and [13](docs/kiro-sessions/session-13-aws-retry-and-ses.md) |
| Steering | Yes: 3 files always loaded, plus `crypto.md` and `a11y.md`, which load only when a matching file is in play; Kiro reported `crypto.md` arriving when it opened `crypto.ts` | [`.kiro/steering/`](.kiro/steering), [session 6](docs/kiro-sessions/session-6-mcp-hooks-crypto.md) |
| Hooks | Yes: 4 workspace hooks plus the agent's SessionStart hook; 28 runs recorded in Kiro's own session logs across sessions 6 to 14, with the open-task list and the crypto-custody reminder quoted by Kiro | [`.kiro/hooks/`](.kiro/hooks), [session 6](docs/kiro-sessions/session-6-mcp-hooks-crypto.md) |
| Custom agent | Yes: `dead-mans-switch` ran sessions 3 to 14 | [`.kiro/agents/dead-mans-switch.json`](.kiro/agents/dead-mans-switch.json) |
| MCP | Yes: Context7 called 4 times in session 6 to check the Workers Rate Limiting binding and the Kiro agent hook format; in session 12, 11 AWS documentation calls (DynamoDB, SES v2, EventBridge Scheduler, Lambda) and 2 Context7 calls, each source cited in the AWS spec's design | [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json), [session 6](docs/kiro-sessions/session-6-mcp-hooks-crypto.md), [sessions 12](docs/kiro-sessions/session-12-aws-runtime-spec.md) and [13](docs/kiro-sessions/session-13-aws-retry-and-ses.md) |
| Vibe coding | Yes: one conversational prompt with no spec built the story's ending, "One went out. Two were lit.", with its tests | [session 9](docs/kiro-sessions/session-9-vibe-room-fills.md) |

`tests/unit/kiro-config.test.ts` keeps the hooks, the agent and the MCP settings valid, and every new test Kiro wrote names the criterion it proves, such as "(Req 10.5)".

## Accessibility

WCAG AA contrast, full keyboard use with a skip link and visible focus, every state stated in text beside the candle, status changes announced, and `prefers-reduced-motion` respected.

## License

MIT © 2026 Stubborn Otter Software
