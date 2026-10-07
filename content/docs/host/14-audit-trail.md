---
title: Audit trail
summary: A plain record of what each Host administrator did and who signed in to the Host Console: settings, accounts, firewall rules, bans, sign-ins and two-factor changes. This page explains every kind of entry, how it differs from Logs, and how to answer "who changed that?".
keywords: type filter, system, firewall changes, bans, lockouts, sign-ins, two-factor, audit trail, audit, who changed, who did this, administrator actions, accountability, history, support history, settings changed, suspended, reset password, everyone, actor filter, search, load more
order: 14
covers: nav:audit, Everyone, All kinds of entry, Type filter, Settings and accounts, Firewall and access, Bans and lockouts, Host Console sign-ins, Two-factor, System, Firewall rule added, Firewall rule changed, Firewall rule removed, Rate-limit settings changed, Host Console access limit changed, Ban created, Ban lifted, Host Console sign-in locked, Host Console sign-in, Host Console failed sign-in, Host Console sign-out, Two-factor turned on, Two-factor turned off, Two-factor recovery code used, Showing N of M actions, actor filter, Last 24 hours, Last 7 days, Last 30 days, All time, Search actions people addresses Reseller IDs, Load more, Sign-in unlocked, account erased email, deleted email not sent
---

## What the Audit trail is

The Audit trail is a readable list of the things Host administrators did and of who got into the Host Console. Each line says who did it, what they did, when, from which address, and, when it concerns a customer, which Reseller ID it was about.

Think of it as the answer to a single question: **who changed that?** If a setting is different from yesterday, an account is suddenly suspended, or an administrator's two-factor was reset, this is the screen that tells you which administrator did it and when.

The page deliberately shows only the Host side of the house. It never includes anything from inside a reseller's account: no inventory, no sales, no customers. The Host cannot see those things, so the Audit trail cannot list them.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## What counts as an audit entry

