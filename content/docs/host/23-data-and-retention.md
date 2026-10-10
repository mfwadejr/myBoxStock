---
title: Data and retention
summary: See what is using space on the server, how long each kind of Host-side data is kept, remove old data safely with a preview and a typed confirmation, give disk space back by compacting the database, and set up automatic nightly pruning. Only the Owner administrator changes anything.
keywords: data and retention, retention, retain, keep, how long, prune, pruning, prune now, preview, PRUNE, compact, compact database, vacuum, shrink, disk space, free space, space usage, database size, biggest tables, log files, screenshots, temporary files, mail history, audit trail forever, audit floor, one year, 365 days, automatic pruning, nightly, hour, activity log days, LOG_RETENTION_DAYS, owner only, read only, closed tickets
order: 23
covers: nav:retention, Data and retention, What is using space, Database, Log files, Backup files, Ticket screenshots, Temporary files, Free disk space, Biggest tables, Retention rules, Activity log, Audit trail, Closed support tickets, Mail history, Backups, Change, Days to keep, Prune now, Remove anything older than this many days, Type PRUNE to confirm, Prune, Compact the database, Compact database, Compact now, Automatic pruning, Hour of the night, Pruned automatically, Manual only, Open Backups, Owner only
---

## What this page is for

The **Data and retention** page answers four questions about the server's own housekeeping: what is using space, how long each kind of data is kept, how to clean up old data safely, and how to give disk space back. It sits in the left menu between **Audit trail** and **Updates**.

It only deals with data the Host can already read: the activity log, the audit trail, support tickets, the mail history and temporary files. It never touches customer business data (inventory, customers, sales). That data is encrypted by each reseller and the Host cannot read it, so the Host cannot and does not prune it.

Everyone who can sign in to the Host Console can read this page. Only the **Owner administrator** (the oldest administrator, normally "admin") can change a rule, prune, compact or change automatic pruning. Other administrators see the numbers and a blue note saying so, and the buttons are not shown. If someone else tries anyway, the server refuses and the attempt is written to the [Audit trail](#/docs/audit-trail).

![Data and retention](shot:host-retention "Data and retention: what is using space, retention rules and compacting.")

## What is using space

The six tiles at the top are read-only facts.

- **Database** is the size of the database, with how much of it is free space inside the file (see Compact the database below).
- **Log files** is the size of the log files on disk and how many there are. They rotate by size, not by age.
- **Backup files** is the size of the backup folder.
- **Ticket screenshots** is how much the screenshots attached to support tickets use. They are stored in the database.
- **Temporary files** is the scratch folders and holding files that are waiting to be cleaned up.
- **Free disk space** is what is left on the disk that holds the data folder, out of its total.

Under them, **Biggest tables** lists the largest tables of the database with their row counts and sizes. Only table names and sizes are shown; nothing inside a reseller's records can be seen.

## Retention rules

There is one row for each kind of data. Each row shows its current value, a short note saying how it is saved, and, for the Owner, a **Change** button and a **Prune now** button.

- **Activity log**: the general log kept in the database (sign-ins, firewall events, mail delivery, system messages). The default is 90 days; allowed range 7 to 730 days. This is the same value as **Keep the activity log (days)** on the [Settings](#/docs/settings) page and the `LOG_RETENTION_DAYS` environment value, now visible and changeable here. The files on disk are separate and rotate by size.
- **Audit trail**: what Host administrators did. It is kept apart from the activity log, so trimming the log never removes audit entries. The default is **forever**. The Owner can set a number of days, but never fewer than **365**, so one mistaken click cannot erase the evidence. Enter 0 for forever. Entries that existed before this rule came in were all kept. The entries about retention itself (rule changes, prunes, compacting) are never pruned, whatever the number.
- **Closed support tickets**: by default closed tickets are kept until the Owner purges them. The Owner can set an automatic age in days (0 means off). Open tickets are never touched. See [Support tickets](#/docs/support-tickets).
- **Mail history**: sent and failed messages in the mail queue. The default is 30 days. Mail still waiting to go out is never touched. See [Email](#/docs/email).
- **Backups**: shown here for completeness, with a link. How snapshots are thinned and how long safety copies and offsite copies are kept is set on the [Backups](#/docs/backups) page, so it is not defined twice. **Open Backups** takes you there.
- **Temporary files**: scratch folders left by Test a backup file, files waiting in the holding folder and half-made backup copies. The default is 1 day.

**Change** opens a small window with a **Days to keep** box. A number outside the allowed range is refused with the reason, and nothing is saved. Every change is written to the Audit trail with the old and the new value.

## Prune now

**Prune now** removes data older than the rule right away.

1. Press **Prune now** on a row. A window opens with **Remove anything older than this many days**, filled with the rule's value (or a suggestion when the rule is forever or off).
2. A blue line shows a preview before anything is deleted: for example "This would remove 18,204 activity-log rows, about 31 MB, the oldest from Jul 2." It updates as you change the number. The audit trail cannot be pruned to fewer than 365 days here either.
3. Type **PRUNE** in the box. The **Prune** button stays off until the word is right and there is something to remove.
4. Press **Prune**. The rows are deleted and a toast says how many.

The numbers in the preview and the numbers deleted come from the same selection, so they match. A prune cannot be undone. Backups made earlier still hold what was removed until those backups age out.

Every prune writes an entry to the Audit trail under **Data pruned**: who did it (or System for the nightly run), what kind, how many rows and about how many bytes, and how old the cut-off was.

## Compact the database

On the built-in SQLite database, deleting rows does not make the file smaller. The space is only reused later. So a prune alone does not give disk space back. **Compact database** rewrites the file without its unused space and returns it to the disk.

- Press **Compact database**, then **Compact now**. It runs as a background job with the same progress strip as backups and restores, at the top of the page. You can leave the page and come back; the strip is still there.
- Only one job runs at a time, and compacting cannot start while a backup or restore is running (and the other way round). The site may pause for a moment while the file is rewritten.
- Before it starts, the server checks there is enough free disk space for a second copy of the database. If not, it tells you how much room it needs and changes nothing.
- When it finishes, the strip says how much was freed. The result is also written to the Audit trail as **Database compacted**.

With PostgreSQL or MariaDB the button is not offered: those servers manage their own free space.

## Automatic pruning

The last card prunes by itself once a night.

- The switch at the top turns automatic pruning on or off for the whole page.
- **Hour of the night** is when the nightly run happens, by the server's clock.
- Each row has its own switch: **Pruned automatically** or **Manual only**. By default the activity log, mail history and temporary files are automatic. Closed tickets and the audit trail are manual.
- A row with no age set (the audit trail on forever, tickets with no automatic age) prunes nothing even when its switch is on.

Each automatic prune that removes something writes a **Data pruned** entry with System as the person. A night that finds nothing to remove writes nothing. The card shows when the last nightly run happened and what it removed.

## Where it shows up elsewhere

- The [Audit trail](#/docs/audit-trail) has a **Data and retention** filter for every rule change, prune and compaction.
- [Logs](#/docs/logs) explains the activity log, and [Running the server](#/docs/running-the-server) lists `LOG_RETENTION_DAYS`, which is now only the starting value.
- The [Glossary](#/docs/glossary) defines Prune and Compact the database.

> If the disk is nearly full, prune first, then compact, then look at the Backups page. Pruning alone will not free disk space on SQLite.
