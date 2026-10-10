---
title: Disaster recovery
summary: A runbook for the day the server is gone or broken: a dead disk, a lost server, a damaged database, a lost passphrase or key, or a bad update. What to have in hand, how to stand up a new container, test the backup first, restore, what customers keep and lose, what to check afterward, and a one-page checklist you can print.
keywords: demo accounts after a restore, disaster, disaster recovery, runbook, dead disk, disk failure, lost server, new server, rebuild, damaged database, corrupt, lost passphrase, lost key, secret.key, bad update, rollback, restore, test a backup file, checklist, print, printable, zimaos, custom install, docker compose, restore-bundle, what customers lose, after a restore
order: 21
covers: Disaster recovery, Dead disk, Lost server, Damaged database, Lost passphrase or key, Bad update, What to have in hand, Stand up a new container, Test a backup file, restore-bundle, Printable checklist, Print the checklist, What customers will and will not have lost, Checks afterward
---

## What this page is for

This is the page to open when something has gone badly wrong and you need a calm, ordered list. It does not replace the detail in [Recovery and emergencies](#/docs/recovery-and-emergencies), [Backups](#/docs/backups) and [Running the server](#/docs/running-the-server). It puts the order of work in one place and points to those pages for the steps.

The shape of every recovery is the same. Find out what broke. Get the files you need. Make sure the server can run (a new container if the old one is gone). **Test a backup file** before you trust it. Restore. Check the result. Tell your customers.

> Do this on a quiet day once, before you need it. Run **Test a backup file** on your newest full-site file and write down where the file and the passphrase live. A runbook is only useful if the pieces it names are really there.

## What to have in hand

Before anything else, gather these. If one is missing, say so out loud now rather than discovering it halfway through.

- **A backup file.** The best one is a full-site backup, a file ending in `.mbsbak`. It holds the whole database and the server secret key. Plain snapshots and offsite copies hold the database only. Find the newest file on the **Full-site backups** tab of **Backups**, on your destination (NAS or cloud storage), or on the laptop or drive where you keep a copy.
- **The backup passphrase.** It opens the file. It is the one saved on the Full-site backups tab, and it must be kept somewhere other than this server. Nobody can recover it for you.
- **The server secret key.** This is the `secret.key` file in the data folder, or the `APP_SECRET` value if you set one. It is inside every full-site file, so with a full-site file you do not need a separate copy. With only a snapshot or offsite copy, you need your own copy of the key, or you will re-enter some settings (see "Lost passphrase or key" below).
- **Your container settings.** The ZimaOS or compose settings the old server used: the port, `PUBLIC_URL`, `SECURE_COOKIES`, `TRUST_PROXY`, the data folder and any `APP_SECRET`. The site address people use must stay the same. Keep a copy of `zimaos/docker-compose.yml` as you edited it.
- **A way to reach the box.** A terminal on the server, or SSH, for the commands.

## Find which case you are in

### Dead disk

The disk that holds the data folder has failed, or the folder is unreadable or empty. The server may not start, or starts as a brand-new empty site and prints the FIRST RUN box. Do not let customers sign up on that empty site: stop it. Replace the disk, then follow "Stand up a new container" and restore a full-site file. Copies kept on the same disk went with it, which is why the **Backup setup** status line warns about **Local only (same disk)**.

### Lost server

The whole machine is gone: stolen, burned, or unreachable for good. Use new hardware or a new host, install Docker or ZimaOS, then follow "Stand up a new container". You need the backup file from outside the machine, which is what an offsite destination is for. See [Backups](#/docs/backups) for how to fetch a copy from a destination.

### Damaged database

The server starts but pages fail with database errors, or Backups reports that a database does not pass its integrity check. If the console still opens, take a snapshot of what exists (it is evidence), then use **Test restore** on your newest good snapshot and press **Restore**. If the console does not open, stop the server, move the damaged files aside rather than deleting them, and restore a full-site file with the command line.

### Lost passphrase or key

A lost backup passphrase blocks future restores of that file. Try **Check my passphrase** with your best guesses first. If it is truly lost, **Reset (forgotten)** sets a new passphrase so that new copies work, but every copy made with the old one can never be opened by anyone. Make a new full-site backup straight away.

A lost `secret.key` matters less than it sounds. It protects two-factor secrets and the saved email password. A full-site file holds it. If you restore only a snapshot on a server with a different key, people set up two-factor again and you type the email and destination passwords again. Customers' business data is not affected, because it is encrypted in their browsers with their own keys.

### Bad update

If the new version will not start, or is plainly broken, and the Last update card on [Updates](#/docs/updates) showed no database changes, put the previous version back and rebuild the container. Your data is untouched. If the update changed the database, restore the backup you took before updating. The standard advice stands: take a backup before every update.

## Stand up a new container

Use the same settings as the old one, so the address and the cookies behave the same.

1. **On ZimaOS**, open the App Store, choose **Custom Install**, then **Import**, and paste your saved copy of `zimaos/docker-compose.yml`. Check the image, the port (9080 outside, 8080 inside), `PUBLIC_URL`, `SECURE_COOKIES`, `TRUST_PROXY` and `restart: unless-stopped`, which is required. Point `/data` at a folder on storage you trust.
2. **With docker compose**, use the same `docker-compose.yml` and run `docker compose up -d`.
3. Open the container's logs. On a new empty data folder it prints a FIRST RUN box with a temporary admin password. You will not need it once the restore replaces the database, but note it in case the restore fails.
4. Put the backup file into the data folder's `backup` folder (`/DATA/AppData/myboxstock/data/backup` on the ZimaOS box, `/data/backup` inside the container).

See [Running the server](#/docs/running-the-server) for the full list of settings and the data folder.

## Test the file first

Never restore a file you have not opened. On a working console, go to **Backups**, open the **Full-site backups** tab and use **Test a backup file**: choose the file, type the passphrase and press **Run test**. A pass means the file is complete, the passphrase opens it, the key is inside and the database passes its integrity check. The report shows how many accounts and users are inside and how that compares with the live site.

If the new container is empty and you cannot do that yet, sign in with the temporary admin password, choose a new password, and use **Test a backup file** there. It works even when the Backup setup steps are not done. A file that fails is not used. Try the next oldest.

## Restore

With a working console, press **Restore this file** after a pass, type `RESTORE`, and wait for the job to finish and the console to reload. Without one, run the command line restore on the server:

`docker compose run --rm -e BACKUP_PASSPHRASE='your passphrase' myboxstock node server.mjs restore-bundle --file /data/backup/yourfile.mbsbak`

Add `--force` if it says the server already has data and you mean to replace it. Then start the server again. The details, and the case where you only have an offsite copy, are in [Recovery and emergencies](#/docs/recovery-and-emergencies).

## What customers will and will not have lost

A restore puts the whole site back to the moment of the backup. Customers keep:

- Their accounts, sign-ins, plans and settings as they were at that moment.
- All the business data that was in the backup: devices, customers, sales and receipts, including delivery and shipping details, saved addresses, returns and refunds, label and return settings, still encrypted, still readable only with their own password or recovery key. Restoring never exposes it to you.
- Their own backup files, which are separate and untouched.

Demo mode accounts are not in a full-site backup or an offsite copy (unless you turned off **Leave demo accounts out of backups**), so a restore from one never brings demo data back; if you need demo data on the restored site, build it again from [Demo mode](#/docs/demo-mode). A whole snapshot or safety copy does hold them.

They lose anything entered after the moment of the backup: sales, devices, new sign-ups, changed passwords and plan changes. Everyone is signed out. After a console restore, every customer sees a red notice saying the site was restored from a backup taken at a stated time. After a command line restore you write that notice yourself in [Settings](#/docs/settings).

Customers can recover their own recent work if they have a newer backup file: **Backup and restore**, then **Add what is missing**. Tell them so. You cannot restore one customer from a full-site file, and you cannot read their data to check it.

## Checks afterward

1. Open **Overview** and check the version, the account count and the user count look right.
2. Sign in with a test reseller account you control and open Home. Add a record and look at it.
3. Check that **Site address** and email still work. Send a test email from [Email](#/docs/email).
4. Go to **Backups**, run **Take a snapshot now**, then make a new full-site backup and test it. A restored site that is not backed up is a new risk.
5. Check [Alerts](#/docs/alerts), [Firewall](#/docs/firewall) (bans from the backup moment are back) and [Audit trail](#/docs/audit-trail) for the restore entries.
6. Tell your customers what happened and what time the data goes back to.

## Printable checklist

Print this section from the **Print the checklist** button. It fits one page.

- Stop and write down what broke and when. Do not delete anything.
- Gather: newest full-site file (.mbsbak), the backup passphrase, container settings, a terminal on the box.
- Fix the cause: new disk, new machine, or the previous version of the app.
- Stand up a container with the same settings: ZimaOS Custom Install or docker compose, restart policy on, data folder on real storage.
- Put the file in the backup folder. Run Test a backup file. Pass, or try the next oldest file.
- Restore (button, or restore-bundle with the passphrase). Start the server.
- Overview looks right. Test reseller sign-in works. Email works.
- Take a snapshot, make a full-site backup and test it.
- Tell customers the time their data goes back to. Remind them of Add what is missing.
- Note what went wrong and what to change.
