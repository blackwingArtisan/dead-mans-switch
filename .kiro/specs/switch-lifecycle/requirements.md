# Requirements: Switch Lifecycle

## Introduction

Dead Man's Switch keeps letters for the people an author loves, sealed until the author can no longer check in. This spec covers the whole lifecycle: setting up a vigil, sealing letters in the browser, checking in, reminders, the grace period, witness confirmation, release through one-time links, and every path that cancels a release. It also covers the local time machine and outbox that let the full lifecycle be demonstrated in about a minute.

Terms used below:
- **Author**: the person writing letters and checking in.
- **Vigil**: the author's vault: settings, witnesses, letters and the current state.
- **Witness**: a trusted contact who confirms before anything is released.
- **Recipient**: the person a letter is addressed to.
- **Keepsake half (A)** and **vault half (B)**: the two halves of a letter's key, where K = A xor B.

## Requirement 1: Begin a vigil

**User story:** As an author, I want to start a vigil with my own cadence and grace period, so that the switch matches how often I can realistically check in.

#### Acceptance criteria
1. WHEN the author submits a name, an email address, a cadence and a grace period THE SYSTEM SHALL create a vigil in the `alive` state with the first check-in recorded at the current time.
2. THE SYSTEM SHALL default to a 30-day cadence, a 7-day grace period, a 3-day reminder lead, 1 required witness and a 14-day silence window.
3. IF the name is empty, the email is malformed, or a number is outside its allowed range THEN THE SYSTEM SHALL reject the request with a message naming the field and its allowed range.
4. WHEN a vigil is created THE SYSTEM SHALL return an owner token once and store only its SHA-256 hash.
5. WHILE a request to an author route lacks a valid owner token THE SYSTEM SHALL respond with 401 and change nothing.

## Requirement 2: Write and seal letters in the browser

**User story:** As an author, I want to write rich-text letters that are encrypted before they leave my browser, so that nobody can read them before they are released.

#### Acceptance criteria
1. THE SYSTEM SHALL let the author write a letter with a recipient name, a recipient email, an optional title, a rich-text body (bold, italic, heading, quotation, list) and a sign-off.
2. WHEN the author seals a letter THE SYSTEM SHALL generate a random 256-bit content key K and a random 96-bit IV in the browser and encrypt the letter with AES-GCM.
3. THE SYSTEM SHALL bind each ciphertext to its letter id as additional authenticated data.
4. WHEN a letter is sealed THE SYSTEM SHALL split K into a random keepsake half A and a vault half B = K xor A, and upload only the ciphertext, the IV, B and a SHA-256 tag of A.
5. IF the body is blank THEN THE SYSTEM SHALL refuse to seal and say so.
6. WHEN the author burns a letter before release THE SYSTEM SHALL delete it so it can never be released.
7. THE SYSTEM SHALL never log, display to the server or store letter plaintext or the full key K.

## Requirement 3: Choose who keeps the other half

**User story:** As an author, I want to choose between maximum privacy and maximum convenience for each letter, and be told the trade-off plainly.

#### Acceptance criteria
1. WHERE keepsake custody is chosen THE SYSTEM SHALL show the author a keepsake (a link whose URL fragment carries A, and a printable Crockford base32 code) to hand to the recipient out of band, and SHALL NOT send A to the server.
2. WHERE vault custody is chosen THE SYSTEM SHALL also store A on the server and include it in the release link fragment.
3. WHERE vault custody is offered THE SYSTEM SHALL state, before the author chooses it, that whoever runs the server could read that letter.
4. IF a keepsake-custody upload includes A THEN THE SYSTEM SHALL reject it.
5. IF a vault-custody upload includes an A that does not match its tag THEN THE SYSTEM SHALL reject it.
6. WHEN a recipient opens a keepsake link before release THE SYSTEM SHALL remember A in that browser and show the printable code, without contacting the server.

## Requirement 4: Check in with one tap

**User story:** As an author, I want to check in with a single tap, so that keeping the switch quiet takes no effort.

#### Acceptance criteria
1. WHEN the author taps "I still walk among the living" in the `alive`, `reminder`, `grace`, `confirm` or `paused` state THE SYSTEM SHALL record a check-in, return to `alive`, and restart the cadence from now.
2. WHEN the author checks in during `confirm` THE SYSTEM SHALL tell every asked witness to stand down and invalidate their witness links.
3. THE SYSTEM SHALL show the next deadline as a date and as a relative time, and announce the result to screen readers.
4. THE SYSTEM SHALL show the current stage on a five-step track (Alive, Reminder, Grace, Witnesses, Released).

## Requirement 5: Reminders and grace

**User story:** As an author, I want warnings before anything happens, so that a busy month never becomes a false alarm.

