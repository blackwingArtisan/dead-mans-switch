# How a candle became a state machine, built with Kiro

*A post and a short thread about Last Candle, a Kiroween 2026 entry in the Costume Contest. The numbers match [KIRO-LOG.md](../KIRO-LOG.md) and the README.*

## The post

Most dead man's switches are timers. Miss enough check-ins and your messages go out, whether you are gone or just hiking with no signal. Last Candle is built around a different picture: a vigil.

You write a letter to someone you love. It is sealed in your browser with AES-GCM-256, and its key is split in two. One half, the keepsake, goes to the recipient as a link or a printed card. The other half stays in the vault. Neither half alone opens anything. You keep a candle lit by checking in once a month. If you stop, the candle gutters, then goes out, and the people you trust are asked first. Any one of them can say "they still live" and the whole thing stands down. Only when a witness confirms does the recipient get a one-time link, and the letter opens in their browser, once, beside your own candle.

### The costume is the state machine

The app has one pure state machine: alive, reminder, grace, witnesses asked, released, paused. Instead of drawing it as a status badge, the whole page wears it. In grace the room turns a sickly green and the browser tab reads "(!) Your candle gutters". When the candle goes out the room goes near black and cold. A check-in is a match strike that relights the wick. The recipient reads by candlelight that follows their pointer. Every one of those states is also written in text and announced to screen readers, and reduced motion turns every effect into a straight cut. An axe audit of every page and room runs in the end-to-end suite and stays at zero violations.

### What Kiro did

Kiro did most of the building, in 13 logged sessions plus a spec review: 158 minutes, 221 credits and 6,150 lines of tests, code and spec. Every session is in [KIRO-LOG.md](../KIRO-LOG.md) with its prompt, its output and the lines from Kiro's own log.

- **It reviewed the spec against the code.** Kiro rewrote every acceptance criterion in strict EARS form, found 12 behaviors no test covered, and built all 12 plus 22 tasks it added along the way. Two of those tests caught real defects in the app.
- **It wrote two more specs from scratch.** The founder runbook came from a short feature description and was built in the same session. The AWS runtime spec was checked page by page against the AWS documentation through the aws-docs MCP server, and its DynamoDB store (conditional writes, a two-writer race where exactly one wins), conflict retry and SES mailer were built against fakes. Nothing is deployed.
- **It did the costume and the story.** It polished the rooms, measuring the grace room's green against WCAG AA itself. It scripted the false alarm, the keepsake card and the ending where June and Theo light candles back, the last of these from a single chat prompt with no spec. It also dressed the climax and the room's objects.
- **Hooks and MCP are on the record.** Its log shows 28 hook runs across sessions 6 to 14, and Context7 and AWS documentation calls whose sources are cited in the specs.

Claude Code wrote the first build and the security hardening from Kiro's steering files and a spec in Kiro's format, plus three small fixes during Kiro's sessions (25 lines in all). One of those fixes was a rate-limiter window that stuck after the demo clock reset, which only the longer story run exposed.

### What I would tell another builder

- Ask Kiro to review a spec against working code and to tick a task only when a test proves it. That one prompt found twelve real gaps.
- Group spec tasks by layer and run one session per layer. Short, explicit prompts finished in minutes; long ones ran into the session limit with the work done but the summary unwritten.
- Screenshot every UI change. Kiro's first width fix passed every test and still clipped a button's glow.
- Prove hooks and MCP on the record: read Kiro's own session log for the hook and tool lines rather than trusting a summary.
- Keep one vibe prompt beside the spec work. The same codebase took a chat-style request just as well, and the contrast shows what the spec adds: IDs that tie every test to a requirement.

Try it: [the live demo](https://dead-mans-switch-ce1.pages.dev) runs entirely in your browser. Press "Play the whole story".

## The thread

1. Every dead man's switch is a timer. I built one that is a vigil instead: a candle you keep lit, witnesses who can veto, and a key that is half on paper. #Kiroween
2. Each letter is sealed in your browser with AES-GCM-256. The key splits in two: the recipient holds one half, the vault the other. Neither alone opens it.
3. Stop checking in and the room dies with the candle: green in grace, black when it goes out. Any witness can stop it with one tap and a note: "Mara was hiking."
4. The recipient breaks the seal once and reads by your own candle. Then they light one back. Then they can light one back.
5. Kiro built most of it in 13 logged sessions: 6,150 lines, 3 specs (one checked against the AWS docs through MCP), 28 hook runs on the record. Every session's prompt and log is in the repo.
6. Live demo, no sign-up, runs in your browser: https://dead-mans-switch-ce1.pages.dev