The Audit trail is built from the same stored log as the [Logs](#/docs/logs) screen. An entry appears here when it is one of these two kinds.

1. **An action by a named administrator** in the **host** or **accounts** area of the log: settings, accounts, administrators, plans, email, backups and so on. The entry has a name attached. Lines with no name are left out.
2. **A security event that is on the list of audited events**: firewall changes, bans, lockouts, Host Console sign-ins and two-factor changes (below). These appear even when no person is attached, in which case the name shows as **System**.

Debug-level lines are never shown.

### Everything you will find

**Settings and accounts** (the first group of entries):

- Settings saved: sign-ups opened or closed, trial length, site address, sign-in history period, the announcement banner on or off, and server option changes. A server option entry lists only what changed, with the value before and after.
- Administrators: added, edited, two-factor reset, temporary password set, signed out everywhere, deleted.
- Support actions on a customer's account: reset links sent, temporary passwords set, two-factor reset, users signed out, disabled or deleted, an email marked as confirmed, an account suspended, restored or deleted, a receipt recorded or removed. The reason the administrator typed is kept with the entry.
- Plan changes.
- Backups: a backup or snapshot run (scheduled or by hand, by the name "scheduler" when it ran by itself), a restore, a download, a delete, a test restore, a destination saved, tested or removed, and backup settings saved. None of them contain a password or key.
- Email: wording changed or reset, a test sent, failed messages resent.
- Alerts set aside, release address saved, a log export, a link to a reseller account removed.

**Firewall and access:**

- Firewall rule added, Firewall rule changed (turned on or off) and Firewall rule removed.
- Rate-limit settings changed.
- Host Console access limit changed.

**Bans and lockouts:**

- Ban created. The server creates bans by itself when an address breaks the limits too often, so the name shows **System**.
- Ban lifted, with the administrator who lifted it.
- Sign-in unlocked: a Host administrator cleared a lockout from the Firewall page or from a person's tools in Accounts. It shows who unlocked which sign-in and when (and the reason, when it was done from Accounts). A reseller's lockout can be unlocked, but only the unlocks are listed here.
- Host Console sign-in locked: a Host Console sign-in name was locked for 15 minutes after six wrong attempts.

**Host Console sign-ins:**

- Host Console sign-in, Host Console failed sign-in and Host Console sign-out.

**Two-factor:**

- Two-factor turned on, Two-factor turned off and Two-factor recovery code used.

Each entry says who, what, when and from which address. Reseller sign-ins never appear here, and neither does anything from inside a reseller's account. Only your own console's sign-ins are listed.

Because the Audit trail follows the same retention rules as Logs, if you set the activity log to be kept for 90 days, audit entries older than 90 days are gone.

## What is not in the Audit trail

- **Everything else the server does**: server start and stop, disk warnings, updates applied and other events with no person behind them. They are in Logs under **system**.
- **Backup files being created, thinned or deleted by the schedule** are in Logs under **backup**. The Audit trail shows the runs and the actions people took.
- **Reseller sign-ins and failed sign-ins.** They are about customers, not about the Host, and are in Logs only (area auth).
- **Customers' own activity** is not visible to the Host at all.
- **Changes made directly on the server**, such as editing the container's settings, leave no audit line.

A good habit: check the Audit trail first for "an administrator did something" or "who got into the console", and check Logs when you need the full story.

## How it differs from Logs

- **Question it answers.** Audit trail: who changed that? Logs: what has the server been doing?
- **Contents.** Audit trail: actions by Host administrators, plus firewall, ban, lockout, Host Console sign-in and two-factor entries. Logs: every area except customer activity and web requests.
- **Levels.** Audit trail: info, warn and error only. Logs: debug through error.
- **Detail.** Audit trail: one line each, with a friendly label. Logs: the same plus a raw technical copy, level and area labels.
- **Filters.** Audit trail: person, type, time range, search. Logs: area, level, time range, search, quick filters.
- **Export.** Audit trail: none. Logs: CSV and JSON.
- **Typical reader.** Audit trail: the Owner checking on the team. Logs: anyone troubleshooting.

If you only remember one thing: Audit trail is for accountability, Logs is for troubleshooting.

## Reading the list

Each line shows:

- The date and time.
- The administrator's username, in bold.
- The Reseller ID, if the action was about a customer's account.
- The address the administrator was connecting from.
- A label in plain words, such as "Firewall rule added" or "Host Console failed sign-in". Hover over the label to see the raw event code, such as `rule.added`. Entries that have no friendly label show the code itself.
- Where the person is missing, the name shows as **System**. That is a change the server made on its own, such as a ban created automatically.
- A message in full sentences, such as "Site address for email links set to https://boxes.example.com".

Newest entries are first. On tablets and computers the list scrolls inside a box of its own, about 640 pixels tall, with the filters staying above it. On phones the page scrolls instead. Up to 100 entries are loaded at a time. The line below the list shows how many are on screen, for example "Showing 100 of 480 actions", and the **Load more** button adds the next 100. When nothing matches, the list says "Nothing matches. Try a wider time range."

Entries are only read, never edited. There is no way to delete or change an audit line from the Host Console.

## The filters

There are four controls above the list: the person, the type, the time range and a search box.

### Person filter

The first menu starts at **Everyone**. It lists every username that has an entry in the log (up to 200 of them), alphabetically. Choose one name to see only what that person did. Names are matched without regard to capital letters. A person who never did anything auditable does not appear in the menu.

### Type

The second menu starts at **All kinds of entry**. It narrows the list to one group:

- **Settings and accounts**: what administrators changed (settings, accounts, plans, email, administrators). An account deleted by a Host administrator appears here as "deleted" with the reason, and ends either "email queued to N addresses" or "email not sent" followed by the reason (for example no email configured). If the mail server then refuses the "account erased" message, a second entry says "deleted, email not sent" with the mail server's reason.
- **Firewall and access**: firewall rules, rate-limit settings and the Host Console access limit.
- **Bans and lockouts**: bans created and lifted, sign-ins unlocked by an administrator, and Host Console sign-ins that were locked.
- **Host Console sign-ins**: successful and failed sign-ins and sign-outs.
- **Two-factor**: turned on, turned off and recovery codes used.
- **Backups**: backups made (by hand or by the schedule, shown as "scheduler"), restores, downloads, deletions, test restores, destinations saved, tested or removed, and backup settings changes.

### Time range

The third menu has four choices: **Last 24 hours**, **Last 7 days**, **Last 30 days** (the starting choice) and **All time**. "All time" means everything still kept; it cannot go back further than your log retention period.

### Search

The search box ("Search actions, people, addresses, Reseller IDs") looks through the message, the event code, the administrator's name, the address and the Reseller ID. It is not case sensitive and runs shortly after you stop typing. It matches parts of words.

Combine the controls. For example, pick a person, choose All time, and type a Reseller ID to see everything that person did to one customer. Or choose the type **Host Console sign-ins** and the last 24 hours to see who has been signing in.

## How to answer "who changed that?"

### Example 1: sign-ups were closed and nobody remembers closing them

1. Open **Audit trail**.
2. Set the range to **Last 30 days**.
3. Type `settings` in the search box. Entries such as "Platform settings updated (sign-ups closed)" appear with the username and time.
4. If it is not there, widen the range to **All time**.

### Example 2: a customer says their password was reset and they did not ask

1. Type the customer's Reseller ID in the search box.
2. Look for entries such as `user.temp_password` or `user.reset_link_sent`.
3. Read the message and the administrator's name. The reason that administrator typed when they did it is part of the entry.
4. If you do not recognise the administrator or the address, change that administrator's password from the Security screen and review the Logs for sign-ins.

### Example 3: an administrator says they were signed out unexpectedly

1. Choose their name in the person menu, or type their username in search.
2. Look for `admin.signed_out`, `admin.mfa_reset` or `admin.temp_password` entries made by the Owner.
3. Those actions end every open session of that administrator immediately, and a two-factor reset also sends them an email if they have an address saved.

### Example 4: a firewall rule is blocking someone

1. Choose the type **Firewall and access**.
2. Type the address in the search box.
3. Read who added, changed or removed the rule, and when.

### Example 5: a ban you did not expect

Choose the type **Bans and lockouts**. "Ban created" by **System** means the server banned the address after too many violations. "Ban lifted" shows which administrator ended it. A "Host Console sign-in locked" line shows a sign-in name that was locked for 15 minutes.

### Example 6: did anyone else sign in to the Host Console?

Choose the type **Host Console sign-ins**. Look for sign-ins from addresses you do not recognise, and a run of "Host Console failed sign-in" lines. Check the **Two-factor** type for two-factor that was turned off or a recovery code that was used.

## Tips for using it well

> The Owner (the first administrator) is the only person who can add, delete, reset or sign out other administrators. Those actions are all in the Audit trail, so reviewing it once a month is a quick way to confirm that only the changes you expected were made. See [Security](#/docs/security) for how administrators are managed.

- Give every helper administrator their own account. If everyone shares the `admin` login, the Audit trail can only say that "admin" did something, which defeats the point.
- Check it after any period when someone else had access.
- Use the address shown to spot a change made from somewhere unusual. It is the address the site saw for the administrator; behind a proxy it is only accurate if the proxy setting is right (see [Settings](#/docs/settings)).
- Write clear reasons when the console asks for them. The reason is what makes the line useful months later.

## Common mistakes

- Looking only at the default Last 30 days. An old change needs All time.
- Expecting reseller sign-ins here. Only Host Console sign-ins are listed.
- Forgetting the command line. Running `reset-host-admin` on the server is recorded here too, but with the actor shown as `cli` instead of a person's username, because nobody signed in to the console to do it. A `cli` entry means someone with access to the server itself did it. Other changes made directly on the server, such as editing the container's settings, leave no audit line at all.
- Treating the Audit trail as proof of what a customer did. It records only Host administrators.
