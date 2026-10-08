---
title: Logs
summary: How to read, filter, search and export the server's activity log, where the log files live on disk, how long they are kept, and what is never written to them.
keywords: feed box, showing n of m, scrolling box, logs, log, activity log, areas, level, debug, info, warn, error, quick filters, problems today, failed sign-ins, lockouts and bans, search, raw, json, export csv, export json, load more, log files, jsonl, retention, redacted, http log, tenant, troubleshooting
order: 13
covers: nav:logs, area filter, All areas, auth, security, host, accounts, backup, mail, system, database, error, level filter, All levels, debug, info, warn, Last hour, Last 24 hours, Last 7 days, Last 30 days, All time, Custom dates, From, To, Search messages events people IP addresses Reseller IDs, Problems today, Failed sign-ins, Lockouts and bans, Errors, Clear filters, raw, Load more, Showing N of M entries, feed box, Export CSV, Export JSON, LOG_DIR, LOG_LEVEL, LOG_MAX_MB, LOG_FILES, LOG_RETENTION_DAYS, LOG_CONSOLE
---

## What the Logs screen is

Logs is the server's diary. Whenever something happens on the platform, such as a sign-in, a failed password, a blocked address, a backup, an email going out or an error, a line is written to the log in plain English. The Logs screen lets you search that diary.

Use it when you want to know what the server has been doing and why. Typical questions it answers:

- Why did that customer say they were locked out?
- Where are all these failed sign-ins coming from?
- Did last night's backup run, and did it work?
- Did an email fail, and what was the reason?
- Why did the server restart?

Logs is about the platform itself. It never contains a customer's inventory, sales or customer list, because the Host cannot see those and the server does not write them down. A related but different screen, the [Audit trail](#/docs/audit-trail), lists what Host administrators did and who signed in to the Host Console. Everything in the Audit trail is also in Logs, but Logs has much more: it is the place for troubleshooting, and the Audit trail is the place for accountability.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## How an entry looks

Each entry in the list shows:

- A coloured **level** label: debug (plain), info (blue), warn (amber) or error (red).
- An **area** label, which says which part of the server wrote the line.
- The **event** name in a typed font, such as `login.failed`. Event names read like `thing.what_happened`.
- The date and time.
- The person involved (who did it or whose sign-in it was), if there is one.
- The **Reseller ID** (the account code, such as BX-ABC123) when the entry belongs to a customer's account.
- The IP address, if there is one.
- A button called **raw**.
- Below that, the message in a full sentence.

Pressing **raw** opens or closes the technical copy of the same entry as formatted JSON, including a "data" section with extra detail (for example the reason a sign-in failed). Press **raw** again to hide it. Raw is handy when the message alone does not tell you enough.

## Levels

Every entry has a level that says how serious it is:

- **debug**: fine detail, useful when you are tracking down a problem. Very chatty.
- **info**: normal things happening, such as a sign-in or a backup finishing.
- **warn**: something worth a look but not broken, such as a failed sign-in, a rate limit being hit or a request blocked by the firewall.
- **error**: something failed, such as a backup that did not complete or an unexpected crash.

The level filter shows **All levels** or exactly one level. The quick filters below can select two at once (warn and error).

