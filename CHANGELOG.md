# Changelog

Every published version has an entry here, newest first. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).
These notes are used verbatim as the GitHub Release notes (see `docs/RELEASING.md`).

## [0.9.6] - 2026-10-04

### Changed
- **Linking a Host administrator is now off for every account until the Owner administrator allows it.** Host Console → Accounts → open an account → "Site admin linking". Until it is on, the Link option does not appear in that account's Security page and the server refuses the request. Switching it off also removes any existing links, so the switcher disappears on both sides. Only the Owner administrator can change it, and each change is logged.
- **Every linking failure now gives the same answer** ("Those details are not right."), so nothing about Host usernames or two-factor can be learned from an account. Failed attempts are also limited per account (6 in 15 minutes), as well as per Host username, and are logged. Migration 7 adds the per-account setting.

## [0.9.5] - 2026-10-04

### Added
- **Account switcher for people who run the site and a reseller account.** In the app, Security → Host administrator → "Link Host administrator" (Administrators only) asks for the Host username, password and two-factor code once. After linking, a switcher appears at the top right on both sides: the Host Console lists "Site admin" and your reseller accounts (opens the app sign-in in a new tab with the login filled in); the app lists your account and "Site admin". Linking can be removed at any time, and deleting a Host administrator removes their links.
- Nothing from the reseller account is shared with the Host side (it only learns the login name and business name), each side still has its own sign-in, and linking attempts are rate-limited and logged. Migration 6 adds the `admin_links` table.

## [0.9.4] - 2026-10-04

### Fixed
- **Date boxes now match the other entry boxes.** Date received sits in the same grid and width as Cost and Selling price, and the browser's extra inner padding on date boxes is removed so the text lines up (Safari and Chrome).

## [0.9.3] - 2026-10-04

### Added
- **Test checklist details.** In Settings → Test checklist every step has a Details button for extra items: Text, From → To (two boxes) or a Choice from a list. They appear, indented, under the step when it is ticked in Add/Edit device, and are copied onto the sale and its receipt. Items are always optional. The default "Code / firmware upgraded" step now has Launcher and Firmware (From → To), including on existing accounts that have not renamed it.
- **One "Tested on" date for the whole test record.** Defaults to today and can be changed, so devices can be entered now and tested later. "Mark all done" uses it. The sale, receipt and test section show the date and who recorded it.
- **"Use a test checklist" switch** in Settings. Off hides the test record in Add/Edit device, the Tests column, the Quick sale check, receipts and CSV files. Nothing recorded is deleted.
- **Date received** on every device (defaults to today, editable). It is in CSV import and export, and stock is ordered by it, oldest first, when adding by quantity. Existing devices use the date they were added.
- The Host Console Email → Messages tab now says the messages are global wording, in English only.

### Changed
- Test steps no longer show a date per tick; the single "Tested on" date replaces it (older sales keep what they recorded).

## [0.9.2] - 2026-10-04

### Added
- **Host administrators can be edited.** Host Console → Security → Host administrators now has an Edit button: name, email and cell number (a contact detail only). Everyone can edit their own; the Owner can edit anyone. The table shows each person's contact details.
- **Owner marker.** The first administrator created (normally `admin`) is shown with an Owner chip. The Owner manages the others.
- **Owner-only support actions** in the Edit window: Reset two-factor (they are signed out and told by email), Set temporary password (shown once; they must change it at next sign-in) and Sign out everywhere. All are written to the log.

### Changed
- Adding and deleting administrators is now Owner-only. Helpers can still edit their own details.

## [0.9.1] - 2026-10-04

### Fixed
- Emails: the logo showed at full size and left-aligned in Apple Mail. It now has an explicit size and is centred in the header, so it looks the same in mail apps as in the preview.

## [0.9.0] - 2026-10-04

