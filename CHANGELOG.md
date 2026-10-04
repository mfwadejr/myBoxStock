# Changelog

Every published version has an entry here, newest first. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).
These notes are used verbatim as the GitHub Release notes (see `docs/RELEASING.md`).

## [0.16.3] - 2026-10-04

### Changed
- **Email sending (reseller Settings) now matches the Host Console's layout:** From name, From address, SMTP host, Port, Username, Password, then the TLS switch. Turning on "Use TLS from the start of the connection" sets the port to 465 and locks the box; turning it off unlocks it and returns it to 587.

### Added
- **Date received in Bulk scan.** Set once for the whole batch (today by default).

### Fixed
- The logo was missing from emails sent through a reseller's own mail server (the test email and receipts). It is attached now, the same as the site's own emails.

## [0.16.2] - 2026-10-04

### Fixed
- **"Another device already has that Condition" when adding or editing a device.** "Must be unique" and "Look up in sale" were set on a dropdown detail (Condition), so every device with the same condition counted as a duplicate. These two options now only apply to text details such as UID, Serial number and MAC address; they are ignored on dropdown, number, date and yes/no details, and their tick boxes are switched off for those in Settings.

## [0.16.1] - 2026-10-04

### Fixed
- **Bulk scan adds each code by itself.** Scanners that do not send Enter no longer need one: a quick burst of scanner typing is added when it stops, Tab adds it too, a paste adds it, and leaving the box adds it. The cursor stays in the scan box ready for the next scan. Typing by hand still works with Enter.

## [0.16.0] - 2026-10-04

### Added
- **Resellers can send from their own mail server.** Settings → Email sending: mail server, port, user name, password, From name and From address, with a "Send a test email to me" button. When it is on, receipts go out from the reseller's own address. When it is off, the site's shared sender is used as before. The details are saved encrypted with the rest of the account data and pass through the site once per message to reach the mail server; they are never stored, logged or queued. It is built so newsletters can use it later.
- **Safeguards:** only standard mail ports (587, 465, 25, 2525), servers on private networks are refused so a reseller cannot probe your network (Host Console → Settings → Server options can allow them), clear messages for a wrong login or unreachable server, and a daily limit (1,000 a day from their own server, 100 from the shared sender).

### Fixed
- **Bulk scan** only asks for what is on your label. UID is ticked by default, with Serial number and MAC address as optional tick boxes, so a UID-only label completes the device with one scan and Enter. The scanner's "UID" text is removed from the box the moment it is typed.

## [0.15.4] - 2026-10-04

### Fixed
- **Scanned barcodes that send the label on its own line.** Some scanners send "UID", Enter, then the number, Enter. The label alone is now ignored instead of being taken as the first scan (it shifted every later scan out of place). Also handles "UID273D…" with no space, "UID: 273D…" and "Serial number" on its own line. Applies to Bulk scan, the Add/Edit device form and Quick sale.

### Added
- **Reorder lists in Settings.** Every row in Device details, Test checklist and Warranty periods has up and down buttons. The order you set is the order used in the Add device form, the checklist on each device and the warranty menu in Quick sale. Press Save changes to keep it.

## [0.15.3] - 2026-10-04

### Fixed
- Bulk scan listed dropdown details such as Condition as something to scan. Only text details (UID, Serial number, MAC address and similar) are scanned now; dropdowns are set once for the whole batch.

## [0.15.2] - 2026-10-04

### Fixed
- **Bulk scan now captures every identifier you track**, not only the first. For each device it asks for UID, then Serial number, then MAC address (whatever you have switched on), pressing Enter after each. Enter on an empty box skips one a device does not have. Repeats are refused, and a number that is already in stock is refused too. The scanned devices show as a list before you press Save.

## [0.15.1] - 2026-10-04

### Added
- **Server options in the Host Console** (Settings → Server options): secure cookies, how many reverse proxies sit in front of the site, log detail and how long the activity log is kept. These no longer need container environment variables. A value saved here wins; "Back to server defaults" returns to whatever the container sets. Secure cookies can only be turned on from an https page, so you cannot lock yourself out. Changes apply at once, with no restart.
- **Use this address** button next to Site address: fills in the https address you are using to reach the Host Console, so email links (confirm, reset, welcome) point to the right place in one click.