> The level you choose in the filter only narrows what you see. A separate setting, **Log detail** on the [Settings](#/docs/settings) screen, decides what the server records in the first place.

## Areas

Every log line belongs to exactly one area. The area menu starts at **All areas**. When you pick an area, a short description appears under the filters so you remember what it covers.

- **auth**: sign-in, sign-out, sessions, lockouts, two-factor and password changes.
- **security**: firewall rules, rate limiting, bans and blocked requests.
- **host**: Host Console actions: settings, administrators, firewall, mail and backups.
- **accounts**: Host support actions on accounts: password resets, suspending, deleting.
- **backup**: backups, restores and the backup scheduler.
- **mail**: the outgoing email queue and delivery.
- **system**: server start and stop, configuration, resource warnings (disk or memory nearly full), and log pruning.
- **database**: connections, migrations and database copies.
- **error**: unhandled errors, with the technical trail.

Two further areas exist but are not offered in this menu:

- **http** records every web request (method, path, result and timing). There are so many that it is written only to the log files on disk, not to the searchable log.
- **tenant** records customer account activity as event names and IDs only, never business data. It is deliberately hidden from the Host Console. The Host cannot read a customer's own activity.

Changing the area also clears any event filter that a quick filter had set.

## Time range

The range menu has six choices: **Last hour**, **Last 24 hours** (the default), **Last 7 days**, **Last 30 days**, **All time** and **Custom dates...**. Choosing Custom dates shows two date boxes, **From** and **To**. Both days are included, from the start of the From day to the end of the To day, in your browser's time zone. You may fill in only one of them.

## Search

The search box looks through the message text, the event name, the person, the IP address and the Reseller ID. It is not case sensitive, and it waits a moment after you stop typing before it runs. It finds parts of words, so `bx-abc` finds every entry for that account and `10.0.0.` finds a range of addresses.

Examples:

- Type a Reseller ID to see everything the platform recorded about that account.
- Type `backup` to find backup messages in any area.
- Type a person's name to see their sign-in attempts.
- Type an IP address to follow one visitor.

## Quick filters

Four buttons set several filters in one click. They replace any filters you had.

- **Problems today**: warn and error entries from the last 24 hours, across all areas. A good first look each morning.
- **Failed sign-ins**: area auth, events login.failed, login.blocked and mfa.failed, last 7 days. This is the list the Alerts screen points you to when it warns about many failed sign-ins.
- **Lockouts and bans**: events lockout.started, ban.created, request.banned, rate_limit.auth and rate_limit.requests, last 7 days. It shows who was locked out, banned or slowed down.
- **Errors**: area error, last 7 days. Open this after the Updates screen shows errors since start.

**Clear filters** returns everything to the starting position: all areas, all levels, last 24 hours, empty search.

Your current filters are saved in the address of the page, so you can bookmark a search or send the link to another Host administrator.

## Reading the list and loading more

The newest entries come first. On tablets and computers the list scrolls inside a box of its own, about 640 pixels tall, so the filters stay in view above it and the export buttons stay below it. On phones there is no box: the page itself scrolls. Up to 100 entries are loaded at a time. The line under the list says, for example, "Showing 100 of 4210 entries". Press **Load more** to add the next 100 below. Paging does not skip or repeat entries even if new ones arrive while you read. If nothing matches, the screen says "No matching entries. Try a wider time range or clear the filters." That usually means the range is too short or the search is too specific.

## Exporting

Two buttons under the list download what you are looking at:

- **Export CSV**: a spreadsheet file with the columns time, level, area, event, actor, account, IP and message.
- **Export JSON**: the same entries as a JSON file, with an ISO time and the full raw detail for each entry.

How it works:

1. Set the filters you want (for example Failed sign-ins and Last 7 days).
2. Press **Export CSV** or **Export JSON**.
3. A file named like `myboxstock-logs-2026-10-05-12-30-01.csv` downloads and a short "Export downloaded" message appears.

An export contains up to 5,000 of the newest matching entries, not just the ones you have loaded on screen. If you need more, narrow the time range and export in pieces. Every export is itself logged (in the host area), so the Audit trail shows who exported logs and how many entries.

> Exported files can contain people's email addresses, usernames and IP addresses. Treat them as private and delete them when you are done.

## Log files on disk

The same lines are also written to files on the server, in three copies:

- A human-readable file for each area: `<LOG_DIR>/<area>/<area>.log`.
- A machine-readable file for each area, one JSON object per line: `<LOG_DIR>/<area>/<area>.jsonl`.
- The searchable copy in the database, which is what this screen reads.

The log folder defaults to a `logs` folder inside your data folder (in the Docker setup that is `/data/logs`, so it lives on your data volume). It can be moved with the `LOG_DIR` setting. Only the http area has files but no database copy.

Files do not grow forever. They rotate by size: when the current file reaches `LOG_MAX_MB` (10 MB by default) it is renamed to `.1`, the older ones shift along, and the oldest beyond `LOG_FILES` (5 by default) is deleted. So each file type holds the current file plus up to five older ones.

If the container's `LOG_CONSOLE` setting is not turned off, every line except debug is also printed to the container's own output, which is what `docker logs` shows. That is useful when the web console is not reachable at all.

Reading files directly is for when the console is down. From the folder that holds your data:

- Follow sign-ins live: `tail -f data/logs/auth/auth.log`
- Filter the raw files with a JSON tool such as `jq`.

## How long logs are kept

Two separate rules apply:

- The database copy that this screen reads is deleted once it is older than the retention period. The default is 90 days, and you can change it at any time with **Keep the activity log (days)** on the [Settings](#/docs/settings) screen (7 to 730 days). The clean-up runs about once a day, so an entry may stay a little beyond its date, and a note "Removed N log rows" appears in the system area when it runs.
- The files on disk rotate by size as described above, not by age.

The Audit trail is read from the same stored log, but it is kept on its own rule. The 90-day (or whatever you set) trimming never removes audit entries: they stay forever unless the Owner sets a longer-than-a-year limit on [Data and retention](#/docs/data-and-retention). You can also see and change the activity-log age there.

## Log detail: what gets recorded

The **Log detail** option on Settings is a threshold. Choose **Info (normal)** and debug lines are not recorded at all; choose **Errors only** and nothing below error is recorded. The default is Info.

Be careful with the stricter choices. Failed sign-ins are recorded as warnings. If you choose Errors only, the server stops recording them, the Failed sign-ins quick filter goes quiet, and the Alerts check for many failed sign-ins can no longer see them. Debug is the opposite: it makes the log very large and is best used for a short time while chasing a problem, then switched back.

## What is never logged

The logging is built so that private material stays out:

- **Customer business data**: inventory, customers and sales are never written to any log. The Host cannot see them in the first place.
- **Tenant activity**: the tenant area holds only IDs and event names, and the Host Console will not show it.
- **Secrets**: in the technical detail of every entry, any field whose name contains password, secret, token, csrf, hash, recovery, otp, authorization or cookie is replaced with "[redacted]". Passwords, tokens and recovery codes do not reach the logs. Temporary passwords are shown once on screen and are not logged.
- **Very long values**: text longer than 500 characters is cut short.

Backup passphrases are never logged either.

## Common mistakes

- Reading "no results" as "nothing happened". Check the time range first, then whether Log detail hides that level.
- Leaving Log detail on Debug for weeks. The files and database grow fast.
- Forgetting that http is not in the menu. Individual web requests are only in the files on disk.
- Searching for a customer's business activity. The Host Console shows platform events only.
- Assuming exports are cleaned. They contain the same addresses and usernames you see on screen.

## A short recipe: investigating a lockout

1. Open **Logs** and press **Lockouts and bans**.
2. Find the person or address in the results, or type it into the search box.
3. Press **raw** on the entry to read the reason and counts.
4. If an address was banned, open [Firewall](#/docs/firewall) to lift the ban. If it was a person's sign-in lockout, it clears itself after 15 minutes. Restarting the server does not clear it: lockouts and bans are saved and come back after a restart. Setting a new password from Accounts does not lift an active lock either, so ask them to wait.