### Added
- **Make and Model are dropdowns** when adding or editing a device, like Condition and Status. The lists come from the devices you already have, plus "Add new…". Model shows only the models of the chosen make. Capitalisation never makes a second entry: typing "ACME" next to an existing "Acme" reuses "Acme" (the same applies to CSV import).
- **Settings → Makes and models** (Administrators): add a make or model ahead of time, rename one, merge two spellings of the same name (every device moves over), and remove names no device uses. Names that were entered more than one way are flagged. Past sales keep the name they were sold under.
- **Host Console → Email → Messages**: edit the subject, heading, body and button label of every message (welcome, new sign-in, password reset, temporary password, two-factor reset, trial ended, backup failed, test) with a live preview. The preview switches between Styled and Plain text, and Desktop and Phone width. Details such as the name or account ID are inserted from buttons, and the ones a message needs cannot be removed. Reset to default and Send a test of this message are included. Only the words change: colours, fonts and layout stay locked to the site theme. The styled and plain-text versions are built from the same words, so they always match.

### Changed
- Host Console → Email is now two tabs: Delivery (sending settings, test, recent messages) and Messages.
- Wording of some built-in messages was tidied so both versions read the same; the link now also appears in the plain-text version as "Button label: link".

### Removed
- Host Console → Settings → **Site name**. It only changed the heading on the sign-in screen, so the name is now fixed as myBoxStock everywhere.

## [0.8.2] - 2026-10-04

### Added
- Opening `/app/#/signup` while signed out goes straight to the Create account screen, so the "Sign up" button on the marketing site lands on the right page.

## [0.8.1] - 2026-10-04

### Changed
- Sales page: search, From, To and the warranty filter now sit on one row (they wrapped onto four lines before). Quick period buttons (Today, 7 days, 30 days, This month, All time), a Clear filters link, and a line saying exactly what the numbers cover. Search also matches payment method and warranty.

## [0.8.0] - 2026-10-04

### Added
- **Discounts** in Quick sale: a % off any single device and/or a % off the whole order. The sale shows the subtotal, what was saved and the total; receipts show each discount and the order discount. Settings has a limit on how much a Standard user may discount in total (Administrators are unlimited). The limit is checked in the app, because the server cannot see encrypted sale data.
- **Add by quantity** in Quick sale: choose a model and a number and the oldest available units are added. The stock picker also has **Select all shown**.
- Settings: the choices of a "Choice from a list" detail (such as Condition) can now be changed at any time.

### Changed
- **Outbound emails** (welcome, password reset, new sign-in, trial ended, two-factor reset, temporary password, backup failure, test) now share one branded layout: the myBoxStock logo and name at the top, a clear title, the app's colours, font and button style, and a footer. The logo is attached inside the message so it shows without loading remote images.
- Settings → Device details: the delete ✕ now sits at the far right of each row, in line with the other lists. The ✕ on Quick sale lines matches the same round icon button.
- Removed unused logo tokens from `tokens.css`.

## [0.7.0] - 2026-10-03

### Added
- **Warranty periods.** Administrators choose the periods offered at Quick sale (starter set: No warranty, 30/60/90 days, 1 year; add your own in days, months or years; pick a default; archive or remove). Each sale stores its own warranty snapshot, with a live countdown ("In warranty · 42 days remaining" / "Expired · 3 days ago") on the sales list, receipt and customer history. Filter sales by warranty status, change a sale's warranty later, and see warranty in the sales CSV.
- **Unlock behaviour** setting: ask for the password after a refresh (default) or stay unlocked while the tab is open, with an idle auto-lock (default 30 minutes). The key is wiped on sign-out, tab close and idle.
- **Make** field beside Model on devices, in search, the stock picker, sale records and CSV; Make and Model now sit at the top of the form.
- **Scheduled full-site backups** (Host Console → Backups): nightly or weekly, passphrase kept sealed on the server, each backup opened and checked after it is written, optional copy to an off-box folder, retention (14 daily / 8 weekly by default), last-good-backup status on the Overview, and an email to Host administrators when one fails.
- Host Email: **Resend** and **Resend all failed** for messages that could not be delivered.
- myBoxStock logo as the browser-tab icon, home-screen icon and web manifest, and prominently on every sign-in card, signed-in header, receipt and the secure-connection screen.

