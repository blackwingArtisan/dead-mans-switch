# Requirements: Founder Runbook

## Introduction

Many small companies have one person who alone holds the accounts that keep the business alive. Last Candle already seals letters that open only when the author stops checking in and a witness confirms. This spec adds two things: a letter template that turns a letter into a runbook (where each critical account lives, who to call, when it renews), and a yearly review nudge so the runbook does not go stale.

A runbook is an ordinary letter. It uses the same AES-GCM seal and the same custody choices as every other letter, and the server learns nothing new about it. The nudge is a line in the author's existing reminder email and a note on the author's vigil. It never changes the vigil's state and never reaches recipients or witnesses.

Terms used below:
- **Runbook**: a letter written from the "Founder runbook" template.
- **Section**: one account kind in a runbook, with three fields.
- **Account kind**: one of cloud root account, domain registrar, payments and contractor payouts, bank, password manager.
- **Likely secret**: text in a draft that looks like a password, a recovery code or a key.
- **Review age**: the time since the oldest sealed, unreleased letter was sealed.

Criteria use EARS, as in the switch-lifecycle spec. Each states one testable behavior. Numbers are stable: new criteria are appended at the end of their requirement. Tests cite criteria as "(Founder Req N.M)".

## Requirement 1: Start a letter from the Founder runbook template

**User story:** As a founder who alone holds the company's accounts, I want a template that asks the right questions, so that the person who inherits my accounts knows where to look and whom to call.

#### Acceptance criteria
1. WHEN the author opens the writing desk THE SYSTEM SHALL offer "Start from the Founder runbook" and "Start from a blank page", with the blank page chosen by default.
2. WHEN the author chooses the runbook THE SYSTEM SHALL show one section for each account kind, in this order: cloud root account, domain registrar, payments and contractor payouts, bank, password manager.
3. THE SYSTEM SHALL ask each section for three things: where the login and the recovery codes live, who to call, and the renewal or due date.
4. WHEN the author removes a section THE SYSTEM SHALL leave it out of the letter.
5. WHEN the author adds an account kind that is not shown THE SYSTEM SHALL add that section with empty fields.
6. WHEN the letter is sealed THE SYSTEM SHALL write each section as a heading followed by a list of its filled fields, and omit fields left empty.
7. IF every field of every section is empty THEN THE SYSTEM SHALL refuse to seal and say the page is still blank.
8. WHEN a field contains characters that HTML treats as markup THE SYSTEM SHALL write them into the letter as plain text.
9. WHEN the author switches back to the blank page THE SYSTEM SHALL hide the sections and keep the letter's recipient, title, sign-off and custody choice.

## Requirement 2: Never paste a secret, and a check that says so

**User story:** As an author, I want to be told when my draft looks like it holds a password, so that I write where to find it and not the secret itself.

#### Acceptance criteria
1. WHILE the runbook is shown THE SYSTEM SHALL state in text, above the first section, never to paste a password or recovery code into the letter and to write only where to find it.
2. WHEN the draft has a line that names a password, passcode, PIN, secret, recovery code, backup code, API key or token followed by a colon or equals sign and a value THE SYSTEM SHALL report a likely secret.
3. WHEN the draft has a run of 20 or more letters, digits or `_-+/=` characters that mixes letters and digits, and is not a web address or an email address, THE SYSTEM SHALL report a likely secret.
4. WHEN the draft has three or more hyphen-separated groups of 4 to 6 letters or digits and at least one digit THE SYSTEM SHALL report a likely secret.
5. WHEN a likely secret is found THE SYSTEM SHALL show an in-theme warning, announced politely to screen readers, that gives the line number and the first three characters of the match, before the author presses "Seal the letter".
6. THE SYSTEM SHALL NOT block sealing because of a warning.
7. THE SYSTEM SHALL NOT log, store or send the draft text or any finding; the check runs only in the browser.
8. THE SYSTEM SHALL run the check on blank-page letters as well as runbooks.
9. WHEN the draft only says where something is kept, such as "the recovery codes are in the office safe", THE SYSTEM SHALL NOT warn.
10. WHEN a warning is shown THE SYSTEM SHALL state the warning in text and not by colour alone.

## Requirement 3: A runbook is an ordinary sealed letter

**User story:** As an author, I want a runbook to be as private as any other letter, with nothing new sent to the server.

#### Acceptance criteria
1. WHEN a runbook is sealed THE SYSTEM SHALL seal it through the same browser code as any letter, with AES-GCM, a fresh key and a fresh IV.
2. WHEN a runbook is sealed THE SYSTEM SHALL offer the same two custody choices, with the same plain warning about vault custody.
3. WHEN a runbook is sealed THE SYSTEM SHALL upload the same fields as for any letter and no template name, section kind or field value in plaintext.
4. THE SYSTEM SHALL build the runbook's HTML only from tags on the sanitiser's allow-list and without attributes, so that it opens unchanged.
5. WHEN a runbook is released THE SYSTEM SHALL treat it as any other letter: one-time link, opened in the recipient's browser, sealed copy forgotten.

## Requirement 4: Priya's founder demo uses the template

**User story:** As a presenter, I want the founder demo to show a real runbook, so that the template is visible in 60 seconds.

#### Acceptance criteria
1. THE SYSTEM SHALL build Priya's letter to Tomás from the same section builder that the writing desk uses.
2. THE SYSTEM SHALL give that letter sections for the cloud root account, the domain registrar, contractor payouts and the password manager.
3. THE SYSTEM SHALL state in the registrar section that the domain renews every March.
4. THE SYSTEM SHALL NOT mention payroll in that letter, because the company has no employees.
5. THE SYSTEM SHALL pass that letter through the secret check with no findings.
6. THE SYSTEM SHALL keep Tomás's letter in vault custody and Anika's in keepsake custody.

## Requirement 5: A yearly nudge to review the letters

**User story:** As an author, I want to be asked once a year to review my letters, so that accounts, phone numbers and renewal dates do not go stale.

#### Acceptance criteria
1. THE SYSTEM SHALL count a letter toward review only while it is sealed and not released, and SHALL take the review age from the oldest such letter's sealing time.
2. WHEN the review age is 365 days or more THE SYSTEM SHALL treat the letters as due for review.
3. WHEN the machine sends the author's reminder email and the letters are due for review THE SYSTEM SHALL add a line asking the author to review their letters and stating the oldest letter's age in years and days.
4. WHEN the letters are not due for review THE SYSTEM SHALL send the reminder email exactly as before.
5. THE SYSTEM SHALL NOT change the vigil's state, history, schedule or sent-reminder keys because letters are due for review.
6. THE SYSTEM SHALL NOT send any email to a recipient or a witness because letters are due for review.
7. WHEN the vigil is shown and the letters are due for review THE SYSTEM SHALL show a "Review your letters" note stating the age of the oldest letter in text.
8. WHEN no letters are due for review, or the vigil is released, THE SYSTEM SHALL show no review note.
9. WHERE the time machine is exposed, WHEN the clock has moved 365 days past the oldest letter's sealing THE SYSTEM SHALL show the note, and the next reminder email SHALL carry the line.
10. WHEN the scheduler runs more than once at the same instant THE SYSTEM SHALL send the reminder, with or without the review line, at most once in that cycle.
11. THE SYSTEM SHALL compute review age from the clock the machine is given, and SHALL NOT read the system time inside the state machine.
12. WHEN the author seals a new letter or burns the oldest one THE SYSTEM SHALL recompute the review age from the letters that remain.
