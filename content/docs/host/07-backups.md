---
title: Backups
summary: How the Backups page protects the server: frequent snapshots, offsite copies, full-site backups and safety copies, where they go, how to set up each kind of destination, how to test and restore one, and how much space it all uses.
keywords: background job, job progress, progress bar, one job at a time, test a backup file, upload backup, restore this file, streamed, streaming, large backups, backup setup, guided setup, hard gate, locked, protected, restore offsite, tabs, backup, backups, restore, snapshot, offsite, off-site, full-site, safety copy, destination, thinning, retention, passphrase, encryption, decrypt-backup, mbsenc, mbsbak, restore-bundle, NAS, SMB, S3, Backblaze, Wasabi, Cloudflare R2, Amazon S3, MinIO, SFTP, WebDAV, NFS, Docker volume, test connection, test restore, cost, disk space, nightly, verify, disaster
order: 7
covers: nav:backups, Backups card on Overview, Backup health alerts, Last test restore, Not proven yet, background job, job strip, Running, View result, Dismiss, Another backup job is already running, Only one backup job runs at a time, Test a backup file, Choose file, Run test, Restore this file, A file from this computer, A file already in the server's backup folder, Test this file, Accounts by plan, Accounts by status, Users by role, Only on the live site, Accounts whose record counts differ, Every account in the file, Find a Reseller ID, Against live, Readable by this server, BACKUP_UPLOAD_MAX_BYTES, streamed backups, Status strip, Last backup, Next run, Offsite copy, Space used, At these settings you will hold about, Frequent snapshots, Offsite copies, Full-site backups, Safety copies, Destinations, Take a snapshot now, Send one now, Run one now, Take a snapshot every, Send a copy every, Send them to, Also send them to, Keep every copy for (hours), Then one an hour for (hours), Then one a day for (days), Then one a week for (weeks), Also keep a plain copy every night, Nightly hour (UTC), Keep nightly copies, Are snapshots protected, Snapshots on this server, Copies held at the destinations, How often, Every night, Once a week, Weekly copy is taken on, Backup runs on, Hour (UTC), Keep daily copies, Keep weekly copies, Extra folder (optional), Backup passphrase, Email Host administrators if a backup fails, Make one with a new passphrase, Create backup, Remove safety copies older than (days), Always keep the newest, Add a destination, Edit destination, Change folder, Backup folder on this server, Folder path, Test connection, Use this destination, Name, Type, Folder or mounted NAS, Windows / NAS share (SMB), S3-compatible storage, SFTP (SSH) server, WebDAV, Server, Share name, Folder on the share (optional), User name, Domain (optional), Endpoint, Region, Bucket, Folder prefix (optional), Access key, Secret key, Use path-style addresses, Port, Folder, Password, Private key (optional), Key passphrase (optional), WebDAV address, Server identity pinned, Download, Restore, Test restore, Delete, Restore this backup, Type RESTORE to confirm, Load more, Showing, decrypt-backup, restore-bundle, .mbsenc, .mbsbak, /data/backup, /data/backups, thinning, safety copy, offsite copy, snapshot, destination, How much will it use, Backup setup, Local only (same disk), Copy off this server, Off-site and verified, Protected, Not protected yet, Prove it, Recommended, Minimal, Custom, Set the passphrase, I have saved this passphrase somewhere other than this server, Go to Destinations, Run the first backup and test restore, Make a full-site backup on a schedule, Restore this copy, Restore from an offsite copy, Test again, Check my passphrase, Change passphrase, Reset (forgotten), Current passphrase, New passphrase, I understand that older copies stay unreadable, made with an earlier passphrase, Support tickets in your backups
---

## What this page is for

A backup is a saved copy of your whole platform database at one moment. If a disk fails, a server is lost or an update goes wrong, a backup is how you get back. Every customer account lives in one database, so one good backup protects all of them, and one missing backup puts all of them at risk.

The **Backups** page is where you decide how often copies are made, how many are kept, where they are sent, and where you test and restore them.

> Customers own their business data. It is encrypted in their own browser, so your backups only hold it in encrypted form and you cannot read it. A backup of the server cannot recover a customer's lost password or recovery key. Customers also keep their own backup files (see [Support and diagnostics](#/docs/support-and-diagnostics) for how that fits with yours).

## Backup setup

At the top of the page, **Backup setup** walks you through four steps. Each step unlocks the next, so nothing is turned on before what it depends on is ready. The server enforces the same order as the page, so a locked step cannot be skipped by other means.