### Notes
- Still container settings, because they are needed before the database opens or exist for emergencies: the data folder, port, database type and connection, the application secret and `HOST_ALLOW_ANY`.

## [0.15.0] - 2026-10-04

### Added
- **Email a receipt.** On a sale's receipt, Email now opens a box with the customer's saved address filled in (editable). Send delivers the receipt straight from the site, with your business name as the sender and your own email as the reply address. "Open in my mail app" is still there for anyone who prefers it.
- **Nothing is kept.** The receipt passes through the server to reach the customer and is not saved: not in the mail queue, the database or the logs (the log only notes that a receipt was sent). Each account is limited to 100 receipts a day (migration 12 keeps only that daily count).
- The wording of the receipt email can be edited by the Host administrator under Messages (new Customer group).

## [0.14.3] - 2026-10-04

### Added
- **Bulk scan** (Inventory). Choose make, model, cost, price and the other shared details once, then keep scanning identifiers one after another (Enter after each). Repeats and identifiers already in stock are refused, you can remove the last scan, and one Save adds the whole batch.

### Fixed
- Scanning a barcode put the scanner's label ("UID") and a line break in front of the number. Labels such as UID, SN, Serial, MAC and IMEI are now removed, in the device form, in Bulk scan and in Quick sale.

## [0.14.2] - 2026-10-04

### Added
- **Site address** (Host Console → Settings). The public address used for every link in an email (confirm, password reset, welcome, account closing). It can be changed without touching the server; if it is empty the `PUBLIC_URL` server setting is used, as before. The page shows which one is in use.
- **Warnings for a bad address.** If the address is empty, still the example one, an internal address only your own network can reach (such as `zimaos.local`, `localhost` or `192.168.x.x`), or not https, Settings explains the problem and the Overview shows a banner.

### Fixed
- Email links pointed at the server's internal address when `PUBLIC_URL` was set to it. Set the Site address to your public one; links sent before that keep the old address, so use "Send it again".

## [0.14.1] - 2026-10-04

### Fixed
- Plans page: the Add a plan and Save plans buttons now have space above them instead of touching the card.

## [0.14.0] - 2026-10-04

### Added
- **Pipeline page** (Host Console): sign-ups this week and in 30 days, who is on a trial and how many days are left (trials ending within 7 days are marked), where every account stands (trial, paid, comped, ended), a renewals list for the next 30 days (paid accounts running out and trials ending, including any that just lapsed), and accounts nobody has signed in to for over a week.
- **Account health** in the Accounts list: last sign-in, and flags for no recovery key saved, encryption not set up, two-factor off for the Administrators, and email not verified. A new filter narrows the list (no recovery key, no two-factor, email not verified, inactive 30 days, encryption not set up, closing, suspended).
- **Support tools gathered in each account:** suspend or reactivate, extend the trial and change the plan sit together, with every person's password reset, temporary password, two-factor reset, sign-out everywhere (new) and sign-in on/off one click away. **Each of these now asks for a short reason**, which is saved in the log with who did it and shown in a new **Support history** list on the account.
- **Plans page:** write down plan names, prices (monthly or yearly), and user and device limits, ahead of taking payments. They are recorded only: nothing is charged and no limit is enforced yet, and the page says so.
- **Receipt records** on each account: write down money received outside the app (amount, how, reference, note), optionally setting the plan to Paid through a date at the same time. Removing one needs a reason. Migration 11 adds the table; receipts are erased with the account.

### Changed
- Changing an account's plan (including comping or extending a trial) now requires a reason; it appears in the plan history as before.
- Suspending and reactivating an account moved from the bottom of the account sheet into Support tools.

## [0.13.0] - 2026-10-04

