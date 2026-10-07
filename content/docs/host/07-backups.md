---
title: Backups
summary: How the Backups page protects the server: frequent snapshots, offsite copies, full-site backups and safety copies, where they go, how to set up each kind of destination, how to test and restore one, and how much space it all uses.
keywords: backup setup, guided setup, hard gate, locked, protected, restore offsite, tabs, backup, backups, restore, snapshot, offsite, off-site, full-site, safety copy, destination, thinning, retention, passphrase, encryption, decrypt-backup, mbsenc, mbsbak, restore-bundle, NAS, SMB, S3, Backblaze, Wasabi, Cloudflare R2, Amazon S3, MinIO, SFTP, WebDAV, NFS, Docker volume, test connection, test restore, cost, disk space, nightly, verify, disaster
order: 7
covers: nav:backups, Status strip, Last backup, Next run, Offsite copy, Space used, At these settings you will hold about, Frequent snapshots, Offsite copies, Full-site backups, Safety copies, Destinations, Take a snapshot now, Send one now, Run one now, Take a snapshot every, Send a copy every, Send them to, Also send them to, Keep every copy for (hours), Then one an hour for (hours), Then one a day for (days), Then one a week for (weeks), Also keep a plain copy every night, Nightly hour (UTC), Keep nightly copies, Are snapshots protected, Snapshots on this server, Copies held at the destinations, How often, Every night, Once a week, Weekly copy is taken on, Backup runs on, Hour (UTC), Keep daily copies, Keep weekly copies, Extra folder (optional), Backup passphrase, Email Host administrators if a backup fails, Make one with a new passphrase, Create backup, Remove safety copies older than (days), Always keep the newest, Add a destination, Edit destination, Change folder, Backup folder on this server, Folder path, Test connection, Use this destination, Name, Type, Folder or mounted NAS, Windows / NAS share (SMB), S3-compatible storage, SFTP (SSH) server, WebDAV, Server, Share name, Folder on the share (optional), User name, Domain (optional), Endpoint, Region, Bucket, Folder prefix (optional), Access key, Secret key, Use path-style addresses, Port, Folder, Password, Private key (optional), Key passphrase (optional), WebDAV address, Server identity pinned, Download, Restore, Test restore, Delete, Restore this backup, Type RESTORE to confirm, Load more, Showing, decrypt-backup, restore-bundle, .mbsenc, .mbsbak, /data/backup, /data/backups, thinning, safety copy, offsite copy, snapshot, destination, How much will it use, Backup setup, Local only (same disk), Copy off this server, Off-site and verified, Protected, Not protected yet, Prove it, Recommended, Minimal, Custom, Set the passphrase, I have saved this passphrase somewhere other than this server, Go to Destinations, Run the first backup and test restore, Make a full-site backup on a schedule, Restore this copy, Restore from an offsite copy, Test again
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

A status line under the title always says where you stand: **Local only (same disk)**, **Copy off this server** (a copy is held away, not yet tested) or **Off-site and verified** (a copy is held away and a test restore of it passed).

Installs that already had a passphrase before this setup existed show all four steps as done and nothing is locked.

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

### Every field

- **The switch** turns scheduled full-site backups on or off. It cannot be on until a passphrase has been saved.
- **How often**: **Every night** or **Once a week**.
- **Weekly copy is taken on** (called **Backup runs on** when How often is Once a week): the weekday. With Every night, a second copy marked weekly is also kept on this day.
- **Hour (UTC)**: 0 to 23.
- **Keep daily copies**: 1 to 90, default 14. **Keep weekly copies**: 1 to 52, default 8.
- **Extra folder (optional)**: a full path outside the data folder, such as a mounted NAS, where each file is also copied.
- **Also send them to**: tick destinations. The file is already encrypted, so it is sent as it is.
- **Backup passphrase**: at least 12 characters. Once saved the box says "Saved, leave blank to keep it".
- **Email Host administrators if a backup fails**: on by default.
- **Save**, **Run one now** (saves your settings and makes a backup), and **Make one with a new passphrase** (a one-off backup with a passphrase you type, which is not stored; its button is **Create backup**).

Each backup is opened and checked after it is written. If a destination is set, the upload is checked too, and old files beyond your keep numbers are removed in each place.

### Choosing a passphrase

The same passphrase protects the full-site files and everything sent to a destination. It is kept sealed on this server so backups can run by themselves.

1. Choose at least 12 characters. Four or five unrelated words are easy to remember and hard to guess.
2. Write it down and keep it away from the server, for example in a password manager.
3. Do not change it casually. Older files still need the passphrase they were made with.

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
6. Press **Restore**. The console reloads after a few seconds. Everyone is signed out.

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
3. Press **Run test**.
4. Read the result: a pass or fail message, and a line for each check such as "The database passes its integrity check" and "Accounts and users can be read" with the counts.

For a full-site file it also checks that the passphrase opens it and that the key is inside. For a PostgreSQL or MariaDB dump it can only check that the file is complete. Offsite copies have their own test on the Offsite copies tab (below).

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

Make a full-site backup, keep the file and the passphrase. On the new, empty server run `BACKUP_PASSPHRASE='your passphrase' node server.mjs restore-bundle --file yourfile.mbsbak` before first start, then start it. The command refuses if the server already has data unless you add `--force`, which keeps the current database as a copy.

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
