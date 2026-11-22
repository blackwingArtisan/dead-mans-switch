# Requirements: Switch Lifecycle

## Introduction

Dead Man's Switch keeps letters for the people an author loves, sealed until the author can no longer check in. This spec covers the whole lifecycle: setting up a vigil, sealing letters in the browser, checking in, reminders, the grace period, witness confirmation, release through one-time links, and every path that cancels a release. It also covers the local time machine and outbox that let the full lifecycle be demonstrated in about a minute.

Terms used below:
- **Author**: the person writing letters and checking in.
- **Vigil**: the author's vault: settings, witnesses, letters and the current state.
- **Witness**: a trusted contact who confirms before anything is released.
- **Recipient**: the person a letter is addressed to.
- **Keepsake half (A)** and **vault half (B)**: the two halves of a letter's key, where K = A xor B.

Criteria use EARS: `WHEN` (event), `WHILE` (state), `WHERE` (optional feature), `IF ... THEN` (unwanted event), or no keyword when the behavior is unconditional. Each criterion states one testable behavior. Numbers are stable: new criteria are appended at the end of their requirement.

## Requirement 1: Begin a vigil

**User story:** As an author, I want to start a vigil with my own cadence and grace period, so that the switch matches how often I can realistically check in.

#### Acceptance criteria
1. WHEN the author submits a name, an email address, a cadence and a grace period THE SYSTEM SHALL create a vigil in the `alive` state.
2. WHEN a vigil is created without explicit settings THE SYSTEM SHALL apply a 30-day cadence, a 7-day grace period, a 3-day reminder lead, 1 required witness and a 14-day silence window.
3. IF the name is empty, the email is malformed, or a number is outside its allowed range THEN THE SYSTEM SHALL reject the request with a message naming the field and its allowed range.
4. WHEN a vigil is created THE SYSTEM SHALL return an owner token once.
5. IF a request to an author route lacks a valid owner token THEN THE SYSTEM SHALL respond with 401.
6. WHEN a vigil is created THE SYSTEM SHALL record the first check-in at the current time.
7. WHEN a vigil is created THE SYSTEM SHALL store only the SHA-256 hash of the owner token.
8. IF a request to an author route lacks a valid owner token THEN THE SYSTEM SHALL leave every vigil unchanged.

## Requirement 2: Write and seal letters in the browser

**User story:** As an author, I want to write rich-text letters that are encrypted before they leave my browser, so that nobody can read them before they are released.

#### Acceptance criteria
1. WHEN the author opens the writing desk THE SYSTEM SHALL offer fields for a recipient name, a recipient email, an optional title, a rich-text body (bold, italic, heading, quotation, list) and a sign-off.
2. WHEN the author seals a letter THE SYSTEM SHALL generate a random 256-bit content key K and a random 96-bit IV in the browser.
3. WHEN the author seals a letter THE SYSTEM SHALL bind the ciphertext to the letter id as additional authenticated data.
4. WHEN the author seals a letter THE SYSTEM SHALL split K into a random keepsake half A and a vault half B = K xor A.
5. IF the body is blank THEN THE SYSTEM SHALL refuse to seal and show a message saying so.
6. WHEN the author burns a letter before release THE SYSTEM SHALL delete it so that it cannot be released.
7. THE SYSTEM SHALL NOT send letter plaintext or the full key K to the server.
8. WHEN the author seals a letter THE SYSTEM SHALL encrypt it with AES-GCM in the browser.
9. WHEN a letter is sealed THE SYSTEM SHALL upload only the ciphertext, the IV, B and a SHA-256 tag of A (plus A itself only where vault custody is chosen).
10. THE SYSTEM SHALL NOT log letter plaintext, the key K or either key half.
11. IF a sealed letter's IV does not decode to exactly 12 bytes THEN THE SYSTEM SHALL refuse to open it with the message "The letter is damaged: its seal is the wrong length." before attempting decryption.

## Requirement 3: Choose who keeps the other half

**User story:** As an author, I want to choose between maximum privacy and maximum convenience for each letter, and be told the trade-off plainly.

#### Acceptance criteria
1. WHERE keepsake custody is chosen THE SYSTEM SHALL show the author a keepsake (a link whose URL fragment carries A, and a printable Crockford base32 code) to hand to the recipient out of band.
2. WHERE vault custody is chosen THE SYSTEM SHALL store A on the server alongside B.
3. WHERE vault custody is offered THE SYSTEM SHALL state, before the author chooses it, that whoever runs the server could read that letter.
4. IF a keepsake-custody upload includes A THEN THE SYSTEM SHALL reject it.
5. IF a vault-custody upload includes an A that does not match its tag THEN THE SYSTEM SHALL reject it.
6. WHEN a recipient opens a keepsake link before release THE SYSTEM SHALL remember A in that browser.
7. WHERE keepsake custody is chosen THE SYSTEM SHALL NOT send A to the server.
8. WHEN a recipient opens a keepsake link before release THE SYSTEM SHALL show the printable code.
9. WHEN a recipient opens a keepsake link THE SYSTEM SHALL NOT contact the server with A.

## Requirement 4: Check in with one tap

