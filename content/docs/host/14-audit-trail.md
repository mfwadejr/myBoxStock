---
title: Audit trail
summary: A plain record of what each Host administrator did, when, and from where. This page explains what appears in it, how it differs from Logs, and how to use it to answer "who changed that?".
keywords: audit trail, audit, who changed, who did this, administrator actions, accountability, history, support history, settings changed, suspended, reset password, everyone, actor filter, search, load more
order: 14
covers: nav:audit, Everyone, actor filter, Last 24 hours, Last 7 days, Last 30 days, All time, Search actions people addresses Reseller IDs, Load more
---

## What the Audit trail is

The Audit trail is a short, readable list of the things Host administrators did. Each line says who did it, what they did, when, from which address, and, when it concerns a customer, which Reseller ID it was about.

Think of it as the answer to a single question: **who changed that?** If a setting is different from yesterday, an account is suddenly suspended, or an administrator's two-factor was reset, this is the screen that tells you which administrator did it and when.

The page deliberately shows only the Host side of the house. It never includes anything from inside a reseller's account: no inventory, no sales, no customers. The Host cannot see those things, so the Audit trail cannot list them.

## What counts as an audit entry

An entry appears here when it passes all of these tests:

1. It was recorded in the **host** area or the **accounts** area of the log. The host area holds Host Console actions. The accounts area holds the support actions an administrator takes on a customer's account.
2. It has a name attached as the actor. Lines with no name at all are left out. Server events that carry no name (such as starting or stopping) therefore do not appear.
3. It is not a debug-level line. Fine technical detail is left out.

Examples of what you will find:

- Settings saved: sign-ups opened or closed, trial length changed, site address changed, sign-in history period changed, server options changed (it lists which options, not secret values), the announcement banner turned on or off.
- Administrators: a new administrator added, details edited, two-factor reset, temporary password set, signed out everywhere, an administrator deleted.
- Support actions on customer accounts: reset links sent, temporary passwords set, two-factor reset, users signed out or deleted, an email marked as verified, an account suspended, restored or deleted, a payment receipt recorded or removed. These support actions require the administrator to type a short reason, and the reason is kept with the entry.
- Plan changes saved from the Plans screen.
- Backups: a backup downloaded, or a restore requested.
- Email: wording of a message changed or reset, a test email sent, failed messages sent back to the queue.
- Alerts: an alert set aside.
- Updates: the release address saved or a check for a new release run.
- Logs: a log export (the fact that it was exported and how many entries, not the contents).
- Removing a link between a Host administrator and a reseller account.

Because the Audit trail is built from the same stored log as the [Logs](#/docs/logs) screen, it follows the same retention rules. If you set the activity log to be kept for 90 days, audit entries older than 90 days are gone.

## What is not in the Audit trail

Some changes you might expect to see here are recorded in other areas of the log instead. Knowing this saves a lot of head-scratching:

- **Firewall changes** (rate limits, address rules, the Host Console access list, lifting a ban) are written to the security area. Search for them in Logs by choosing the area **security**.
- **The backup files themselves** (creating, deleting, scheduling) are written to the backup area. Downloads and restore requests do appear in the Audit trail, but the "backup created" lines are in Logs under **backup**.
- **Sign-ins, failed sign-ins and lockouts** are in the auth area, not here. They are about people trying to get in, not about administrators changing things.
- **Server events** such as starting, stopping, disk warnings and updates applied have no person behind them, so they are in Logs under **system**.
- **Customers' own activity** is not visible to the Host at all.

A good habit: check the Audit trail first for "an administrator did something", and check Logs when the change was to the firewall, to backups or to the server.

## How it differs from Logs

| | Audit trail | Logs |
|---|---|---|
| Question it answers | Who changed that? | What has the server been doing? |
| Contents | Only actions by Host administrators (host and accounts areas, with a named person) | Every area except customer activity and web requests |
| Levels | Info, warn and error only | Debug through error |
| Detail | One line each: person, time, address, Reseller ID, action name, message | The same plus a "raw" technical copy, level and area labels |
| Filters | Person, time range, search | Area, level, time range, search, quick filters |
| Export | None | CSV and JSON |
| Typical reader | The Owner checking on the team | Anyone troubleshooting a problem |

If you only remember one thing: Audit trail is for accountability, Logs is for troubleshooting.

## Reading the list

Each line shows:

- The date and time.
- The administrator's username, in bold.
- The Reseller ID, if the action was about a customer's account.
- The address the administrator was connecting from.
- A label with the action name, such as `settings.site_url` or `user.temp_password`.
- A message in full sentences, such as "Site address for email links set to https://boxes.example.com".

Newest entries are first. Up to 100 are loaded at a time. The line below the list shows how many are on screen, for example "Showing 100 actions - more available", and the **Load more** button adds the next 100. When nothing matches, the list says "Nothing matches. Try a wider time range."

Entries are only read, never edited. There is no way to delete or change an audit line from the Host Console.

## The filters

There are three controls above the list.

### Person filter

The first menu starts at **Everyone**. It lists every username that has an entry in the log (up to 200 of them), alphabetically. Choose one name to see only what that person did. Names are matched without regard to capital letters. A person who never did anything auditable does not appear in the menu.

### Time range

The second menu has four choices: **Last 24 hours**, **Last 7 days**, **Last 30 days** (the starting choice) and **All time**. "All time" means everything still kept; it cannot go back further than your log retention period.

### Search

The search box ("Search actions, people, addresses, Reseller IDs") looks through the message, the action name, the administrator's name, the address and the Reseller ID. It is not case sensitive and runs shortly after you stop typing. It matches parts of words.

Combine the controls. For example, pick a person, choose All time, and type a Reseller ID to see everything that person did to one customer.

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

The Audit trail will not show it. Open [Logs](#/docs/logs), choose the area **security**, and search for the address. The log line says who added the rule and when.

## Tips for using it well

> The Owner (the first administrator) is the only person who can add, delete, reset or sign out other administrators. Those actions are all in the Audit trail, so reviewing it once a month is a quick way to confirm that only the changes you expected were made. See [Security](#/docs/security) for how administrators are managed.

- Give every helper administrator their own account. If everyone shares the `admin` login, the Audit trail can only say that "admin" did something, which defeats the point.
- Check it after any period when someone else had access.
- Use the address shown to spot a change made from somewhere unusual. It is the address the site saw for the administrator; behind a proxy it is only accurate if the proxy setting is right (see [Settings](#/docs/settings)).
- Write clear reasons when the console asks for them. The reason is what makes the line useful months later.

## Common mistakes

- Looking only at the default Last 30 days. An old change needs All time.
- Expecting firewall changes or sign-in failures here. They live in Logs.
- Forgetting the command line. Running `reset-host-admin` on the server is recorded here too, but with the actor shown as `cli` instead of a person's username, because nobody signed in to the console to do it. A `cli` entry means someone with access to the server itself did it. Other changes made directly on the server, such as editing the container's settings, leave no audit line at all.
- Treating the Audit trail as proof of what a customer did. It records only Host administrators.
