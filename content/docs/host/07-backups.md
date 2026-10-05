---
title: Backups
summary: Set up automatic and full-site backups, keep copies off the server, and know exactly how to restore one when you need it.
keywords: backup, backups, restore, full-site, passphrase, off-box, retention, verify, mbsbak, disaster, copy, snapshot, pre-restore
order: 7
covers: nav:backups, Automatic daily backup, Hour (UTC), Keep, Save, Scheduled full-site backups, How often, Every night, Once a week, Weekly copy is taken on, Backup runs on, Keep daily copies, Keep weekly copies, Off-box folder (optional), Backup passphrase, Email Host administrators if a backup fails, Run one now, Backup files, Full-site backup, Back up now, Download, Restore, Delete, Create backup, Type RESTORE to confirm, Last good backup, restore-bundle
---

## What this page is for

A backup is a saved copy of your whole platform database at one moment. If a disk fails, a server is lost or an update goes wrong, a backup is how you get back. Every customer account lives in one database, so one good backup protects all of them and one missing backup risks all of them. The **Backups** page is where you set how often copies are made, how many are kept, where they go, and where you restore one.

> Customers own their business data and are responsible for their own exports and recovery key. Your backups are the safety net for the platform. They cannot recover a customer's lost password or recovery key, and you cannot open them to read customer records.

## What a backup contains

Two different kinds of file can appear in the **Backup files** list.

### Database backups

These are plain copies of the platform database: a `.db` file on the default SQLite engine, or a `.sql` file made with `pg_dump` or `mysqldump` on PostgreSQL or MariaDB. They hold accounts, users, plans, Host administrators, settings, logs, the email queue and alerts, plus customer business data in encrypted form, protected by keys only the customer can unlock. You cannot read that data, and neither can anyone who steals the file. They do **not** hold the server's own encryption key (`secret.key`), which protects two-factor secrets, the SMTP password and the saved backup passphrase.

> A plain database file is not passphrase-protected. It exposes account names, email addresses and administrator password hashes, so treat it as sensitive.

### Full-site backups

A full-site backup is one `.mbsbak` file holding the database, the server's encryption key and a note of when and on which version it was made, all encrypted with a passphrase you choose. Use it to move servers or recover from losing the machine: with the passphrase it brings everyone back exactly as they were, including passwords, two-factor, plans and settings. Without the passphrase nobody can open it, including you. Keep the passphrase away from the server.

## Why backups need to be off the server

Backups are written to a `backups` folder inside the data folder, which in the standard Docker setup is the `data` folder beside your compose file: the same disk as the live database. If that disk fails or the machine is lost, the backups go with it. A copy kept **off-box** lives on a different device, such as a network drive or a mounted USB drive. It is the most useful thing you can do on this page, because a backup next to the thing it protects only guards against mistakes, not disasters.

## Automatic daily backup

This is the simple, always-available safety net. It makes a plain database backup once a day.

1. Open **Backups** from the menu.
2. In the card **Automatic daily backup**, use the switch to turn it on or off. It is on by default.
3. Set **Hour (UTC)**, a whole number from 0 to 23. The backup is taken during that hour, in UTC (Coordinated Universal Time), not your local time. If you live in New York, 3 UTC is late in the evening the day before.
4. Set **Keep**, the number of automatic copies to hold on to, from 1 to 365. The default is 14.
5. Click **Save**. A short message says "Schedule saved".

Why it exists: it needs no passphrase and no setup, so something is always being saved. Why the hour matters: pick a quiet time for your customers, since making a backup uses some disk and processor.

Only copies made by this schedule are removed when the count goes past **Keep**. Backups you make by hand are never deleted automatically.

> The server has to be running during the chosen hour. If it is switched off or restarting at that time, that day's automatic backup is skipped.

## Scheduled full-site backups

This card makes full-site (`.mbsbak`) backups on its own, protected by a passphrase, and checks every one of them after writing it. For a hosted service this is the card to set up first.

### The status line

Above the settings you see one line. If a scheduled backup has worked, it reads like "Last good backup: date, file name, size, verified, copied to /backups" or "no off-box copy". If the most recent attempt failed, the line turns red and shows when it failed and why. If nothing has completed yet it says so. The Overview page also shows the last good backup.

### Every field and switch

- **The switch next to the heading** turns scheduled full-site backups on or off. It cannot be turned on until a passphrase has been saved.
- **How often** has two choices. **Every night** makes a daily copy each night. **Once a week** makes just one copy a week.
- **Weekly copy is taken on** (it is labelled **Backup runs on** when How often is **Once a week**) is the day of the week, Sunday to Saturday. With **Every night**, a second copy marked as weekly is also kept on this day, so you have older restore points. With **Once a week**, it is the day the single backup runs.
- **Hour (UTC)** is the hour of the day, 0 to 23, in UTC.
- **Keep daily copies** is how many nightly files to keep, 1 to 90. Default 14.
- **Keep weekly copies** is how many weekly files to keep, 1 to 52. Default 8.
- **Off-box folder (optional)** is a full folder path such as `/backups` that lives outside the data folder. It must start with a slash, otherwise saving is refused. If the folder does not exist yet, the server creates it.
- **Backup passphrase** needs at least 12 characters. Once saved the box shows "Saved - leave blank to keep it". Type a new passphrase only when you want to change it.
- **Email Host administrators if a backup fails** is a switch, on by default.
- **Save** stores all of these settings.
- **Run one now** saves what you have typed and immediately makes one backup, so you can see it work. A message says "Backup finished and verified", or shows the reason it failed.

### Setting it up, step by step