**User story:** As an author, I want to check in with a single tap, so that keeping the switch quiet takes no effort.

#### Acceptance criteria
1. WHEN the author taps "I still walk among the living" in the `alive`, `reminder`, `grace`, `confirm` or `paused` state THE SYSTEM SHALL record a check-in at the current time and return to `alive`.
2. WHEN the author checks in during `confirm` THE SYSTEM SHALL tell every asked witness to stand down.
3. THE SYSTEM SHALL show the next deadline as a date and as a relative time.
4. WHILE the vigil is not released THE SYSTEM SHALL show the current stage on a five-step track (Alive, Reminder, Grace, Witnesses, Released).
5. WHEN a check-in is recorded THE SYSTEM SHALL set the next deadline to the check-in time plus the cadence.
6. WHEN the author checks in during `confirm` THE SYSTEM SHALL invalidate every witness link.
7. WHEN a check-in completes THE SYSTEM SHALL announce the result to screen readers.

## Requirement 5: Reminders and grace

**User story:** As an author, I want warnings before anything happens, so that a busy month never becomes a false alarm.

#### Acceptance criteria
1. WHEN the time reaches the deadline minus the reminder lead THE SYSTEM SHALL move from `alive` to `reminder`.
2. WHEN the time reaches the deadline THE SYSTEM SHALL move to `grace`.
3. WHEN the time reaches one day before the grace period ends THE SYSTEM SHALL send one last-call notice.
4. WHEN the scheduler runs more than once in a cycle THE SYSTEM SHALL send each reminder at most once in that cycle.
5. WHEN the scheduler runs after a long outage THE SYSTEM SHALL process every stage that has come due within that single run.
6. WHEN the vigil moves to `reminder` THE SYSTEM SHALL send the author one reminder.
7. WHEN the vigil moves to `grace` THE SYSTEM SHALL send the author a grace notice stating when witnesses will be asked.

## Requirement 6: Witness confirmation

**User story:** As an author, I want people I trust to confirm before release, so that a lost phone or a long holiday never releases my letters.

#### Acceptance criteria
1. WHEN the grace period ends THE SYSTEM SHALL move to `confirm`.
2. WHEN the required number of witnesses (k of n) have confirmed THE SYSTEM SHALL release the letters.
3. IF the required number of confirmations exceeds the number of witnesses THEN THE SYSTEM SHALL require only as many confirmations as there are witnesses.
4. WHEN any witness answers "they still live" THE SYSTEM SHALL stop the release and return to `grace` with a new full grace period.
5. IF a witness answers a second time THEN THE SYSTEM SHALL refuse with a plain message.
6. WHEN a witness is named THE SYSTEM SHALL send them an introduction explaining that nothing is needed yet.
7. WHERE the author enabled a silence window, WHEN that many days pass in `confirm` with no denial THE SYSTEM SHALL release the letters.
8. IF the silence window is disabled and no witness is named THEN THE SYSTEM SHALL warn the author that the letters can never be released.
9. WHEN the vigil moves to `confirm` THE SYSTEM SHALL mint a fresh one-round link per witness.
10. WHEN the vigil moves to `confirm` THE SYSTEM SHALL email each witness their link.
11. WHEN the vigil moves to `confirm` THE SYSTEM SHALL notify the author that witnesses have been asked.
12. WHEN any witness answers "they still live" THE SYSTEM SHALL clear every recorded confirmation.
13. WHEN any witness answers "they still live" THE SYSTEM SHALL invalidate every witness link.
14. WHEN any witness answers "they still live" THE SYSTEM SHALL warn the author.
15. IF a witness answers while the vigil is not in `confirm` THEN THE SYSTEM SHALL refuse with a plain message.
16. IF a witness uses an invalidated link THEN THE SYSTEM SHALL refuse with a plain message.
17. WHEN the vigil moves to `confirm` THE SYSTEM SHALL start the silence window from the moment witnesses were asked, not from a back-dated threshold.

## Requirement 7: Release and one-time opening

**User story:** As a recipient, I want to open my letter privately in my own browser, once, and keep a copy.

#### Acceptance criteria
1. WHEN letters are released THE SYSTEM SHALL mint one open token per letter.
2. WHEN a recipient opens the link THE SYSTEM SHALL show who the letter is from and when it was sealed.
3. WHERE the letter is in keepsake custody and this browser has no remembered keepsake THE SYSTEM SHALL ask for the keepsake link or code.
4. IF the supplied keepsake does not match the letter's tag THEN THE SYSTEM SHALL refuse before spending the link.
5. WHEN the recipient breaks the seal THE SYSTEM SHALL hand over the ciphertext, the IV and B once.
6. IF the link is used again THEN THE SYSTEM SHALL respond that the seal has already been broken.
7. WHEN a decrypted letter is rendered THE SYSTEM SHALL sanitise its HTML to an allow-list of formatting tags first.
8. WHEN a letter has been opened THE SYSTEM SHALL offer to download it.
9. WHILE the vigil is `released` THE SYSTEM SHALL refuse every change to it.
10. WHEN letters are released THE SYSTEM SHALL email each recipient a link to `/open/<token>`.
11. WHERE the letter is in vault custody THE SYSTEM SHALL append `#k=<A>` to the release link.
12. WHERE the letter is in keepsake custody THE SYSTEM SHALL NOT include A in the release link or email.
13. WHEN a recipient opens the link THE SYSTEM SHALL NOT spend the link.
14. WHEN the recipient breaks the seal THE SYSTEM SHALL delete the sealed copy from the server.
15. WHEN the recipient breaks the seal THE SYSTEM SHALL decrypt the letter in the recipient's browser.
16. WHEN a letter has been opened THE SYSTEM SHALL offer to print it.

