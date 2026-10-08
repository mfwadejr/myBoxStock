---
title: Recovery and emergencies
summary: Calm, step-by-step help for the bad days: locked out of the Host Console, lost password, lost two-factor, restoring from a backup, a full disk, and email that has stopped, with the exact commands and where to run them.
keywords: decrypt-backup, offsite copy, lost server, safety copy, bans survive restart, recovery, emergency, locked out, lockout, reset-host-admin, reset-server-options, HOST_ALLOW_ANY, lost password, forgot password, lost two-factor, lost authenticator, recovery code, owner, restore backup, restore-bundle, disk full, storage full, email stopped, docker exec, docker compose exec, not found, 404, secret.key, proxy
order: 16
covers: background job, job strip, Test a backup file, Restore this file, decrypt-backup, offsite copy, safety copy, Test restore, Restore, /data/backup, TRUST_PROXY fallback, restore announcement, reset-host-admin, reset-server-options, HOST_ALLOW_ANY, restore-bundle, BACKUP_PASSPHRASE, --force, docker exec, docker compose exec, locked out, allow-list, proxy setting, lost admin password, lost two-factor, Owner reset two-factor, restoring from backup, disk full, email stops, Reset (forgotten), Change passphrase, Check my passphrase, made with an earlier passphrase
---

## First, breathe