### Added
- **Export everything** (Security → Your data, Administrators). One zip with your devices, customers, sales, one row per device sold, and your settings, as CSV and JSON files. It is built in your browser: the server never sees it.
- **Close my account** (Security → Your data, Administrators). Needs your password and your Reseller ID, and offers the export first. The account is locked for 7 days: other people cannot sign in, Administrators can still sign in to look around, export or restore it, and a banner shows the erase date. After 7 days it is erased automatically by an hourly server job (a server that was down catches up when it starts). Emails go out when the account closes and when it is erased, and say plainly that encrypted copies may remain in backups until those expire.
- **Host Console:** accounts that are closing show "Closing, erases <date>" with a Restore button; "Delete forever" still erases at once.
- **Per customer** (Customers → open a customer): **Export** gives a zip of their details and purchases; **Erase** removes their name, phone, email and notes from the customer and from their past sales. Totals and receipt numbers stay and show "Erased customer".
- New messages "Account closing" and "Account erased" in the Messages editor. Migration 10 adds the closing date.

### Changed
- Every export, close, restore and customer erase is written to the log (counts only, never contents).

## [0.12.0] - 2026-10-04

### Added
- **Confirm your email.** New accounts (and people added to a team with an email address) get a message with a "Confirm my email" button, valid for 24 hours. The account works straight away. Until the address is confirmed, a blue banner on Home and Security offers to send the message again, and two things wait: password reset by email, and adding people to the team (Administrators only). Sending again is limited to once a minute and five a day per person.
- **Change email address** (Security). The new address only replaces the old one once the link sent to the new mailbox is clicked; it needs the password.
- **Host Console:** each person shows Verified or Not verified, with "Resend the confirmation email" and "Mark email as confirmed". Marking needs a reason and is written to the log.
- New message "Confirm your email" in the Messages editor.
- Migration 9 adds the confirmation records.

### Changed
- Nothing is sent and nothing is held back while outbound email is not set up. People whose accounts existed before this version are never held back (they still see the banner). Each confirmation counts toward your mail relay's daily limit.

## [0.11.0] - 2026-10-04

### Added
- **Sign in with a Reseller ID and a username.** The sign-in page now has two boxes. New accounts get a generated Reseller ID made of three easy words and a number (for example `amber-fox-4271`), so it is always unique and never has to be invented. This browser remembers the ID, so next time only the username and password are needed. Capital letters and stray spaces do not matter.
- **The same username or email can exist under different resellers.** A person with two businesses signs in to each with its own Reseller ID, and each has its own password and encrypted data.
- **Reset by email address.** "Forgot password" now asks for the email address. One message lists a reset link for every reseller account that uses that mailbox, so nothing about which accounts exist is shown on screen, and each link changes only that account's password. New message "Password reset (several accounts)" in the Messages editor; the single-account reset message now names the Reseller ID and username.

### Changed
- Existing accounts keep their current ID (for example `BX-4K7Q2M`) as their Reseller ID, and the old one-box `username@id` sign-in keeps working. Nothing needs migrating.
- Wording: "Account ID" is now "Reseller ID" in the Welcome and Trial ended messages, the Host Console and the Team and Security pages. The Welcome message lists the Reseller ID and username.
- Links in messages are clickable in the styled version.

## [0.10.0] - 2026-10-04

### Added
- **Host Console access is now its own card on the Firewall page.** Switch it on to limit the console to the addresses you list; everyone else gets a plain "Not Found" page (the console no longer announces that it exists). The card shows your current address with an **Add my address** button, takes single addresses or ranges with a note, and lists each entry with an on/off switch and Remove. You cannot switch the limit on, or disable or remove the entry that lets you in, while it would lock you out. If the server sees only an internal address (a proxy that is not passing the real one on), the card says so before you switch it on.
- **Emergency override.** Setting `HOST_ALLOW_ANY=1` on the server ignores the list until you are back in; the card shows when it is active.
- Migration 8 gives every address that was already enabled as an "allow" rule a matching Host Console entry, so nothing changes for anyone who already used the old switch.

### Changed
- The old "allow-listed addresses only" switch moved out of Rate limiting. "Allow" rules in Address rules now only skip rate limiting.

### Fixed
- Safari: the date text in Date received and Tested on sits level with the other boxes (awaiting confirmation in Safari).
- A deleted account no longer stays in the Site admin switcher: the list refreshes on every page change, and deleting an account or user removes its link.

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