1. Choose a passphrase of 12 or more characters. A phrase of four or five unrelated words is easy to remember and hard to guess. Write it down and store it away from the server, for example in a password manager.
2. Type it into **Backup passphrase**.
3. Choose **How often**, the weekday, and the **Hour (UTC)**.
4. Decide how many copies to keep. Fourteen daily and eight weekly is a sensible start: it gives you two weeks of nightly points and about two months of weekly ones.
5. In **Off-box folder (optional)**, enter the path of a mounted drive or share. In Docker, add a volume to the compose file first, for example mapping a NAS folder to `/backups`, then enter `/backups`.
6. Turn the switch on, leave the failure email switch on, and click **Save**.
7. Click **Run one now** and wait for "Backup finished and verified". Then look at the status line: it should say verified and name your off-box folder.

### What happens on each run

The server snapshots the database, packs it with the encryption key, encrypts the bundle with your passphrase, then immediately reopens the finished file to check it (the key is present and the database passes its integrity check). If it is a weekly day, a weekly copy is made. If an off-box folder is set, the file is copied there and its size compared with the original; a mismatch counts as a failure. Finally, files beyond your **Keep** numbers are removed in both places. File names carry the date and time and the word `daily` or `weekly`. Full-site backups you make by hand carry neither word and are never removed automatically.

### Scheduling details

The schedule makes at most one attempt a day and does not retry on its own. After fixing a problem, use **Run one now** at once. Verification proves the file opens and the database inside is sound; it does not restore it, so see "Testing a restore" below.

### When a backup fails

Two things happen. If **Email Host administrators if a backup fails** is on, every Host administrator who has an email address gets a "Backup failed" message with the time and the reason. And an alert called "The scheduled backup is failing" appears on the Alerts page and in the red banner, and the Owner is emailed once about it (see [Alerts](#/docs/alerts)). The alert clears by itself after the next good backup.

Common causes: a full disk (see the storage alert), an off-box drive that is not mounted, a path that does not exist or is not writable, or a saved passphrase that can no longer be read because the server's encryption key was changed.

## Backup files

The **Backup files** card lists every backup file in the data folder, newest first.

- **File** is the file name.
- **Created** is when the file was made.
- **Size** is how large it is.
- On each row, **Download** saves a copy to your computer, **Restore** starts a restore (shown for full-site `.mbsbak` files and SQLite `.db` files only), and **Delete** removes the file after a confirmation.

### Making a backup by hand

- **Back up now** makes a plain database backup straight away. Use it before anything risky, such as an update (see [Updates](#/docs/updates)).
- **Full-site backup** asks for a **Backup passphrase** (at least 12 characters, not stored for this manual kind) and a **Create backup** button. The file then appears in the list.

Every download is written to the activity log. Download the `.mbsbak` file, or let the off-box folder take it, so a copy always exists away from the live server.

## Restoring a backup

Restoring replaces the live database with the one in the backup. Every customer is returned to the moment the backup was made. Anything they did after that moment is gone from the platform. That is why a restore is a serious step, and why customers keeping their own exports is part of the arrangement.

### How a restore works

A restore is staged, then applied when the server restarts. The server never swaps a database underneath live traffic. The steps below are what you do and what the server does.

1. In **Backup files**, find the file and click **Restore**.
2. For a `.mbsbak` file, type the **Backup passphrase**. The server checks it first, before anything else happens. A wrong passphrase stops the restore with the message "Wrong passphrase, or the backup file is damaged."
3. Type the word `RESTORE` in the confirmation box. This is the **Type RESTORE to confirm** field for full-site files, or the confirmation prompt for database files.
4. Click **Restore**. The server first saves the current database as a "pre-restore" backup, so you can undo the restore. It then places the chosen file in a waiting spot and restarts itself.
5. The page says it is restoring and reloads after a few seconds. On the way back up, the server swaps in the restored database (and, for a full-site backup, the encryption key). Everyone is signed out and must sign in again.

> The restart depends on your container being set to restart automatically. The standard compose file uses `restart: unless-stopped` and says this is required. Without it, the app would stop and stay stopped after a restore.

### Database restore versus full-site restore

- A **database** restore (`.db`) puts the database back and keeps the current encryption key. Use it on the same server to roll back in time.
- A **full-site** restore (`.mbsbak`) puts back the database and its matching key. The previous key is saved in the backups folder as `secret-pre-restore-...`. Use it after a disaster.
- On PostgreSQL or MariaDB there is no console restore; load the dump with `psql` or `mysql`.

### Moving to a new server

Make a full-site backup, download the `.mbsbak` file and keep the passphrase. On the new, empty server run `BACKUP_PASSPHRASE='your passphrase' node server.mjs restore-bundle --file yourfile.mbsbak` (in Docker, inside the container before first start), then start it. The command refuses if the server already holds data unless you add `--force`, which keeps the current database as a copy. For PostgreSQL or MariaDB backups it leaves `restored-dump.sql` in the data folder to load with `psql` or `mysql`.

## Testing a restore

A backup you have never restored is a hope, not a plan. The automatic check proves the file opens, but only a real restore proves your passphrase, your off-box copy and your procedure.

1. On a spare computer or second container with an empty data folder (never the live server), copy a recent `.mbsbak` file from your off-box folder.
2. Run the `restore-bundle` command above with your passphrase.
3. Start that copy, sign in at its `/host/` address and check Accounts shows the expected accounts. You will not see inside any customer's data, which is the point.
4. Shut it down and delete its files. It holds real email addresses, so keep it off the internet and do not let it send mail.

Do this when you first set up, after any change to the passphrase or off-box location, and every few months. Related: [Alerts](#/docs/alerts), [Recovery and emergencies](#/docs/recovery-and-emergencies), [Running the server](#/docs/running-the-server).