### Changed
- Every device detail can now be removed (with a confirmation; entered values are kept hidden). The ✕ buttons are restyled as neutral round icon buttons.
- Host Email: turning on TLS from the start of the connection fixes the port at 465 and greys it out; with it off the port is editable (default 587) and port 465 is refused. Recent messages refresh by themselves.

## [0.6.0] - 2026-10-03

### Added
- Quick sale: **Browse available stock**. Pick devices from a list of what is in stock, without knowing any identifier. Each device is its own row showing model, tracked identifiers, condition, test status and price. Filter by model, search any tracked detail, tick several and add them to the sale in one go.
- Quick sale shows a chip per in-stock model with its count; tapping one opens the list already filtered to that model.

## [0.5.3] - 2026-10-03

### Fixed
- Settings: the tick boxes now line up under their headings, and the name fields are a sensible size.

## [0.5.2] - 2026-10-03

### Fixed
- Opening the site over plain http on a network address (for example http://192.168.1.118:9080) made sign-in silently fall back to the login screen, because browsers switch off the encryption features there. The site now says a secure (https) address is needed.
- Signing in no longer drops you silently back to the sign-in screen if something goes wrong after the password is accepted; the reason is now shown on screen.

## [0.5.1] - 2026-10-03

### Fixed
- A person added from Team right after the account's encryption was first set up could sign in but not open any data (they landed on a recovery-key screen). They now get their access when they are added. If you already added someone this way, use Team → Reset access for them once.
- The server now refuses to add a person to an encrypted account without their key material, so a half-working login cannot be created.

## [0.5.0] - 2026-10-03

### Added
- Settings page for account Administrators. Choose which device details to track (UID, serial number, MAC address, condition, supplier, plus any you add yourself — text, number, date, yes/no or a choice list such as "State"). For each detail: track it, look it up in Quick sale, require it to be unique, and copy it onto the sale record.
- Test checklist per device. Define the steps you perform (inspected, batteries in remote, remote tested, device tested, code upgraded — all editable, optionally required before sale). In Inventory, tick the steps and add test notes; who did it and when is recorded automatically. "Mark all done" is one click.
- The sale keeps a permanent copy of the device details and the test record as they were at the time, so if a customer says a device did not work you can show what was checked. Receipts can include the test record (checkbox) for printing or email; Quick sale warns when required steps are not ticked.
- Inventory list shows your chosen identifiers and a Tested chip; search, CSV import and export follow your fields and checklist.

### Changed
- Quick sale looks devices up by whichever details you marked for lookup, not just UID, serial and MAC.
- The account's field and checklist setup is stored encrypted like the rest of the data; everyone in the account can read it, only Administrators can change it.

## [0.4.0] - 2026-10-03

### Added
- Customer-data encryption. Inventory, customers and sales are encrypted in the browser before they reach the server, so the hosting service stores them but cannot read them. Each account has its own data key; each person's password and a one-time recovery key each protect it. Setup runs at first sign-in (existing accounts move their older items across automatically) and shows a recovery key that must be confirmed as saved.
- Unlock screen after a page reload; recovery-key access if a password was reset by email; Administrators can reset a person's access from Team; changing your password re-protects the key; Security page can replace the recovery key.
- Real inventory: search, status filters (available, reserved, sold, returned, damaged, archived), cost and selling price, supplier and notes, edit and archive, duplicate protection, CSV import and export, and per-model reorder levels with low-stock warnings.
- Customers with purchase history; Sales list with date range, totals and CSV export; receipts you can print or email from your own mail app; void a sale (devices return to available).
- Quick sale: scan or type a UID/serial/MAC, several devices per sale, existing, new or walk-in customer, payment method, finish and show the receipt. Works on a phone.
- Home page: available stock, this month's sales, revenue and profit, low-stock warnings and recent sales.
- Host Console shows only whether an account is encrypted and how many stored records it has — never contents.
- An automated browser test walks the whole flow end to end (skipped where no browser is installed).

### Changed
- The old plaintext inventory API is gone. Existing plaintext items are moved into encrypted storage by an Administrator's first sign-in and then deleted from the server.
- Without the password or the recovery key, an account's data cannot be recovered by anyone, including the Host. See `docs/ENCRYPTION-DESIGN.md`.

## [0.3.0] - 2026-10-03

### Added
- Sign-in activity: every sign-in, wrong password, wrong code and blocked attempt is recorded with IP address and device. People see their own history and the devices they are signed in on (Security page) and can sign a device out. Account Administrators see the whole team's history and sessions (new Activity page), and Team shows each person's last IP. Repeated failures from one address are grouped. A sign-in from a new IP queues an email to the person. Retention is a Host setting (Settings → Keep sign-in history, default 90 days).
- Full-site backup: one passphrase-protected `.mbsbak` file holding the database and the encryption key. Create it from Host Console → Backups; restore from the console or on a new server with `node server.mjs restore-bundle` — everyone, including people using two-factor, signs in as before.
- Searchable logs: search text, level and event filters, date range, quick filters, Load more, CSV/JSON export, filters kept in the page address. Searches and exports are themselves logged.
- Themed dropdown used everywhere (keyboard friendly); native dropdowns are no longer allowed (a test enforces it).
- `docs/ENCRYPTION-DESIGN.md`: proposed design for browser-side customer-data encryption (for review, not yet built).

### Changed
- Messages now say what actually happened: a suspended account says it is suspended, a disabled person says so, a read-only account says so, and so on. Only a wrong username or password stays deliberately vague.
- The `http` log area is file-only and no longer appears in the log menu.

## [0.2.1] - 2026-10-03

### Changed
- Sign-in page now has a clear "Sign in | Create account" switch at the top (shown while sign-ups are open), so new accounts can be created straight from the login screen.

## [0.2.0] - 2026-10-03

### Added
- Free trials: new sign-ups start a trial. The length is a Host Console setting (Settings → Free trial length, default 14 days, applies to new sign-ups).
- Plans per account: Trial, Free (comped, never expires) and Paid (optional paid-through date). Host administrators change a plan from Accounts → account → Change plan, with a private note. Every change is kept in a plan history and logged (area `accounts`).
- Plans are visible at a glance: a Plan column and filter on Accounts, and a Plans summary (trials, ending within 7 days, free, paid, ended) on the Overview.
- Ended trials and paid periods become read-only: people can still sign in and view everything, but changes are refused. Nothing is deleted. The owner gets an email, and users see a trial/read-only chip in the header.
- Delete people: account administrators can delete other users in their account; host administrators can delete users from an account and delete other host administrators. Typed confirmation is required; you cannot delete yourself or the last Administrator / host administrator.
- Versioned database migrations (existing installs upgrade in place; existing accounts become Free so nobody is locked out).

### Changed
- Welcome email mentions the trial; sign-up page shows the trial length.

## [0.1.0] - 2026-10-03

First published version (phase 1).

### Added
- Host console: system dashboard, account management (support actions only), backup and restore, outbound email queue and templates, application firewall with rate limiting, filtered log viewer, host-admin management.
- Account app: sign-up with unique account ID (`username@bx-code`), user types (Administrator, Standard, View), basic inventory, optional TOTP and recovery codes.
- Strict tenant privacy: host routes never read account business data; the `tenant` log area is hidden from the host.
- Portable database layer (SQLite by default, PostgreSQL and MySQL/MariaDB drivers) with `migrate-db` command.
- Logging in raw (JSONL) and human-readable form, per area, with rotation and retention.
- Single design-token stylesheet (`tokens.css`) enforced by tests; strict CSP with no inline styles.
- Deployed-version badge on every page and version reporting in `/healthz`.
- Docker image published to `ghcr.io/mfwadejr/myboxstock`.

### Known limitations
- MariaDB/MySQL driver is untested; live direct-to-MX email delivery is untested.
- Firewall enforces the web port only (other ports are visibility-only).