1. **Passphrase.** Type a backup passphrase (at least 12 characters) twice and tick **I have saved this passphrase somewhere other than this server**, then press **Set the passphrase**. If it is lost, every encrypted copy can never be opened and nobody can recover it for you. Until this step is done, the **Offsite copies**, **Full-site backups** and **Destinations** tabs are locked, each with a plain reason, and the server refuses to turn any of them on. Frequent snapshots in the default folder need no passphrase and work from day one.
2. **Where do copies go.** Say whether copies should also leave this server (a NAS, cloud storage or both). Choosing **No, keep copies on this server only** is allowed, as a deliberate choice, but copies on the same disk are lost with the disk. Choosing **Yes** finishes only once a destination has passed **Test connection** and been switched on. A destination is always saved switched off; its switch stays disabled until a test passes on exactly those details, and changing the details means testing again.
3. **How much to keep.** Choose **Recommended**, **Minimal** or **Custom**. Each shows the estimated disk use worked out from your real database size. Recommended and Minimal write the thinning numbers for snapshots and offsite copies; Custom keeps your own.
4. **Prove it.** **Run the first backup and test restore** makes a full-site backup, opens it as a test restore and, if copies go off this server, sends one, fetches it back and tests that as well. Only then does the page say **Protected**.

Once a passphrase exists, three buttons sit right under step 1, always in view (the **Full-site backups** tab repeats **Check my passphrase** and **Change passphrase**):

- **Check my passphrase**: type it and the server says whether it matches the saved one. Nothing is changed and the passphrase is never shown or stored.
- **Change passphrase**: type the **Current passphrase**, then the **New passphrase** twice, and tick that you saved it elsewhere. A wrong current passphrase is refused. New copies use the new passphrase; copies made before the change still need the old one, so keep it.
- **Reset (forgotten)**: for a lost passphrase. It sets a new one without asking for the old one, and shows a warning you must accept (**I understand that older copies stay unreadable**). Every encrypted copy made with the old passphrase can then never be opened by anyone. Only copies made from now on use the new one.

Every check, change and reset is written to the audit trail (who and when, never the passphrase), and a wrong attempt is recorded as a warning. The page notes when the passphrase last changed.

The chip beside the title says **Protected** only when copies really leave this server and a test restore of such a copy has passed. In every other case it says **Not protected yet**, and the status line below says where you stand, for example **Local only (same disk)**. An install that predates this setup is no exception: if it sends nothing away, step 2 is open for you to answer.

A status line under the title always says where you stand: **Local only (same disk)**, **Copy off this server** (a copy is held away, not yet tested) or **Off-site and verified** (a copy is held away and a test restore of it passed).

Installs that already had a passphrase before this setup existed keep working and nothing they use is locked. Their steps 3 and 4 show **Not proven yet** (in amber, not **Done**) until the first backup and test restore has passed; choosing to keep copies on this server only shows just a plain note, since the status line above already says **Local only (same disk)**. Step 2 shows as done only when that install really sends copies to a tested destination; otherwise it stays open until you answer it.

If no mail is set up, the setup panel and the **Email Host administrators if a backup fails** switch warn that failure emails will not be sent. Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.
> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## The four kinds of backup

Think of the page as four layers. Each one answers a different "what if".

- **Frequent snapshots**: small copies of the database, taken every few minutes and kept on this server. They answer "someone changed something an hour ago and I want it back".
- **Offsite copies**: a snapshot that is compressed, encrypted and sent to another place. They answer "this server or its disk is gone".
- **Full-site backups**: one passphrase-protected file with the database and the server's encryption key. They answer "I must rebuild the whole thing on a new server".
- **Safety copies**: taken for you just before every restore, so a restore can itself be undone.

Each kind has its own tab, its own list of files and its own settings. A fifth tab, **Destinations**, holds the places that copies can be sent to. On a phone the five tabs sit in one row that you slide sideways; a soft fade shows there are more, and the selected tab is kept in view.

## The status strip

Above the tabs, four tiles and one line tell you at a glance whether things are fine.

- **Last backup**: how long ago the newest good backup finished, what kind it was, and whether it was verified (opened and checked after it was written).
- **Next run**: when the next scheduled backup is due and which kind it is. It says "Nothing scheduled" when everything is off.
- **Offsite copy**: "Yes" and where it went and when, or "No". It says "Nothing leaves this server yet" until you set a destination, and "Set up, none sent yet" until the first copy goes out.
- **Space used**: how much disk the backups take on this server, and how much is free.