#### Acceptance criteria
1. WHEN the time reaches the deadline minus the reminder lead THE SYSTEM SHALL move from `alive` to `reminder` and send one reminder.
2. WHEN the time reaches the deadline THE SYSTEM SHALL move to `grace` and send a grace notice stating when witnesses will be asked.
3. WHEN the time reaches one day before the grace period ends THE SYSTEM SHALL send one last-call notice.
4. THE SYSTEM SHALL send each reminder at most once per cycle, however often the scheduler runs.
5. WHEN the scheduler runs after a long outage THE SYSTEM SHALL cascade through every stage that has come due in one run.

## Requirement 6: Witness confirmation

**User story:** As an author, I want people I trust to confirm before release, so that a lost phone or a long holiday never releases my letters.

#### Acceptance criteria
1. WHEN the grace period ends THE SYSTEM SHALL move to `confirm`, mint a fresh one-round link per witness, email each witness and notify the author.
2. WHEN the required number of witnesses (k of n) have confirmed THE SYSTEM SHALL release the letters.
3. THE SYSTEM SHALL never require more confirmations than there are witnesses.
4. WHEN any witness answers "they still live" THE SYSTEM SHALL stop the release, return to `grace` with a new full grace period, clear confirmations, invalidate witness links and warn the author.
5. IF a witness answers twice, answers outside `confirm`, or uses an invalidated link THEN THE SYSTEM SHALL refuse with a plain message.
6. WHEN a witness is named THE SYSTEM SHALL send them an introduction explaining that nothing is needed yet.
7. WHERE the author enabled a silence window, WHEN that many days pass in `confirm` with no denial THE SYSTEM SHALL release the letters.
8. WHERE the author disabled the silence window and named no witnesses THE SYSTEM SHALL warn that the letters can never be released.

## Requirement 7: Release and one-time opening

**User story:** As a recipient, I want to open my letter privately in my own browser, once, and keep a copy.

#### Acceptance criteria
1. WHEN letters are released THE SYSTEM SHALL mint one open token per letter and email the recipient a link to `/open/<token>`, with `#k=<A>` appended only in vault custody.
2. WHEN a recipient opens the link THE SYSTEM SHALL show who the letter is from and when it was sealed without spending the link.
3. WHERE the letter is in keepsake custody and this browser has no remembered keepsake THE SYSTEM SHALL ask for the keepsake link or code.
4. IF the supplied keepsake does not match the letter's tag THEN THE SYSTEM SHALL refuse before spending the link.
5. WHEN the recipient breaks the seal THE SYSTEM SHALL hand over the ciphertext and B once, delete the sealed copy from the server, and decrypt in the browser.
6. IF the link is used again THEN THE SYSTEM SHALL respond that the seal has already been broken.
7. THE SYSTEM SHALL sanitise decrypted HTML to an allow-list of formatting tags before rendering it.
8. THE SYSTEM SHALL offer to download and print the opened letter.
9. WHEN letters are released THE SYSTEM SHALL treat the vigil as final and refuse further changes.

## Requirement 8: Pause and resume

**User story:** As an author, I want to pause the vigil for travel or a hospital stay.

#### Acceptance criteria
1. WHEN the author pauses THE SYSTEM SHALL record a check-in, enter `paused` and stop every timer.
2. WHILE paused THE SYSTEM SHALL send no reminders and release nothing.
3. WHEN the author resumes THE SYSTEM SHALL return to `alive` with a fresh cadence.

## Requirement 9: Local time machine and outbox

**User story:** As a presenter, I want to move time forward and see every email, so that the full lifecycle can be shown in about a minute without sending real mail.

#### Acceptance criteria
1. WHERE the server runs with the machine clock and the outbox mailer THE SYSTEM SHALL expose a time machine that advances the clock by days or jumps to the next scheduled event, then runs the scheduler.
2. THE SYSTEM SHALL record every email in a local outbox with clickable links, and send nothing over the network.
3. WHERE the server runs with the real clock or a real mailer THE SYSTEM SHALL NOT expose the time machine, the outbox or the reset routes.

## Requirement 10: Accessible gothic interface

**User story:** As any user, including one using a keyboard or screen reader, I want the theatrical interface to stay clear.

#### Acceptance criteria
1. THE SYSTEM SHALL meet WCAG 2.2 AA contrast for text and controls.
2. THE SYSTEM SHALL be fully usable by keyboard, with a skip link and visible focus.
3. WHILE the user prefers reduced motion THE SYSTEM SHALL disable flicker, embers and seal animations.
4. THE SYSTEM SHALL state every state, deadline and consequence in text, never only through imagery.
5. THE SYSTEM SHALL lay out without horizontal scrolling at 360 px wide.