For a dead disk, a lost server, a damaged database, a lost passphrase or a bad update, start with the ordered runbook and printable checklist in [Disaster recovery](#/docs/disaster-recovery). This page holds the detailed steps it points to.

Almost every emergency on this server can be fixed, and the tools for it are already built in. This page walks through the common ones in the order you are likely to meet them.

Two reassurances: the commands below are run on the server itself, so if you can reach the machine you can get back in; and your customers keep working in their own accounts while you sort this out.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## Where to run the commands

The recovery commands all look like `node server.mjs <command>`. They are run **inside the container**, in the program's own folder, which is `/app`. If you use the standard compose setup, the service is called `myboxstock`. Pick whichever of these fits how you work:

- With compose, from the folder that holds your `docker-compose.yml`:
  `docker compose exec myboxstock node server.mjs reset-host-admin`
- With plain Docker, using the container's name (find it with `docker ps`):
  `docker exec -it <container-name> node server.mjs reset-host-admin`
- On ZimaOS, open a terminal on the box (over SSH, or the built-in terminal for the app's container) and use the same `docker exec` form.

Without Docker, simply run `node server.mjs reset-host-admin` in the project folder.

> Run the command, read what it prints, then follow its last line. Some commands end with "Restart the app", and they mean it.

## Locked out of the Host Console

"Locked out" can mean several different things. Work out which one you have first.

### You see a plain "Not Found" page at /host/

This usually means **Host Console access** is limited to a list of addresses and yours is not on it. Everyone outside the list gets a plain "Not Found" on purpose, so strangers cannot even tell the console exists. It can also happen right after you changed the proxy setting or the Cloudflare option so the site now sees a different address for you.

The fixes, easiest first:

1. **Connect from a listed address.** Go back to the office, the VPN or the network that is on the list in [Firewall](#/docs/firewall), and sign in from there.
2. **Use the emergency override `HOST_ALLOW_ANY`.** This container setting tells the server to ignore the Host Console address list for as long as it is on.
   1. Open your `docker-compose.yml` and, under `environment:`, add the line `HOST_ALLOW_ANY: "1"`.
   2. Re-create the container: `docker compose up -d`.
   3. Open the Host Console and sign in. The Firewall screen shows a blue notice saying the emergency override is on.
   4. Fix the list: add your current address ("Add my address") or correct the proxy setting in [Settings](#/docs/settings).
   5. **Remove** the `HOST_ALLOW_ANY` line and run `docker compose up -d` again so the list is enforced once more.
3. **Clear the saved server options** if the proxy setting is the cause (see the next section).

Things to know about `HOST_ALLOW_ANY`: it only lifts the Host Console list. It does not remove a "Block this address" rule, a temporary ban or the rate limits. If you are being blocked for those reasons, see "Banned or rate-limited" below. Leaving it on permanently means anyone on the internet can reach your sign-in page, so treat it as a one-time bridge.

### The proxy setting is wrong

If the Host Console list is on and the site sees your address as something internal (for example `172.18.0.1`), or the wrong address altogether, it is usually because **Reverse proxy in front of the site** or **Site is behind Cloudflare** in Settings does not match your real setup. The built-in lockout guard normally prevents you saving a change like that, but a change made in the container or after your network changed can still do it.

Run:

`docker compose exec myboxstock node server.mjs reset-server-options`

It prints: "Saved server options (proxy count, secure cookies, log detail, ...) cleared. The container settings are used again. Restart the app." So restart it: `docker compose restart myboxstock`.

What this does: it forgets every option saved on the **Server options** card of Settings (secure cookies, mail servers on private networks, Cloudflare, proxy count, log detail and log retention). The values set in the container's environment apply again. Nothing else is touched: not your accounts, not the firewall list, not your administrators.

After that, check the container's own `TRUST_PROXY` setting (for example `TRUST_PROXY: "1"` behind one reverse proxy) and set it to match your setup. The container variable is the fallback: once the saved options are cleared, it is what the site uses. A value like `loopback` is fine too, and shows in Settings as "Custom (set by the container: loopback)". Then you can sign in and re-apply sensible options from Settings.

### Secure cookies is on but you are using http

If **Secure cookies** is on and you reach the console over plain `http://`, the browser throws the sign-in cookie away and you can never stay signed in. Use the real `https://` address. If there is no https address and a saved Secure cookies option is the cause, run `reset-server-options` as above. Also check that `SECURE_COOKIES` is not set in the container.

### Locked or banned after too many tries

These protections clear themselves, but a restart does not clear them:

- A username is locked for 15 minutes after six wrong passwords or codes in a row.
- An address that tries to sign in more than 10 times in five minutes gets "too many attempts" until the window passes.
- Repeated violations lead to a temporary ban (15 minutes by default).

Lockouts and bans are saved in the database and still apply after a restart or an update. **Restarting the container no longer clears them.** The request counters (the 10 attempts in five minutes) are the only part that starts again from zero after a restart.

What to do:

1. **Wait.** A lockout and the default ban both end after 15 minutes.
2. **Lift a ban.** If an address is banned and you can sign in from another address (for example mobile data), open [Firewall](#/docs/firewall) and press **Lift** next to it.
3. **A "Block this address" rule** is not a ban and never ends by itself. Connect from a different network, sign in, and remove the rule in Firewall.
4. If you are the Owner and cannot sign in at all, `reset-host-admin` gives you a new temporary password, but an active lockout on the name still has to run out. Wait up to 15 minutes, then sign in.

## Lost admin password

If the Owner administrator forgets the password and cannot sign in, run:

`docker compose exec myboxstock node server.mjs reset-host-admin`

It prints something like:

- "Host admin reset. Username: admin"
- "Temporary password: ..." (a new random one)
- "Two-factor was cleared; you must change the password at next sign-in."

What it really does:

1. It picks the **first administrator ever created**, the Owner, and replaces that password with a temporary one.
2. It turns that administrator's two-factor off and removes the recovery codes.
3. It ends every open Host Console session.
4. It makes the temporary password one the person must replace the moment they sign in.

The message always says `Username: admin`. If your Owner's username is not `admin`, the reset still applied to the Owner, so sign in with the Owner's real username.

Steps:

1. Run the command and copy the temporary password. It is shown once and is not saved in the log.
2. Open `/host/`, sign in, and choose a new password when asked. At least 10 characters with letters and numbers.
3. Go to [Security](#/docs/security) and turn two-factor back on straight away.

Other administrators are not affected. If a helper administrator forgets their password, the Owner can set a temporary one for them from Security (Edit, then Set temporary password). The command line is the Owner's way back in, so keep access to the server itself safe.

The reset is recorded in the log with the actor shown as `cli`, so it appears in the [Audit trail](#/docs/audit-trail).

If you simply missed the first-run password, it was printed once in the container's output. `docker compose logs myboxstock` shows it if the logs are still there. Otherwise run `reset-host-admin`.

## Lost two-factor

### The Owner lost their authenticator

You have two ways in:

- A **recovery code**. When you set up two-factor you were given recovery codes. At the sign-in screen's code box you can enter a recovery code instead of the six-digit number. Each one works once.
- If you have no codes left, run `reset-host-admin` as above. It clears two-factor for the Owner. The Owner is allowed to use the console without two-factor so that nobody can be locked out of their own server, but turn it on again right away.

### A helper administrator lost their authenticator

The Owner handles this, with no command line needed:

1. Open **Security** and choose Edit next to that person.
2. Under Support actions, press **Reset two-factor** and type their username to confirm.
3. They are signed out everywhere and, if they have an email address saved, told by email.
4. At their next sign-in they set up two-factor again. Helper administrators cannot use the console until two-factor is on.

If it is the Owner's two-factor and no Owner is available, there is no one in the console who can reset it, which is why `reset-host-admin` exists.

## Restoring from a backup

Use a restore when data was damaged or lost, or after a failed update that changed the database. Read [Backups](#/docs/backups) first for how backups are made. A restore puts the **whole site** back to the moment of the backup. Everyone is signed out, and anything entered since is lost. You cannot restore one reseller on their own.

Pick the situation that fits.

### The server is working and you can sign in

1. Open **Backups** and find the file. Local files on the **Frequent snapshots**, **Full-site backups** and **Safety copies** tabs have a **Restore** button. If you are unsure, press **Test restore** on the row first: it opens the file in a scratch copy, checks it and deletes the copy.
2. Press **Restore**. The sheet names the file, shows when it was taken in UTC and your own time, and how long ago. Read it. Anything entered after that time will be lost.
3. For a full-site `.mbsbak` file, type its **Backup passphrase**. Type `RESTORE` to confirm and press **Restore**. The restore runs as a background job with a progress bar, also shown in the job strip at the top of the Backups page; only one backup job runs at a time, so wait for any other to finish first.
4. A safety copy of the site as it is now is taken first (it appears on the **Safety copies** tab). Then the site restarts, and the console reloads in a few seconds.
5. After the restart the site posts a red announcement to every customer: "The site was restored from a backup taken ... UTC. Sales or changes made after that time may be missing. Please check your recent activity." Clear it in [Settings](#/docs/settings) when it is no longer needed.
6. Tell your resellers. Those with a newer backup file of their own can recover recent work with **Add what is missing** on their Backup and restore page (see [Support and diagnostics](#/docs/support-and-diagnostics)).

This relies on the container being set to restart itself (the standard compose file has `restart: unless-stopped`). Without it, the server would stop and stay stopped. Restoring from the page is offered for SQLite only. With PostgreSQL or MariaDB you load the dump yourself with the database's own tools.

If it was the wrong backup, restore the safety copy from the **Safety copies** tab. It brings you back to where you were before.

### You only have an offsite copy

The easiest way is the **Restore** button on the copy in the **Offsite copies** tab. It tests the copy first (complete, passphrase opens it, integrity check, version fits), keeps Restore disabled until every check passes, takes a safety copy and then restores. See [Backups](#/docs/backups). That needs a working console. If you cannot sign in, or the copy is in a place the server cannot reach, do it by hand:

1. Download it from the **Offsite copies** tab, or fetch it from the destination yourself.
2. Decrypt it on a machine that has the program. Run `BACKUP_PASSPHRASE='your passphrase' node server.mjs decrypt-backup myboxstock-offsite-....db.mbsenc restored.db`. The passphrase is the one saved on the Full-site backups tab. A wrong one is refused and nothing is written.
3. Put `restored.db` into the backup folder, `/data/backup`. It then shows in **Frequent snapshots**. Press **Test restore**, then **Restore**.

An offsite copy is a snapshot, so it does not contain `secret.key`. Restoring it on the same server is fine. On a new server with a different key, two-factor secrets, the saved mail password, saved destination passwords and the saved passphrase cannot be read. People set up two-factor again and you re-enter the passwords.

### You have a backup file somewhere else

If the file is on your laptop or a drive, and the console still works, use **Test a backup file** on the **Full-site backups** tab of **Backups**. Choose the file (it is uploaded as a stream, or pick one you have copied into the server's backup folder), type its passphrase and press **Run test**. You see whether it opens, what is inside (accounts by plan and status, users by role, records per account) and how it compares with the live site, with any account that exists only on the live site shown first. After a pass, **Restore this file** takes a safety copy, asks you to type RESTORE and restores it. The report cannot show reseller records, because the Host cannot open them. See [Backups](#/docs/backups).

### The server is lost, new, empty, or you cannot sign in

Use the command line and a full-site backup (`.mbsbak`), which includes the key. You need the file and its passphrase. If the file is only on a destination, download it first, or mount the NAS where you can reach it.

1. Put the file in the data folder's `backup` subfolder (`./data/backup/` on the host is `/data/backup/` in the container). Files in the older `backups` folder also still work.
2. If you are replacing a working server, stop it first: `docker compose stop`.
3. Run, with your own file name and passphrase:

   `docker compose run --rm -e BACKUP_PASSPHRASE='your passphrase' myboxstock node server.mjs restore-bundle --file /data/backup/myboxstock-fullsite-2026-10-05-03-00-00.mbsbak`

4. If it says "This server already has data. Use --force to replace it", add `--force` at the end. The current database is kept next to the new one as a copy.
5. Start the server: `docker compose up -d`. Everyone can sign in as before.

On success it says "Restored a sqlite backup made ... Start the server". For a PostgreSQL or MariaDB backup it places `restored-dump.sql` in the data folder for you to load with `psql` or `mysql`.

If you have forgotten the backup passphrase, first try **Check my passphrase** (Backups, Backup setup) with your best guesses. If it is truly lost, **Reset (forgotten)** sets a new passphrase so future backups work, but every encrypted copy made with the old one can never be opened by anyone. A Test restore of such a copy says "made with an earlier passphrase" instead of leaving you to guess.

A wrong passphrase or a damaged file gives "Wrong passphrase, or the backup file is damaged", and nothing is changed.

> The `restore-bundle` command does not post the "site was restored" announcement to customers. Write your own notice in Settings.

### A lost server with only snapshots

If you have only plain snapshots or offsite copies and the server's `secret.key` (or your `APP_SECRET` value) is gone, you can still restore the database, but two-factor secrets, the saved mail password and saved destination passwords are lost. A copy of `secret.key` kept safely away from the server avoids this. Full-site backups hold the key, so they are the better choice for rebuilding.

### Looking inside a full-site file without restoring it

`decrypt-backup` also opens a full-site `.mbsbak` file. It writes only the database out of it, not the key. Use it only to look at the data. To rebuild a server use `restore-bundle`. Both commands stream the file, so a very large backup does not need a large amount of memory, and nothing is written until the whole file has passed its authentication.

### If the encryption key is lost

The key (the `secret.key` file in the data folder, or the `APP_SECRET` value if you set one) protects two-factor secrets and the saved email password. Without it, nobody's two-factor codes can be checked and the mail password cannot be read. Restore a full-site backup (it contains the key) or put the original key back. If you can only recover the database, re-enter the SMTP password on the Email screen and have people set up two-factor again.

### After any restore

1. Open Overview and check the accounts and version look right.
2. Check the Backups page: run **Take a snapshot now** so you have a fresh copy of the restored state.
3. Clear the restore announcement when the time is right.
4. Remember that other things are put back too, including bans and lockouts that were in the database at that moment.

## Disk full

The Alerts screen raises "Storage is almost full" at 90 percent, and the Overview meters turn amber then red. At 100 percent the database cannot write and backups fail.

1. Find what is big. In the data folder, `du -sh data/*` shows it. The usual culprits are the `backup` folder (and the older `backups` folder if you have one) and the `logs` folder.
2. **Backups**: download the ones you want to keep to another computer, then delete old ones from the Backups page. Keep fewer copies or take them less often (the thinning numbers and the interval on each tab), and send long-term copies to a destination. The cost line on the Backups page shows how much your settings will use.
3. **Logs**: shorten **Keep the activity log (days)** in [Settings](#/docs/settings), and lower `LOG_MAX_MB` or `LOG_FILES` if the log files are the problem. The files rotate by size, so they are bounded.
4. **More room**: enlarge the disk or move the data folder to a bigger drive, then point the volume at it.
5. Do not delete `myboxstock.db`, the matching `-wal` and `-shm` files, or `secret.key`.

If the server cannot start because the disk is totally full, free space from outside the data folder (for example old unused Docker images with `docker image prune`) so it can start, then continue as above.

A backup of the SQLite database needs roughly as much free space as the database itself.

## If email stops

Customers will first notice that confirmation and password-reset emails never arrive. You will notice an alert, "Email is not being delivered".

1. Open **Email** and the Health tab. It shows the last successful send, failures in the last 24 hours and seven days, and how many messages are waiting. A message that fails five times is given up on and the failure reason is shown.
2. Open the Delivery tab. Check that **Send email** is on, the From address is set, and the method is right. Direct delivery is often blocked by internet providers, so an **SMTP relay** is the dependable choice.
3. Press **Send test email** and read the result.
4. If the SMTP password changed, or the encryption key was lost, enter the password again and Save.
5. When fixed, press **Resend all failed** on the Recent messages list.
6. Check [Settings](#/docs/settings): a missing or wrong **Site address** gives emails with broken links. Check the mail area in [Logs](#/docs/logs) for the exact reason.

While email is down, you can still help customers: in Accounts, set a temporary password or send a reset link for a user. See [Accounts](#/docs/accounts) and [Email](#/docs/email).

## When the server will not start

1. Read the last lines of its output: `docker compose logs --tail 100 myboxstock`.
2. Check the health address: `docker compose ps` shows whether the container is healthy; the app answers at `/healthz`.
3. The usual causes are a full disk, a missing or unreachable database (when using PostgreSQL or MariaDB), or a wrong `DATABASE_URL`.
4. If a recent update caused it, see [Updates](#/docs/updates) for rolling back.

More on running and protecting the server is in [Running the server](#/docs/running-the-server) and [Troubleshooting and FAQ](#/docs/troubleshooting-faq).