If a kind of backup is failing, a red banner under the tiles says which one and why. The line underneath is the **cost line**, for example "At these settings you will hold about 2.4 GB here and 3.1 GB away from this server and upload about 180 MB a day." It turns red and adds a warning if the settings would not fit in the free disk. Read the section "How much will it use" below.

## Long jobs run in the background

Test restore, Restore, a full-site backup and Test a backup file can take a minute or more on a large site (a Test restore of a 3 GB snapshot takes about 50 seconds), longer than some reverse proxies wait for one request. So each of them starts as a **background job** on the server instead of one long request, and the page shows how it is going.

- **The sheet** that started the job shows the step it is on in words ("Fetching the copy from the destination", "Decrypting the file and checking every part", "Taking a safety copy of the live site") and a progress bar. For a full-site file the bar follows the bytes read or written, so it moves steadily.
- **The job strip** sits at the top of the Backups page, above the status tiles. While a job runs it shows its name, the step, the percentage and the bar, and the line "Only one backup job runs at a time". You can close the sheet, change tabs, reload the page or sign out and in again: the job keeps going on the server, and the strip finds it again.
- **When it finishes** the strip says "finished", "did not pass" (a Test restore that found a problem with the file) or "failed" (the job itself could not run, with the plain reason, for example a passphrase that is too short), with **View result** and **Dismiss**. **View result** opens the same checks and report you would have seen in the sheet. The result stays on the server until you dismiss it, the next job starts or the server restarts. A passing offsite or file test whose sheet was closed cannot be used to restore from; run the test again from its own button, because a restore always needs a test made in the window you restore from.
- **One job at a time.** If a job, a scheduled snapshot, an offsite copy or a full-site backup is already running, a second one is refused at once with "Another backup job is already running. Only one runs at a time." and the strip says what is running. Nothing is queued; start it again when the first has finished.
- **A restore** ends with the job reporting "restoring": the site restarts, everyone is signed out, and this console reloads by itself after a few seconds. If the server restarts while some other job is running, that job did not finish and nothing was changed by it; the strip says so.
- **Recorded.** Every job writes "Background job started" and "Background job finished" (or "FAILED") to the [Audit trail](#/docs/audit-trail), with who started it and how it ended, as well as the usual entries for the test or restore itself. A passphrase is never part of a job record or a log line.

## Where the files go

New backups are written to `/data/backup`, which is the `backup` folder inside the data folder you already mount into the container. You do not have to add anything for this to work.

Older versions used `/data/backups` (with an s). Those files are still listed, can be downloaded, restored and deleted exactly where they sit. Nothing is moved.

You can point the default at another folder: on the **Destinations** tab, press **Change folder** on the **This server** card, type a full path in **Folder path** and press **Save**. Leave it empty to go back to `/data/backup`. The server checks it can write there before it saves.

### The file lists

Each tab lists its files, newest first: the file name, when it was taken, what kind it is and its size. On tablets and computers the list scrolls inside a box of its own, with a line such as "Showing 25 of 140" and a **Load more** button that adds the next 25. On phones the page itself scrolls and the rows become cards. Each row has **Download**, and on local files also **Restore**, **Test restore** and **Delete**. Delete asks you to confirm and cannot be undone.

## Frequent snapshots

Open the **Frequent snapshots** tab. It is on by default.

- The switch next to the heading turns snapshots on or off.
- **Take a snapshot every** offers 5 minutes up to a day. The default is 15 minutes.
- A snapshot is taken with the database's own online backup, so nobody waits and sales keep being saved while it runs. Each one is checked after it is written.
- The default folder is private to the app: files are readable only by the app's own user.
- **Take a snapshot now** makes one straight away, for example before an update.

### How long snapshots are kept: thinning

Keeping a copy every 15 minutes forever would fill the disk. So copies are thinned as they get older. Four numbers control it:

- **Keep every copy for (hours)**: default 24. Every snapshot in the last day is kept.
- **Then one an hour for (hours)**: default 48. For the next two days only one per hour is kept.
- **Then one a day for (days)**: default 14.
- **Then one a week for (weeks)**: default 8.

With the defaults that is about 166 files and a fine-grained history for the last day, then a thinner one going back about ten weeks. The card says how many files your numbers will keep. Files you made by hand and safety copies are never thinned. Thinning is also applied to offsite copies at the destination.

### The nightly plain copy

The older nightly database backup now lives on this tab. **Also keep a plain copy every night** turns it on, **Nightly hour (UTC)** sets the hour (0 to 23, in UTC, not your local time) and **Keep nightly copies** sets how many to keep (1 to 365).

### Are snapshots protected?

The card **Are snapshots protected?** answers it honestly. A snapshot in this server's own folder is a plain database file, not locked with a passphrase.

- Passwords inside it are hashed, not readable.
- Two-factor secrets, the saved mail password and saved destination passwords are sealed with the server's own key, `secret.key`, which is not inside a snapshot.
- Customers' inventory, customers and sales are encrypted in the customers' browsers, so they are unreadable here too.
- Account names, email addresses and plan details are readable. Keep the folder private.

> A plain snapshot is good protection against mistakes and a damaged database. It is not meant to leave the server. Anything that leaves the default folder is encrypted first (see "Encryption" below).

## Offsite copies

Open the **Offsite copies** tab. It is off until you have a destination.

Every time it runs, the server takes a fresh snapshot, compresses it, encrypts it with your backup passphrase and uploads it. The file is named `myboxstock-offsite-` followed by the date and time and ends in `.db.mbsenc`.

- The switch turns offsite copies on or off.
- **Send a copy every** offers 15 minutes up to a day. The default is every hour.
- **Send them to** lists your turned-on destinations. Tick one or more. The built-in **This server** destination is not offered here, because the point is to leave the server.
- The same four thinning numbers apply, and the server tidies the destination for you.
- **Send one now** makes and uploads one straight away.

You cannot turn offsite copies on until you have chosen at least one destination, that destination is turned on, and a backup passphrase is saved.

The list **Copies held at the destinations** shows what is stored out there, with **Download**, **Restore**, **Test restore** and **Delete** on each row. **Restore** and **Test restore** fetch the copy and test it first; see "Restoring an offsite copy" below.

## Full-site backups

Open the **Full-site backups** tab. This is the backup you need to rebuild on a new server, because it also holds `secret.key`.

A full-site backup is one `.mbsbak` file with the database, the key and a note of when and on which version it was made, all encrypted with your passphrase. With the passphrase it brings everyone back as they were, including passwords, two-factor, plans and settings. Without the passphrase nobody can open it, including you.

### How a full-site file is written and opened

Full-site files are written and opened as a stream, a piece at a time: the database snapshot is read, compressed, encrypted in 1 MiB sealed chunks and written straight to the file, so the server's memory use stays flat however large the database is. Earlier versions loaded everything into memory, which failed on very large sites. Files made by earlier versions still open exactly as before.

When any part of the server opens a full-site file (the check after each backup, **Test restore**, **Restore**, **Test a backup file**, an offsite test or restore, and the `restore-bundle` command), nothing from the file is used until the whole file has passed its authentication. The contents go to a temporary scratch folder first. If the passphrase is wrong, or the file is cut short or changed anywhere, the scratch files are deleted and the server says "Wrong passphrase, or the backup file is damaged". Only after the last chunk checks out do the integrity check, the safety copy and the typed confirmation follow.

### Every field

- **The switch** turns scheduled full-site backups on or off. It cannot be on until a passphrase has been saved.
- **How often**: **Every night** or **Once a week**.
- **Weekly copy is taken on** (called **Backup runs on** when How often is Once a week): the weekday. With Every night, a second copy marked weekly is also kept on this day.
- **Hour (UTC)**: 0 to 23.
- **Keep daily copies**: 1 to 90, default 14. **Keep weekly copies**: 1 to 52, default 8.
- **Extra folder (optional)**: a full path outside the data folder, such as a mounted NAS, where each file is also copied.
- **Also send them to**: tick destinations. The file is already encrypted, so it is sent as it is.
- **Backup passphrase**: at least 12 characters, typed here only the first time. Once saved, the box is replaced by **Check my passphrase** and **Change passphrase**, because a change needs the current passphrase.
- **Email Host administrators if a backup fails**: on by default.
- **Save**, **Run one now** (saves your settings and makes a backup), and **Make one with a new passphrase** (a one-off backup with a passphrase you type, which is not stored; its button is **Create backup**).

Each backup is opened and checked after it is written. If a destination is set, the upload is checked too, and old files beyond your keep numbers are removed in each place.

### Choosing a passphrase

The same passphrase protects the full-site files and everything sent to a destination. It is kept sealed on this server so backups can run by themselves.

1. Choose at least 12 characters. Four or five unrelated words are easy to remember and hard to guess.
2. Write it down and keep it away from the server, for example in a password manager.
3. Do not change it casually. Older files still need the passphrase they were made with. If you do change it, use **Change passphrase** and keep the old one as long as you keep the old copies.
4. If it is forgotten, **Reset (forgotten)** gives you a new one for future copies, but older encrypted copies can never be opened.

> If you lose the server and the passphrase, your encrypted backups cannot be opened by anyone. There is no recovery.

## Safety copies

The **Safety copies** tab holds the copies the server takes just before each restore. They are plain database files in the backup folder, shown in the list as "Before a restore".

- **Remove safety copies older than (days)**: default 30.
- **Always keep the newest**: default 5 copies, however old.

If a restore turns out to be the wrong one, restore the safety copy to get back to where you were.

## Destinations

A destination is a place that copies can be sent. Open the **Destinations** tab. The first card, **This server**, is built in and is the default folder. Press **Add a destination** for the others.

Every destination has the same sheet. Give it a **Name**, choose the **Type**, fill in the fields for that type and leave **Use this destination** on. Press **Save**. Then press **Test connection** on its card.

> Saved passwords and keys are sealed on the server. The page only ever shows "saved". When you edit a destination, leave a password box empty to keep the saved one.

A destination other than the default folder cannot be turned on until a backup passphrase is set.

### Test connection

**Test connection** writes a small file to the destination, reads it back and deletes it. The result appears under the card in plain words. The card also remembers "Last test: worked" or "failed" with the time. A destination cannot be turned on until a test has passed on exactly its current details (Backup setup, step 2). Always test again after you change anything on the other side such as a password.

### The five types

- **Folder or mounted NAS**: one field, **Folder path**, a full path inside the container such as `/backups`.
- **Windows / NAS share (SMB)**: **Server**, **Share name**, **Folder on the share (optional)**, **User name**, **Domain (optional)** and **Password**.
- **S3-compatible storage**: **Endpoint**, **Region**, **Bucket**, **Folder prefix (optional)**, **Access key**, **Secret key** and **Use path-style addresses**.
- **SFTP (SSH) server**: **Server**, **Port**, **User name**, **Folder**, **Password** or a **Private key (optional)** with a **Key passphrase (optional)**.
- **WebDAV**: **WebDAV address**, **User name**, **Folder (optional)** and **Password**.

### Setting up a folder or a NAS mounted through Docker

This is the most dependable way to reach a NAS, because Docker does the mounting. The compose file has ready-made, commented examples.

1. Open `docker-compose.yml`. Under `volumes:` of the service, uncomment the line `- nas-backups:/backups`.
2. At the bottom, uncomment the block for your NAS: the NFS block, or the SMB/CIFS block. Change the address, share path, user name and password to yours.
3. Run `docker compose up -d` to re-create the container.
4. In the Host Console, open **Backups**, then **Destinations**, then **Add a destination**.
5. Choose **Folder or mounted NAS**, give it a name such as "Office NAS" and type `/backups` in **Folder path**.
6. Press **Save**, then **Test connection**.

If the test says the folder is not writable, check the share's permissions on the NAS for the user you mapped.

### Setting up a Windows or NAS share (SMB) directly

No Docker mounting is needed. The image includes the `smbclient` program (the package `samba-client`), and the server talks to the share itself.

1. On the NAS, create a share and a user that may write to it.
2. Add a destination of type **Windows / NAS share (SMB)**.
3. Enter **Server** (a name or address such as `nas.local`), **Share name**, optionally **Folder on the share (optional)** such as `backups/myboxstock`, **User name**, **Domain (optional)** and **Password**.
4. Save, then **Test connection**.

The password is written to a short-lived private file only while a transfer runs and is removed afterwards.

### Setting up S3-compatible storage

This covers Backblaze B2, Wasabi, Cloudflare R2, Amazon S3 and MinIO.

1. At your provider, create a bucket and an access key that may read, write and delete in it.
2. Add a destination of type **S3-compatible storage**.
3. **Endpoint**: the provider's address, such as `https://s3.us-west-004.backblazeb2.com`. Leave it empty for Amazon S3.
4. **Region**: for example `us-east-1`. **Bucket**: the bucket name. **Folder prefix (optional)**: a name such as `myboxstock` to keep your files together.
5. Enter the **Access key** and **Secret key**.
6. Turn on **Use path-style addresses** only for MinIO and a few others that need it.
7. Save, then **Test connection**.

### Setting up SFTP

1. Make sure the remote machine runs an SSH server and you have a user with a folder to write to.
2. Add a destination of type **SFTP (SSH) server**. Enter **Server**, **Port** (22 unless you changed it), **User name** and **Folder**.
3. Enter a **Password**, or paste a **Private key (optional)** (and a **Key passphrase (optional)** if the key has one).
4. Save, then press **Test connection**. On the first successful test the card records the server's identity and shows "Server identity pinned".
5. From then on, every connection must match that identity.

If the server is rebuilt on purpose, its identity changes and the test says the identity is not the one that was saved. Remove the destination and add it again. If you did not rebuild it, do not ignore the warning: someone may be pretending to be your server. Changing the server name or port forgets the saved identity, and the next successful test records the new one.

### Setting up WebDAV

1. Find your WebDAV address. For Nextcloud it looks like `https://cloud.example.com/remote.php/dav/files/me`.
2. Add a destination of type **WebDAV**. Enter the **WebDAV address**, **User name**, an optional **Folder (optional)** such as `backups`, and the **Password** (many services want an app password).
3. Save, then **Test connection**.

### Changing or removing a destination

Press **Edit** to change one, use its switch to turn it off and on, or **Delete** to remove it. Removing a destination stops new copies going there. Files already there are left in place.

## Encryption of everything that leaves the folder

Everything sent anywhere other than the default folder is compressed and encrypted first, with AES-256 in small chunks, using a key made from your backup passphrase. A changed or cut-short file is refused when you open it. Files end in `.mbsenc`. Full-site `.mbsbak` files are already encrypted, so they go as they are.

### Decrypting by hand

`BACKUP_PASSPHRASE='your passphrase' node server.mjs decrypt-backup <file.mbsenc or file.mbsbak> <output-file>`

An `.mbsenc` file becomes a plain `.db` file (or a `.sql` dump on PostgreSQL or MariaDB). For an `.mbsbak` file it writes just the database out of it. Run it inside the container, or anywhere you have the program and Node 22.

## Restoring

Restoring replaces the live database with the one in the backup. Everyone goes back to the moment it was taken. Anything entered since is lost. That is why customers' own backup files matter, and why you should only restore when you need to.

### Restoring from the page

1. Open **Backups** and the tab that holds the file.
2. Press **Restore** on its row. (Offsite copies have no Restore button.)
3. The sheet **Restore this backup?** names the file, shows the exact time it was taken in UTC and your own time, and how long ago that was. It repeats that anything entered after it will be lost, that a safety copy is taken first, and that the site restarts.
4. For a full-site `.mbsbak` file, type the **Backup passphrase**.
5. Type `RESTORE` in **Type RESTORE to confirm**. The Restore button stays off until you do.
6. Press **Restore**. The sheet shows the progress, then the console reloads after a few seconds. Everyone is signed out. You can close the sheet while it works; the job strip at the top of the page keeps showing it (see "Long jobs run in the background").

The restart relies on the container being set to restart itself. The standard compose file has `restart: unless-stopped`. Restoring from the page is offered for SQLite only. With PostgreSQL or MariaDB you load the dump yourself.

### What customers see afterwards

When the site starts again it posts an announcement banner to every customer, at the important (red) level: "The site was restored from a backup taken YYYY-MM-DD HH:MM UTC. Sales or changes made after that time may be missing. Please check your recent activity."

It stays until you clear it in [Settings](#/docs/settings) under Announcement banner, like any announcement. Restores made with the `restore-bundle` command on the server do not post it, so write your own notice if you want one.

Resellers can recover their own recent work if they have a newer backup file of their own: in their app, **Backup and restore**, then **Add what is missing**. That brings back records the restored site no longer has without overwriting anything.

### How a restore affects what resellers have

A restore puts the whole database back, including every account's state at that moment. You cannot restore one reseller on their own from a full-site or snapshot backup, and you cannot see inside their data. A reseller's own `.mbsbackup` file is the only way to bring back one account's work from a later moment than your backup. Resellers' own safety copies (kept for 7 days in their restore points) live inside the database too, so they go back with it.

### Test restore

A backup you have never opened is a hope, not a plan. **Test restore** on any local file opens it in a scratch copy, checks it and deletes the copy. It never touches live data.

1. Press **Test restore** on a row.
2. For a `.mbsbak` file, type the passphrase, or leave it empty to use the saved one.
3. Press **Run test**. It runs as a background job: the sheet shows the step and a progress bar, and you can close it and read the result from the job strip.
4. Read the result: a pass or fail message, and a line for each check such as "The database passes its integrity check" and "Accounts and users can be read" with the counts.

For a full-site file it also checks that the passphrase opens it and that the key is inside. If it cannot be opened and the passphrase was changed or reset after the copy was made, the failed check says "This copy was made with an earlier passphrase", so you know to type the old one. For a PostgreSQL or MariaDB dump it can only check that the file is complete. Offsite copies have their own test on the Offsite copies tab (below).

### Test a backup file

The **Test a backup file** card sits on the **Full-site backups** tab. Use it for a backup that is held somewhere else, for example a full-site `.mbsbak` downloaded to your laptop, or the file you would use to rebuild after losing this server. It works even when the Backup setup steps are not done, because a file from a lost server needs none of them. It accepts `.mbsbak` full-site backups, `.mbsenc` encrypted copies and `.db` snapshots.

1. Choose the file. **A file from this computer** with **Choose file** uploads it. The upload is streamed straight to a private holding folder on the server, never held in memory, with a progress bar. The card states the size limit (8 GiB unless the server sets `BACKUP_UPLOAD_MAX_BYTES`), and a larger file is refused with a plain message. **A file already in the server's backup folder** lists files placed in the backup folder by hand and lets you pick one with **Test this file**, with no upload at all.
2. In the sheet, type the file's passphrase (leave it empty to use the one saved on this server; a `.db` snapshot needs none) and press **Run test**.
3. The server opens the file in a scratch copy and shows the same Passed or Failed checks as **Test restore**: the file was read, the passphrase opens it and every part passed its authenticity check, the encryption key is inside, the database passes its integrity check, and its database and app version fit this server (a file from a newer version fails and asks you to update the server first).
4. A report follows. **The file** gives its kind, when it was taken, its size, the app version, the database version, **Readable by this server** and a fingerprint. **Compared with the live site** puts the file beside the live numbers (accounts, users, devices, customers and sales). It shows first, in red, any account that exists only on the live site, because a restore would lose it; then a plain line when the file is older than the latest activity on the live site; then the accounts only in the file and the accounts **whose record counts differ**. **Inside the file** shows **Accounts by plan**, **Accounts by status** and **Users by role**. **Every account in the file** is a table with each Reseller ID, plan, users, devices, customers, sales, other records and how it compares with the live site; use **Find a Reseller ID** to search it. Long lists show 25 at a time with **Load more**.
5. The report ends with a plain statement: the Host cannot open reseller records. The server holds only encrypted blobs and each blob's type, so it counts devices, customers and sales but cannot read them. Only a reseller's own **Test a backup file** (on their Backup page) proves that their data decrypts.
6. Closing the sheet deletes the uploaded file and the test result. An uploaded file is also removed an hour after it arrived, and anything left in the holding folder is removed when the server starts.

After a pass, the same sheet offers **Restore this file**, with the same safeguards as restoring an offsite copy: the button stays disabled, with the reason shown, until every check has passed and you have typed RESTORE; there is no override. The result is tied to that exact file (it is checked again before anything happens), a safety copy of the current database is taken first and kept on the **Safety copies** tab, the site then closes, restarts and signs everyone out, and resellers see the post-restore notice. Restoring from the console works on SQLite only.

The audit trail records **Backup file uploaded for testing**, **Backup file tested** (with the file name, size and result, never the passphrase) and **Backup restored**.

### Restoring an offsite copy

On the **Offsite copies** tab, **Restore** opens one sheet that tests the copy by itself, with no button to press. It never touches the live site until you restore.

1. The server fetches the copy from its destination and checks it is complete (size, checksum and authenticated decryption), that the backup passphrase opens it, that the database passes its integrity check in a scratch copy, that its database version and app version fit this server, how many accounts, users and records are inside and how that compares with the live site (older or newer, how many accounts differ). The scratch copy is then deleted.
2. The checks appear as a Passed or Failed list. A copy made with an earlier passphrase fails with a hint; type the old passphrase in the sheet and test again.
3. **Restore this copy** stays disabled, with the reason shown, until every check has passed and you have typed RESTORE. A failed or skipped check keeps it disabled, with no override. The result is valid only while that sheet is open and only for that exact file: if you reopen the sheet, or the file changes, it is tested again.
4. Before anything is replaced, a safety copy of the current database is taken and kept on the **Safety copies** tab, so the restore can be undone by restoring it.
5. Then the same safeguards as a local restore apply: the site closes while restoring, the console reloads, resellers see the post-restore notice, and the audit trail records **Backup test restore** and **Backup restored**.

**Test restore** on an offsite copy runs the same checks and offers no restore. Restoring from the console works on SQLite only; for a copy from a newer version of the app the test fails and asks you to update the server first. If the destination cannot be reached, the first check fails with the reason.

An offsite copy is a snapshot, so it does not hold `secret.key`. On the same server that is fine. On a new server with a different key, two-factor secrets, the saved mail password, saved destination passwords and the saved passphrase cannot be read: people set up two-factor again and you type the passwords again. To rebuild a lost server completely, use a full-site backup. See [Recovery and emergencies](#/docs/recovery-and-emergencies).

### Moving to a new server

For the whole order of work when a disk or server is lost, see [Disaster recovery](#/docs/disaster-recovery).

Make a full-site backup, keep the file and the passphrase. On the new, empty server run `BACKUP_PASSPHRASE='your passphrase' node server.mjs restore-bundle --file yourfile.mbsbak` before first start, then start it. The command refuses if the server already has data unless you add `--force`, which keeps the current database as a copy.

## Support tickets in your backups

Support tickets, their messages, the screenshots attached to them and the Host notes are stored in the database itself, as text. Screenshots are kept as encoded text inside it rather than as separate files, so there is nothing extra to copy: every snapshot, offsite copy, full-site backup and database dump carries them, and a restore brings them back. Because tickets are readable by the Host, so is that part of a backup, which is one more reason the backup passphrase matters. Purging closed tickets does not reach into older backups; they age out with the backup. See [Support tickets](#/docs/support-tickets).

## How much will it use

The cost line works it out from the real size of your database, assuming no compression, so the real figure is usually lower.

- Local space is: files held by frequent snapshots, plus full-site files, plus a few safety copies.
- Remote space is: files held at each destination.
- Upload per day is: how many copies are sent a day times their size, for every destination.

A rough example: a 50 MB database, snapshots every 15 minutes with the default thinning (about 166 files) is about 8 GB on this server. Offsite copies every hour with the same thinning go to the destination: also about 8 GB there, and 1.2 GB uploaded a day. If that is too much, make copies less often, shorten the thinning numbers, or send only full-site backups away.

Check the cost line after every change. If it turns red, the settings will not fit in the free space on this server.

## When a backup fails

A failed snapshot, offsite copy or full-site backup is logged, written to the [Audit trail](#/docs/audit-trail), shown as a red banner on this page, and raises the alert "The scheduled backup is failing" at once (see [Alerts](#/docs/alerts)). A failed upload to a destination counts the same way. The Owner is emailed once, and with **Email Host administrators if a backup fails** on, every administrator with an address is emailed for a full-site failure. Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The alert clears itself after the next good backup.

Common causes: a full disk, a NAS that is not mounted, a changed password, a passphrase that cannot be read because the server's key changed, or an SFTP identity that changed.

## What gets recorded

Every backup action is written to the [Audit trail](#/docs/audit-trail) with who did it, and never with a password: runs, restores, downloads, deletes, test restores, destinations saved, tested or removed, and settings saved. See [Troubleshooting and FAQ](#/docs/troubleshooting-faq) for help with specific messages.

Related: [Recovery and emergencies](#/docs/recovery-and-emergencies), [Running the server](#/docs/running-the-server) and [Updates](#/docs/updates).

## Backup health on Overview and Alerts

The Host [Overview](#/docs/overview) has a **Backups** card that reads from this page: the last snapshot, the last full-site backup, the last test restore and how old it is, whether a copy is held off this server, how each destination is doing (last send, last failure), the space left for backups, and the Protected state from Backup setup. Five backup alerts watch the same facts and email the Owner once if Email is set up: no recent full-site backup, a destination failing, no test restore in 30 days, the backup folder nearly full, and a failed background job. See [Alerts](#/docs/alerts).

Every Test restore you run here, from a snapshot, a full-site backup or an offsite copy, is remembered with its time, so the card can show its age. A failed test is shown but never hides the last one that passed. Run a Test restore at least every 30 days.
