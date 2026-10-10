---
title: Accounts
summary: Find a customer account, check its health, and use the support tools: suspend, reset passwords and two-factor, temporary passwords, plan changes, receipts, closing and erasing.
keywords: accounts, unlock, locked out, unlock sign-in, account erased email, delete reason, email not sent, deleted email not sent, paging, per page, page size, search, customer, support, suspend, reactivate, reset password, temporary password, two-factor reset, 2FA, confirm email, resend, mark confirmed, sign out everywhere, disable sign-in, delete user, delete account, closing, restore, erase, plan, extend trial, receipt, support history, host link, health filter, recovery key, bulk actions, bulk, select all, needs attention, attention, sort, sorting, sort columns, announcement, notice to accounts, export accounts, CSV, extend many trials
order: 3
covers: nav:accounts, Terms, Terms accepted, Not accepted yet, Older terms accepted, Search by business Reseller ID or email, All plans, On trial, Free (comped), Paid, Ended / read-only, Any health, No recovery key saved, No two-factor, Email not verified, Inactive 30 days, Encryption not set up, Closing, Suspended, Business, Reseller ID, Owner, Users, Plan, Status, Health, Last sign-in, Showing, 25 per page, 50 per page, 100 per page, Previous, Next, Account sheet, Change plan, Extend trial, Suspend, Reactivate, Record a receipt, Remove receipt, Plan history, Support history, Allow this account to link a Host administrator, People, Manage, Delete, Restore, Email a password reset link, Resend the confirmation email, Mark as confirmed, Set a temporary password, Reset two-factor authentication, Sign out everywhere, Disable sign-in, Enable sign-in, Delete this user, Reason, locked out, Unlock this sign-in, Not locked out, Reason (included in the email, optional), Email is not set up so nobody will be told this account was deleted, Delete forever, account erased email, Needs attention, Trial ends within 3 days, Trial ends within 7 days, Trial ends within 14 days, Trial ends within 30 days, Trial ending soon, Ticket overdue, Select all accounts on this page, Select all matching, Clear, selected, Bulk actions, Send announcement, Export list, Preview, Sort by Business, Sort by Plan days left, Sort by Users, Sort by Last sign-in, Days to add to each running trial, Keep the plan, change only the note, Plan note, Message, Style, Also email the account owners, Reason (a few words, saved in the audit trail), Type the words to confirm, DEMO chip, Show demo accounts, Demo accounts in the list
---

## What this page is for

Accounts is where you help customers. Most of what customers ask you for falls into a few groups: "I cannot sign in", "I lost my authenticator", "I never got the confirmation email", "please extend my trial", "please close my account". Everything you need for those is here.

It is just as important to know what is not here. You will never see a customer's inventory, sales, customers or receipts. Their data is encrypted in their own browser before it reaches the server, so even the Host cannot read it. At the top of every account sheet a blue note says it plainly: you can help with sign-in and security, and business data is not visible to host administrators.

> The customer owns their data and is 100 percent responsible for it, for saving their recovery key, and for making their own exports. Resetting a password or two-factor lets someone sign in again. It does not give anyone the ability to read data they could not already open. If a customer loses their recovery key and every device, the data cannot be recovered by you.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

![The Accounts list with search, filters and the Health column (made-up demo accounts, marked DEMO).](shot:host-accounts "The Accounts list with search, filters and the Health column (made-up demo accounts, marked DEMO).")

## The account list

Open **Accounts**. Under the heading is the reminder that inventory, sales and customers are private. The list is newest first and works in pages.

### Searching