## Requirement 8: Pause and resume

**User story:** As an author, I want to pause the vigil for travel or a hospital stay.

#### Acceptance criteria
1. WHEN the author pauses THE SYSTEM SHALL record a check-in and enter `paused`.
2. WHILE the vigil is `paused` THE SYSTEM SHALL send no reminders.
3. WHEN the author resumes THE SYSTEM SHALL return to `alive` with a fresh cadence.
4. WHILE the vigil is `paused` THE SYSTEM SHALL release nothing.

## Requirement 9: Local time machine and outbox

**User story:** As a presenter, I want to move time forward and see every email, so that the full lifecycle can be shown in about a minute without sending real mail.

#### Acceptance criteria
1. WHERE the server runs with the machine clock and the outbox mailer THE SYSTEM SHALL expose a time machine that advances the clock by a number of days.
2. WHERE the server runs with the outbox mailer, WHEN an email is due THE SYSTEM SHALL record it in a local outbox with clickable links.
3. WHERE the server runs with the real clock or a real mailer THE SYSTEM SHALL NOT expose the time machine, the outbox or the reset routes.
4. WHEN the operator has not asked for the time machine THE SYSTEM SHALL use the real clock.
5. IF the time machine is requested for a base URL that is not a localhost origin THEN THE SYSTEM SHALL refuse to start.
6. WHERE the time machine is exposed THE SYSTEM SHALL let the presenter jump the clock to the next scheduled event.
7. WHEN the time machine moves the clock THE SYSTEM SHALL run the scheduler.
8. WHERE the server runs with the outbox mailer THE SYSTEM SHALL NOT send email over the network.

## Requirement 10: Accessible gothic interface

**User story:** As any user, including one using a keyboard or screen reader, I want the theatrical interface to stay clear.

#### Acceptance criteria
1. THE SYSTEM SHALL meet WCAG 2.2 AA contrast for text and controls.
2. THE SYSTEM SHALL be fully usable by keyboard.
3. WHILE the user prefers reduced motion THE SYSTEM SHALL disable all animation, including candle flicker, embers and seal animations.
4. THE SYSTEM SHALL state every state, deadline and consequence in text.
5. WHEN the viewport is 360 px wide THE SYSTEM SHALL lay out without horizontal scrolling.
6. THE SYSTEM SHALL provide a skip link to the main content.
7. WHEN a control has keyboard focus THE SYSTEM SHALL show a visible focus indicator.
8. WHEN the vigil changes state THE SYSTEM SHALL announce the new state to screen readers.
9. THE SYSTEM SHALL hide decorative graphics (wax seals and candle) from assistive technology.
10. WHEN a wax seal carries a mark THE SYSTEM SHALL draw that mark as a single glyph at every size from 58 to 150 px.

## Requirement 11: Response hardening

**User story:** As a recipient opening a letter, I want the page that decrypts it to be locked down, so that a flaw in the letter's HTML cannot leak my keepsake or the letter.

#### Acceptance criteria
1. THE SYSTEM SHALL send a Content-Security-Policy that allows scripts only from its own origin on every response.
2. THE SYSTEM SHALL send `X-Frame-Options: DENY` on every response.
3. WHEN one client exceeds the request limit on witness or letter links within a window THE SYSTEM SHALL answer 429.
4. THE SYSTEM SHALL send a Content-Security-Policy that blocks plugins on every response.
5. THE SYSTEM SHALL send a Content-Security-Policy that forbids framing on every response.
6. THE SYSTEM SHALL send a Content-Security-Policy that limits network requests to its own origin on every response.
7. THE SYSTEM SHALL send `X-Content-Type-Options: nosniff` on every response.
8. THE SYSTEM SHALL send `Referrer-Policy: no-referrer` on every response.
9. THE SYSTEM SHALL send a closed `Permissions-Policy` on every response.
10. THE SYSTEM SHALL send `Cross-Origin-Opener-Policy: same-origin` on every response.
11. WHEN the system answers 429 on a witness or letter link THE SYSTEM SHALL include a `Retry-After` header with the seconds to wait.
12. WHEN the rate-limit window passes THE SYSTEM SHALL accept requests from that client again.
13. WHERE a Cloudflare Workers Rate Limiting binding is configured THE SYSTEM SHALL count witness and letter link requests through that binding.
14. WHERE no rate-limiting binding is configured THE SYSTEM SHALL count requests in memory, per process or isolate.
15. IF the rate-limiting binding fails THEN THE SYSTEM SHALL allow the request.