Type in the box that says "Search by business, Reseller ID or email". It matches part of the business name, the Reseller ID (a code like `BX-ABC123` which is the customer's account identifier) or the owner's email. The list updates a moment after you stop typing.

Why: customers rarely know their Reseller ID but always know their business name and email. If they quote a Reseller ID, search for it exactly to avoid mixing up two businesses with similar names.

### The plan filter

The first drop-down narrows by plan:

- **All plans** (no filter).
- **On trial**: accounts in a running free trial.
- **Free (comped)**: accounts you gave a free plan that never expires.
- **Paid**: paid accounts still in date.
- **Ended / read-only**: trials or paid periods that have run out. These accounts can look but not change anything.

### The health filter

The second drop-down finds accounts that need a nudge. It only uses identity and security facts.

- **Any health** (no filter).
- **Needs attention**: one combined view of everything worth a follow-up. See "Needs attention" below.
- **No recovery key saved**: encryption is set up but the customer has not confirmed saving their recovery key. This is the most important filter, because without the key, forgotten credentials mean lost data. Contact these customers.
- **No two-factor**: none of the account's Administrators has two-factor on.
- **Email not verified**: someone in the account has an email address that has not been confirmed.
- **Inactive 30 days**: nobody has signed in for 30 days (or the account is more than 30 days old and nobody ever has).
- **Encryption not set up**: the customer never finished setting up their data encryption.
- **Closing**: accounts in the 7-day closing period.
- **Suspended**: accounts you have switched off.

You can combine search, plan and health. Use **Closing** at the start of each week so nobody is erased by surprise.

### The columns

- **Business** is the business name. Accounts made by [Demo mode](#/docs/demo-mode) carry an amber **DEMO** chip here and in the title of their account sheet. The **Show demo accounts** checkbox above the list hides them. Reset links and confirmation emails are never sent to a demo account, and they are never billed.
- **Reseller ID** is the account code.
- **Owner** is the owner's email.
- **Users** is how many people the account has.
- **Plan** shows Trial, Trial ended, Free, Paid or Paid ended, with "days left" for running ones.
- **Status** shows green "active", red "suspended", or a red "Closing, erases" with the date.
- **Health** shows chips: "No recovery key", "Not encrypted", "2FA off", "Email not verified", or a green "Good" when none apply.
- **Last sign-in** shows how long ago anyone last signed in, or "never".

Four of the column titles can be clicked to sort the list: **Business**, **Users**, **Plan** (by days left) and **Last sign-in**. See "Sorting" below. Click any other part of a row to open that account's sheet.

### Paging

The list shows 25 accounts at a time. Under it a line says, for example, "Showing 1-25 of 60". A drop-down on the right changes the page size to **25 per page**, **50 per page** or **100 per page**, and **Previous** and **Next** move between pages. When there are 25 accounts or fewer, these controls are hidden. Typing in the search box or changing either filter takes you back to page 1. The server returns at most 500 matches for one search, so use the search box and the filters to narrow a very large list rather than paging to the end.

### Needs attention

Choose **Needs attention** in the health drop-down to see, in one list, every account with at least one of these problems:

- **No recovery key**: encryption is set up but the customer has not confirmed saving the recovery key.
- **Email not verified**: someone in the account has an email address that has not been confirmed.
- **Inactive 30 days**: nobody has signed in for 30 days.
- **Trial ending soon**: a running trial ends within a number of days you choose.
- **Ticket overdue**: the account has a support ticket waiting on the Host for longer than the response target set in Support settings. It is the same measure the Support page and the Alerts use.

When you pick Needs attention, a third drop-down appears next to it: **Trial ends within 3 days**, **7 days** (the default), **14 days** or **30 days**. It only changes what counts as "ending soon". Instead of the usual health chips, each row then shows amber chips naming the reasons, so you can see why an account is listed without opening it. An account with none of these problems is not listed.

Why: it gives you one place to start each morning, instead of running five separate filters. Work down the list, fix or contact each account, and the list gets shorter. The individual filters (No recovery key saved, Email not verified and so on) are still there when you want just one problem.

### Sorting

The titles **Business**, **Users**, **Plan** and **Last sign-in** are buttons. Press one to sort the list by it, ascending. Press it again to reverse the order. A small arrow shows which column is sorted and which way, and screen readers are told the same ("sorted ascending"). **Plan** sorts by days left, so the trials that end soonest come first when ascending. Accounts with no end date (Free) or no sign-in yet ("never") always go to the bottom, whichever way you sort. The choice is remembered while the page is open, even if you visit another page and come back, and it applies to the whole result (all pages), not only the page you see. Searching and filtering keep the sort. To go back to the default (newest accounts first), reload the Host Console.

### Selecting accounts and bulk actions

Every row has a tick box at the start, and the title row has one that selects every account on the page you are looking at. Ticking a box never opens the account. Once something is ticked, a blue bar appears above the list showing "N selected", with:

- **Select all N matching**: appears when more accounts match your search and filter than are ticked. It selects everything the list holds for the current search, plan and health filter, not only this page. The list holds at most 500 matches, so narrow the search first for a very large site.
- **Clear**: unticks everything.
- Four actions, described below: **Extend trial**, **Change plan**, **Send announcement** and **Export list**.

Bulk actions are for routine, safe jobs. They never suspend, close or delete an account; those stay one at a time on the account sheet, on purpose. A Host administrator whose role is View can look at accounts but cannot use bulk actions.

Every action that changes accounts works in the same four steps inside one window:

1. **Choose.** Fill in the small form for the action (for example the number of days) and press **Preview**.
2. **Preview.** Nothing has changed yet. A blue box says in words what would happen, for example "This will extend 42 trials by 14 days." It also lists any selected accounts that would be skipped and why (for example "3 accounts skipped: not on a running trial") and a few example names.
3. **Confirm.** Type a short reason (saved in the audit trail) and type the confirmation words shown, for example `EXTEND 42`. The button stays greyed out until both are right. The words include the number, so you cannot confirm a different number by accident, and if the accounts changed after the preview the action is refused and you are asked to preview again.
4. **Run.** Small selections finish at once and show a summary. From 25 accounts up, the action runs in the background with a progress bar ("12 of 80 accounts") and you can keep the window open until it finishes. Only one bulk action runs at a time.

Everything is logged. Each account gets its own entry in the [Audit trail](#/docs/audit-trail) under **Bulk account actions**, saying what was done to it, who did it and why, and one summary entry says what was run, by whom, how many accounts were done, failed and skipped. Plan changes are also kept in each account's plan history.

#### Extend trial

Adds the number of days you enter (1 to 365) to the end date of every selected account that is on a running trial. Accounts that are Free, Paid or whose trial already ended are skipped and counted in the preview. To restart an ended trial, use **Change plan** below. Why: a launch week, a conference or an outage is a good reason to give a whole group of customers more time in one go.

#### Change plan

Changes the plan of every selected account. Choose what to change them to: **Keep the plan, change only the note** (only the plan note changes, plans and dates stay), **Free (comped)**, **Trial** (enter the length in days, counted from today) or **Paid** (optionally the "Paid through" date). The **Plan note** appears on each account's plan and in its history. Accounts that are already Free are skipped when you choose Free. It is the same change as **Change plan** on one account sheet, applied to many. See [Plans](#/docs/plans).

#### Send announcement

Shows a short notice to the people in every selected account. Write the **Message** (5 to 400 characters, plain text), choose the **Style** (Information, Heads-up or Important), and optionally switch on **Also email the account owners**.

- The notice appears as a banner at the top of the app for 14 days, until people close it. It replaces the site-wide banner for those accounts while it is current. Other accounts see nothing.
- With the email option on, one email goes to each selected account's owner address through your [Email](#/docs/email) setup. If Email is not set up, the action is refused and tells you so. An account with no owner address gets only the notice. Demo accounts (when Demo mode is used) get only the notice and are never emailed.
- One action can queue at most 500 emails. For more, send in groups or use the notice alone.
- The email text is a normal message you can restyle under Email, Messages, called **Announcement from the Host**. The reseller's data is never involved: the notice is the same text for everyone you chose.

#### Export list

Downloads a CSV file of the selected accounts. It has only what the Host can already see on the Accounts page: business name, Reseller ID, owner email, status, plan, plan end date, days left, number of users, last sign-in date and created date. It never contains customer data. No confirmation is needed because nothing changes, but the export is still recorded for every account and as a summary. Cells that start with a character a spreadsheet could treat as a formula are made safe. Treat the file as personal data: it holds email addresses. Delete it when you have finished.

![Tick some rows and the bulk bar appears](shot:host-accounts-2 "Tick some rows and the bulk bar appears: Extend trial, Change plan, Send announcement and Export list.")

## The account sheet

The sheet is a pop-up with these sections from top to bottom. Press **Done** to close it.

### Header, Closing and Data

The name, status chip, Reseller ID and creation date. If the account is closing, a red bar says when it will be erased and offers **Restore**. The **Data** section says whether the account is **Encrypted** or "Not set up yet", and how many "stored records" exist. The count is of opaque encrypted blobs. It tells you whether the account has ever stored anything, never what it is.

### Terms

Shows which version of the Terms of Service and Privacy Policy the account accepted, and when: a green **Terms accepted** chip, or an amber **Older terms accepted** or **Not accepted yet** chip. Customers accept at sign-up with a required box, and the account cannot be created without it. Accounts created before the Terms existed show **Not accepted yet**, and accounts whose accepted version is older than the current one show **Older terms accepted**: an Administrator of the account is asked to accept at their next sign-in and cannot use the account until they do. The acceptance is also in the log (the event is `terms.accepted`). Only the version and the time are kept. The current version is one setting in the code (`TERMS_VERSION`, next to the pages in `content/legal`): changing it asks every account again.

### Plan, Change plan and Extend trial

Shows the current plan, any note, the end date ("Ends" or "Ended"), and whether the account is read-only. "Plan history" can be expanded to list every change with date, who made it and the reason.

**Change plan** opens a form:

1. Choose **Plan**: "Free, comped, never expires", "Free trial" or "Paid".
2. For a trial, set **Trial length (days)** (1 to 730, default 14). Tick "Add to the current end date instead of starting today" to extend instead of restarting.
3. For paid, optionally set **Paid through** (a date). Leave it empty for no end date.
4. Write a **Reason (saved in the account's history)**.
5. Press **Save plan**.

**Extend trial** is a shortcut that appears only for accounts on a trial. It opens the same form with Free trial chosen and the add-to-current box ticked. Why: a customer who got busy in week one deserves another week, and extending is kinder than restarting. See [Plans](#/docs/plans).

### Support tools: Suspend and Reactivate

**Suspend** signs everyone in the account out and stops anyone from signing in until you press **Reactivate** (the same button changes its name). Both ask for a **Reason**. Use suspend for non-payment, abuse or a hijacked account. It does not delete anything.

### Receipts

**Record a receipt** writes down money received outside the app, such as a bank transfer. Fields:

- **Amount received** (for example 29.00) and **Currency** (a three-letter code, default USD).
- **How it was paid** and **Reference** (invoice or transfer number).
- **Paid through (optional)** and a tick-box "Also set the plan to Paid through that date".
- **Note**.

Press **Save receipt**. Each saved receipt appears with a **Remove** button, which asks for a reason. This is only a record. Nothing is charged by the app. See [Plans](#/docs/plans).

### Support history

Lists up to the 15 most recent actions Host administrators took on this account, with date, who, what and the reason you gave. It is the quickest way to answer "did anyone already reset this?" before you do it again.

### Site admin linking

A switch labelled "Allow this account to link a Host administrator". When on, the Link option appears in that account's own Security page, so someone who both runs the site and a reseller account can move between the two. Once linked, the account appears under Reseller accounts in your Host Console account menu, and the reseller app's account menu has a Site admin entry that opens the Host Console in a new tab. It is off by default. Only the Owner administrator can change it; for everyone else the switch is greyed out. Turning it off removes existing links. Why you might use it: you run a reseller account yourself and want a quick switch. Otherwise leave it off.

### People

Every person in the account, with chips for their role, **2FA**, **disabled**, a red **locked out** chip while their sign-in is locked, and **Verified** or "Not verified" email, plus their login and last sign-in. Press **Manage** beside a person for their tools.

### Delete

The red **Delete** button opens a sheet. It explains that the delete is permanent and that you cannot recover the data (it was encrypted; the only way back is the customer's own backup file), asks for an optional **Reason (included in the email)**, and asks you to type the account's Reseller ID. **Delete forever** stays greyed out until the ID matches. See "Closing, restoring and erasing" below.

If Email is not set up, the sheet shows a red warning: "Email is not set up, so nobody will be told this account was deleted." You may still go ahead on purpose.

![An account sheet](shot:host-accounts-3 "An account sheet: plan, status and the support tools. The Host sees no business data here.")

## Managing a person

Pressing **Manage** opens a list of buttons. Several are greyed out when they make no sense, for example a person with no email.

1. **Email a password reset link**: queues an email with a link valid for one hour. Needs an email on file and asks for a **Reason**. This is the first thing to try for "I forgot my password".
2. **Resend the confirmation email**: sends the "please confirm your address" email again. Enabled only for people with an unconfirmed email. If email is not set up it tells you; if one was sent a moment ago, wait a minute; there is also a daily limit per person.
3. **Mark as confirmed**: marks the email confirmed without the customer clicking. Use it only when you have checked another way, such as by phone. It requires a reason such as "confirmed by phone".
4. **Set a temporary password**: creates a one-time password, signs the person out everywhere and forces them to choose a new one at next sign-in. It is shown only once in a box, so copy it and give it to them through a safe channel. It is never written to the log.
5. **Reset two-factor authentication**: switches off two-factor and clears their recovery codes, signs them out, and emails them that it happened. They set it up again on next sign-in. Enabled only when they have two-factor on.
6. **Sign out everywhere**: ends all of their sessions on every device.
7. **Disable sign-in** (or **Enable sign-in**): stops (or restores) one person's ability to sign in, without touching the rest of the account. Disabling also signs them out.
8. **Delete this user**: removes the person from the account permanently. You must type their login to confirm. You cannot delete the last Administrator of an account; delete the whole account instead.

All of these ask for a **Reason** except Resend the confirmation email and Delete this user (which asks you to type the login instead). A reason is a few words (at least 3 characters, up to 200). It is saved in the log with your name and shown in Support history. Good reasons are specific: "Owner called, lost phone", not "ok".

> Before resetting two-factor or setting a temporary password, make sure the person is who they say they are. Phone back a number you already hold, or reply to the owner's email address. Someone who tricks you into a reset takes over the account's sign-in.

### Unlock this sign-in

After six wrong passwords (or wrong two-factor codes) in a row, a sign-in is locked for 15 minutes. While that is so, the person shows a red **locked out** chip, and the **Unlock this sign-in** button in their Manage list is available (otherwise it reads **Not locked out** and is greyed out). Press it, say why in a few words, and the lock and the failed-attempt count are cleared at once, so the person can try again right away.

- Only a signed-in Host administrator can do this. Reseller users cannot.
- It never shows, sets or resets a password. If the person has forgotten it, use **Email a password reset link** or **Set a temporary password** afterwards.
- It is written to the [Audit trail](#/docs/audit-trail) under **Bans and lockouts** as "Sign-in unlocked", with your name, the time, the account and your reason, and to the account's Support history.
- If someone else is guessing the password, unlocking lets them try again too. Unlock only when you have good reason to think the person is the real owner.
- All locked sign-ins across the site are also listed on the [Firewall](#/docs/firewall) page.

### Typical cases

- **Forgot password**: Email a password reset link. If their email is wrong or unavailable, Set a temporary password.
- **Lost phone with authenticator**: Reset two-factor authentication, then tell them to set it up again.
- **No confirmation email**: Check [Email](#/docs/email), try Resend, and as a last resort Mark as confirmed.
- **Employee left**: Disable sign-in or Delete this user; the account's own Administrator can also do this.

## Closing, restoring and erasing

There are two ways an account ends. Read this section carefully, because customers ask about it.

### 1. The customer closes it

An Administrator of the account closes it in the reseller app by typing their own password and the Reseller ID. The account then locks for **7 days**:

- Everyone who is not an Administrator is signed out and refused if they try to sign in (the message says the account is closing).
- Administrators can still sign in, but read-only. Changes are refused. They can still read, export and make a backup file.
- An "account is closing" email with the date of the erase goes to the owner email and to the person who closed it.
- In your list the account shows a red "Closing, erases" with the date. Use the **Closing** health filter to see them all, and check it at the start of each week.

During the 7 days, an Administrator of the account can restore it in the reseller app, or you can open the account sheet and press **Restore** in the red closing bar. Restore cancels the closing at once. It does not ask for a reason.

After the 7 days the server erases the account. It checks when it starts and then every hour. **There is no restore after the erase.** Everything of the account is deleted together in one step: sessions, password resets, confirmations, links to Host administrators, the encrypted records and stock items, keys, recovery data, roles, users, billing events and receipts, sign-in history, restore points and the account itself. An "account erased" email goes to the owner and the Administrators.

### 2. You delete it

The red **Delete** button asks you to type the account's Reseller ID (and optionally a reason) and then erases the account at once, with the same result as above and without the 7 days. It cannot be undone. Only erase early when the customer has asked you to or you have a clear reason, and write it down.

**The "account erased" email.** One email goes out as part of the delete. The server first notes the owner's address and the addresses of the account's Administrators (held in memory only, never stored), then erases the account, then sends one "Account erased by the Host" email to each of those addresses. It says the account was deleted by the Host, when, the reason you typed (if any), and that the Host cannot recover the data, because it was encrypted and the only way back is the customer's own backup file. No separate email is sent before the delete, since it could announce a delete that then does not happen. The closing sweep never sends a second email for an account you deleted.

**The delete never waits for the email.** If Email is not set up, or sending fails, the account is still deleted. The [Audit trail](#/docs/audit-trail) then records "deleted, email not sent" with the reason (for example "no email configured", or the mail server's error), so you know to tell the customer yourself. When the email was handed over, the entry says it was queued to that many addresses. Only one delivery attempt is made, so the customer never gets a repeat.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. If it is not set up, nobody is told, and the delete sheet warns you in red.

### What stays after an erase

- **Log entries.** The activity log keeps its entries, but the link to the account is removed in the database copy, so they no longer point to it. Log files on disk keep their text.
- **Receipt email counts.** The numbers of receipt emails sent (used for limits) are kept.
- **Your backups.** Any backup taken before the erase still holds the account in its encrypted form: full-site backups, snapshots and offsite copies, until they are removed by their keep settings. With the defaults that is at most about 8 weeks, and the numbers are yours to change under [Backups](#/docs/backups). If someone asks you to remove their data completely, shorten the keep settings or delete those older files too.

> Erasing is permanent for the customer's data. Because the data belongs to them, they should have exported it first. Their data was encrypted in their own browser, so you could not read it even in a backup.

## What you can and cannot see

You can see: business name, Reseller ID, owner email, people and their logins, roles, two-factor and email status, last sign-in, plan and billing records, whether encryption is set up, how many encrypted records exist, and the support history.

You cannot see: inventory, sales, customers, receipts to their customers, the contents of any record, or their recovery key. You cannot read their data, change it, or recover it.

Related pages: [Pipeline](#/docs/pipeline), [Onboarding](#/docs/onboarding), [Plans](#/docs/plans), [Audit trail](#/docs/audit-trail) and [Logs](#/docs/logs), where every action above is also recorded.
