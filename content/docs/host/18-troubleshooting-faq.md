---
title: Troubleshooting and FAQ
summary: Problems you are likely to meet as the Host, grouped by symptom, with the cause, the fix and where to read more. Ends with a general FAQ.
keywords: test connection, sftp identity, restore notice, lockouts persist, camera, scanning, diagnostics, destination, troubleshooting, problem, error, not found, locked out, blocked, proxy, email not arriving, resend, confirmation link, backup failed, restore, trial, read-only, two-factor, recovery, FAQ, help
order: 18
covers: Not Found, host_console.blocked, Reverse proxy in front of the site, Site is behind Cloudflare, Resend, Resend all failed, Site address, Health tab, Send a test, Run one now, Restore, Extend trial, Change plan, Set up two-factor, reset-host-admin, reset-server-options, HOST_ALLOW_ANY, Mark email as confirmed, Email a password reset link, Reset two-factor authentication, Recovery key, Test connection, Take a snapshot now, Send one now, Lift, Copy diagnostics, Try again, decrypt-backup, SFTP identity, Server identity pinned, restore notice, Backup is failing
---

## How to use this page

Find the symptom that matches what you are seeing, read the **Cause**, then follow the **Fix**. Most problems in the Host Console come down to a handful of things: the address list, the proxy count, the Site address, or email delivery.

One rule applies to everything below. You run the server, but your customers own their business data. You cannot see it, and you cannot open it for them. Support tools in [Accounts](#/docs/accounts) deal with sign-in and security, never with the contents of an account.

## I get "Not Found" at /host/

**Cause.** The Host Console answers with a plain "Not Found" page, not a sign-in page, in two situations:

- **Limit to listed addresses** is turned on in [Firewall](#/docs/firewall), and the address you are visiting from is not on the list.
- The address list is on, and the server is seeing the wrong address for you (see "The proxy count is wrong" below), so your real address does not match the list.

Reseller accounts and the sign-up page are not affected. Only the Host Console is hidden.

**Fix.**

1. Try from a place whose address is on the list, such as the office or your home connection.
2. If you cannot get back in, restart the app once with the setting `HOST_ALLOW_ANY=1` in the container. That makes the server ignore the address list for that run. Sign in, correct the list under Firewall, then remove `HOST_ALLOW_ANY` and restart again.
3. If the cause is a saved server option (for example a wrong proxy count), run `node server.mjs reset-server-options` on the server and restart. See [Recovery and emergencies](#/docs/recovery-and-emergencies).

> Before turning on the address list, use **Add my address** on the Firewall page so you do not lock yourself out. The page also warns you when your address looks like an internal one.

## The log says requests were blocked from addresses I do not know

**Cause.** Look in [Logs](#/docs/logs) for the event `host_console.blocked` (area security). It means someone outside your address list asked for a Host Console page and was refused. That is the list doing its job. Strangers on the internet probe common paths such as /host/ all day, so a few of these are normal.

Other related entries are rate-limit and ban events. These appear when one address sends too many requests or too many sign-in attempts.

**Fix.**

- If the addresses are strangers, do nothing. They saw only "Not Found".
- If one of them is you or a colleague, add that address on the Firewall page.
- If a stranger keeps coming back and is a nuisance, add a **Block this address** rule for it. A CIDR range blocks a whole neighbourhood of addresses at once. Blocking applies to the whole site, not only the Host Console.
- The Logs page has quick filters named **Failed sign-ins** and **Lockouts and bans** that show exactly where trouble is coming from.

If you see many failed sign-ins in one hour, an [alert](#/docs/alerts) called "Many failed sign-ins" appears and the Owner is emailed once.

## Everyone appears to come from the same address, or my address looks internal

**Cause.** The proxy count is wrong. The site learns each visitor's real address from the proxy in front of it. If the setting does not match your set-up, the server sees the proxy's own address (often something starting with 10., 172.16 to 172.31 or 192.168.) instead of the visitor's. Rate limits, bans, the address list and sign-in history then all act on the wrong address, and one noisy visitor can get everybody limited.

**Fix.** Open [Settings](#/docs/settings), Server options.

- Visitors connect directly to the server: set **Reverse proxy in front of the site** to "None (connect directly)".
- One proxy sits in front (for example nginx or a hosting platform's proxy): choose 1 proxy. If there is a proxy behind another proxy, choose 2 or 3.
- The site is reached through Cloudflare, including a Cloudflare tunnel: turn on **Site is behind Cloudflare**. The real visitor address is then taken from Cloudflare, and it is only believed when the request really comes from a Cloudflare address, so it cannot be faked.

Then open the Firewall page. Under **Your address right now** it shows the address the server sees for you and whether it came from Cloudflare or from the proxy count. When that matches your real public address, the setting is right.

If the wrong setting has locked you out, use `node server.mjs reset-server-options` as described in [Recovery and emergencies](#/docs/recovery-and-emergencies).

## Too many people are being rate limited

**Cause.** Either the limits are too tight for your traffic, or (more often) every visitor shares one address because of the proxy problem above.

**Fix.** Fix the proxy count first. If it is correct, raise **Requests per IP** or **Sign-in attempts per IP** on the Firewall page. The defaults are 300 requests per 60 seconds and 10 sign-in attempts per 300 seconds, with a 15 minute ban after 5 violations. A trusted address, such as an office with many staff behind one connection, can be added with **Skip rate limits**. Banned addresses are listed on the page, and **Lift** removes a ban straight away. Bans survive a restart, so restarting the server does not clear them.

## Email is not arriving

Open [Email](#/docs/email) and start on the **Health** tab. It tells you whether sending is on, the last successful send, failures in the last 24 hours and 7 days, and how many messages are waiting.

**Cause, and fix, by what you see.**

- **Sending is turned off.** Turn on **Send email** on the Delivery tab.
- **Direct to recipient** is chosen and mail is refused or lands in spam. Direct delivery works best from a server with a fixed IP address, reverse DNS and SPF and DKIM set up for your domain. Many home connections are blocked outright. Switch to an **SMTP relay** (a mail service you trust) and fill in the host, port, username and password.
- **The relay refuses the login.** Check the username and password. Some providers need an app password rather than the normal one.
- **Wrong port or TLS setting.** Use port 587 and leave **Use TLS from the start** off, or port 465 with it on. The port is fixed at 465 while that box is ticked.
- **The HELO name is wrong.** Some receiving servers reject mail when the name announced by your server does not look like a real host name. Set **Server name announced when sending (HELO)** to a proper name that resolves to your server.
- **Mail arrives but lands in spam.** Open the Health tab and look at the **Sender checks** card. It looks up SPF, DMARC and DKIM for your From address's domain and tells you what is missing. DKIM "not found" only matters if your relay does not sign your mail; type your relay's selector in the box and press **Check again**.
- **Nothing seems wrong but nothing arrives.** Use **Send a test** (save first). The result appears under the button in plain words.

Messages are tried up to five times. After the fifth failure the message is marked **failed** and the receiving server's reason is kept with it. When you have fixed the cause, use **Resend** on one message or **Resend all failed** under Recent messages.

If email keeps failing, an [alert](#/docs/alerts) called "Email is not being delivered" is raised, and the Owner is emailed. Note the Owner only gets that email if email works at all, so check the Health tab yourself now and then.

## The Resend button is greyed out, or there is nothing to resend

**Cause.** **Resend** appears only next to messages whose status is **failed**. Messages that are still queued are being retried automatically, and messages that were sent do not need resending. **Resend all failed** is hidden when no message has failed.

**Fix.** Wait for the queue to settle, or look at the status column in Recent messages. If a message shows "queued" for a long time, the Health tab shows how old the oldest waiting message is. A queue that is not moving usually means a delivery problem from the list above. If it is truly gone from the list, ask the customer to start the action again (for example "forgot password").

## Confirmation and reset links point to the wrong address

**Cause.** Confirmation, password reset and welcome emails build their links from the **Site address** in [Settings](#/docs/settings). If it is not set, the server falls back to the container setting `PUBLIC_URL`. If neither is right (for example it says localhost, or http instead of https), the links in every email are wrong. The Overview page warns you: "Email links will not work", with a link to **Set the site address**.

**Fix.**

1. Open Settings and type the address people use to reach the site from anywhere, with https, for example `https://app.example.com`.
2. Press **Save**. If you are on the real site already, the button that offers your current address (it reads "Use" followed by the address) fills it in for you.
3. Send yourself a test sign-up or a password reset to confirm the link now opens the right page.

Links already in emails that were sent before the change keep the old address. For a customer stuck with an old link, open the person in [Accounts](#/docs/accounts) and choose **Resend the confirmation email** or **Email a password reset link**, which makes a fresh one.

## A customer did not receive their confirmation email

**Fix, in order.**

1. Check the Email Health tab and the Recent messages list for that address.
2. Ask them to look in their spam folder.
3. In Accounts, open the account, pick the person under People, and choose **Resend the confirmation email**.
4. If you have checked the person's identity another way (a phone call, for instance), choose **Mark email as confirmed**. You are asked for a reason, which is saved in the log with your name. Use it sparingly.

## A backup is failing

**Cause.** The status strip on the Backups page and the red alert "The scheduled backup is failing" name which kind failed (snapshot, offsite copy or full-site backup) and the reason. Common reasons:

- The destination is not reachable, or its password or key changed. Press **Test connection** on its card to see the exact reason.
- A NAS that is mounted through Docker is not mounted, or is not writable.
- The server's own disk is full. The "Storage is almost full" alert appears at 90 percent. The cost line on the Backups page turns red when your settings will not fit.
- No backup passphrase is saved, so full-site backups and anything sent to a destination cannot run. The error says to set it on the Full-site backups tab.
- The saved passphrase or a saved destination password "could not be read": the server's encryption key changed. Enter them again.
- The database is on PostgreSQL or MariaDB and the dump tools (`pg_dump` or `mysqldump`) are not installed in the container.
- Another backup was running. Only one runs at a time; try again in a minute.

**Fix.** Correct the cause, then use **Take a snapshot now**, **Send one now** or **Run one now** on the matching tab and watch the strip. Every backup is opened and checked after it is written, so "verified" means it can really be restored. A failed upload is logged, appears in the [Audit trail](#/docs/audit-trail) and raises the alert at once. See [Backups](#/docs/backups).

Treat a failing backup as urgent. Until one succeeds, you have no recent safety net.

## Test connection fails

Press **Test connection** on the destination's card. The message under it says why. What the common ones mean:

- **The folder is not writable or does not exist.** For a NAS mounted through Docker, check the volume is in `docker-compose.yml`, the container was re-created, and the path is `/backups` (or whatever you mounted). Check the share's permissions for the mapped user.
- **The smbclient program is not installed.** The Docker image includes it. If you run without Docker, install `smbclient`. Otherwise check the server name, share name, user name, domain and password. A message about a logon failure means the user name or password is wrong.
- **S3:** a wrong access key or secret key, a bucket that does not exist, a wrong region, or a wrong endpoint. The endpoint must start with `https://`. MinIO usually needs **Use path-style addresses**. Make sure the key may list, write and delete in the bucket.
- **SFTP:** wrong server, port, user name, password or key. See the next entry for identity messages.
- **WebDAV:** the address must start with `https://` (or `http://`). Many services want an app password, not the normal one. Check the folder exists.
- **"Set the backup passphrase ... before turning on a destination."** You cannot turn on any destination except the default folder until a passphrase is saved on the Full-site backups tab.
- **"The saved password could not be read."** The encryption key changed. Type the password again and save.

## SFTP says the server's identity changed

**Cause.** On the first successful **Test connection**, the page records the SFTP server's identity (its host key fingerprint) and shows it as "Server identity pinned". Every later connection must match it. A mismatch means the server's identity is not the one saved.

**Fix.**

1. Ask: was the SFTP server rebuilt or reinstalled on purpose? If yes, remove the destination and add it again, then press **Test connection** to record the new identity.
2. If you did not change it, do not carry on. Someone may be pretending to be your server, so check with whoever runs it.
3. Changing the server name or port on the destination forgets the saved identity, and the next successful test records the new one.

## Customers see a notice that the site was restored

**Cause.** After a restore from the Backups page, the site posts an important (red) announcement to every customer: "The site was restored from a backup taken YYYY-MM-DD HH:MM UTC. Sales or changes made after that time may be missing. Please check your recent activity."

**Fix.** Nothing is wrong. Clear the announcement in [Settings](#/docs/settings) (turn **Show the banner** off and press **Save announcement**) when resellers have had time to check. Resellers who made their own backup file after that time can recover recent work with **Add what is missing**. See [Support and diagnostics](#/docs/support-and-diagnostics). A restore made with the `restore-bundle` command does not post the notice.

## I need to restore a backup

1. Open **Backups** and the tab with the file. If you are not sure it is good, press **Test restore** on its row first.
2. Press **Restore** and read the sheet: which file, when it was taken, how long ago, and that anything entered since will be lost. A safety copy is taken first and the site restarts.
3. For a full-site `.mbsbak` file, type the passphrase. Type `RESTORE` to confirm.
4. Wait a few seconds for the console to reload. Everyone is signed out, and customers see the restore notice.

An **offsite copy** (`.mbsenc`) has no Restore button. Download it, decrypt it with `node server.mjs decrypt-backup`, place the `.db` file in `/data/backup`, then restore it from the Frequent snapshots tab. A **full-site backup** can be restored from the page, or on a new empty server with `restore-bundle`. Both are in [Recovery and emergencies](#/docs/recovery-and-emergencies).

**If it will not restore.** The most common cause is a forgotten or mistyped passphrase. It is not stored anywhere readable, so there is no way to recover it. This is why the passphrase must be kept somewhere safe, away from the server.

> A restore brings back the platform as it was at backup time. Anything customers did after that moment is gone, including new sign-ups. You cannot restore one reseller alone. Tell customers if you ever have to roll back.

## I was locked out or banned and restarting did not help

**Cause.** Sign-in lockouts and IP bans are saved in the database and survive a restart or an update. This is deliberate, so that restarting cannot let a guesser back in.

**Fix.**

- A locked sign-in name clears itself after 15 minutes. Wait.
- A banned address clears after the ban length (15 minutes by default), or press **Lift** next to it on the [Firewall](#/docs/firewall) page from another address.
- A "Block this address" rule never ends by itself. Remove it on the Firewall page.
- `HOST_ALLOW_ANY` only lifts the Host Console address list. It does not remove bans, blocks or lockouts.

See [Security](#/docs/security) for how lockouts work.

## A reseller sends me "diagnostics" text

It is the output of **Copy diagnostics** on their Backup and restore page. It holds the app version, device, Reseller ID, plan, user counts, two-factor and recovery key status, last backup time and their last warnings and errors. It never has business data. Read it line by line with [Support and diagnostics](#/docs/support-and-diagnostics).

## A reseller says scanning with the phone camera does not work

Almost always one of two things.

1. **The site is not opened over https.** The camera only works on https. Check the Site address in [Settings](#/docs/settings) and your proxy.
2. **The camera is blocked.** The reseller must allow it in the browser. On an iPhone: Settings, Safari, Camera. Then use **Try again** on the scanner.

If neither helps, ask for the phone and browser, the message the scanner showed, and the diagnostics text. The picture is read on the phone, is never sent to the server and nothing is logged, so there is nothing on your side to check. A keyboard-style hardware scanner is not affected. More in [Support and diagnostics](#/docs/support-and-diagnostics).

## A reseller asks me to restore just their account

You cannot. Backups cover the whole site, are all-or-nothing, and you cannot open the encrypted data. The reseller's own backup file (**Backup and restore**, **Back up now**) is how one account gets its work back. Ask them to restore it with **Choose file** and **Add what is missing**. Explain this kindly, and encourage regular backups.

## A customer says their trial ended and the app is read-only

**Cause.** When a trial or a paid period ends, the account becomes **read-only**. People can still sign in and look, but cannot change anything. The owner is emailed once when this happens. Accounts on the **Free (comped)** plan never end.

**Fix.** In [Accounts](#/docs/accounts), open the account and choose **Extend trial** (if it is still on trial) or **Change plan**. You can set a trial number of days, a paid-through date, or Free. A reason is recorded. The account can write again straight away. The new trial length in [Settings](#/docs/settings) affects only accounts created from that moment on. The [Pipeline](#/docs/pipeline) page lists trials about to end and gone-quiet accounts, so you can nudge people before this happens. See [Plans and trials](#/docs/plans).

## Plans and prices: why is nothing being charged?

**Cause.** The Plans page records names, prices and limits ahead of taking payments. As the page itself says, nothing is charged and no limit is enforced yet. Money received outside the app can be written down with **Record a receipt** on the account.

## A helper administrator cannot get in

**Cause.** Every Host administrator must have two-factor turned on before the console works for them. A helper who signs in for the first time is taken to a "Set up two-factor" screen, and until they finish it, the server refuses everything else with "Set up two-factor authentication before using the Host Console."

**Fix.** Ask them to follow the screen: press **Set up two-factor**, scan the code with an authenticator app, enter the six-digit code and save their recovery codes.

If they have lost their phone, the **Owner** opens Security, picks the helper, and chooses **Reset two-factor** (or **Set temporary password**, or **Sign out everywhere**). Each action is written to the log. Helpers cannot do this for each other. If the Owner loses their own phone, they use the command-line recovery below.

## I am the Owner and I am locked out of the Host Console

**Fix.** On the server, run:

    node server.mjs reset-host-admin

It prints a temporary password for the username `admin` and clears two-factor. You must choose a new password and set up two-factor again at your next sign-in. Details are in [Recovery and emergencies](#/docs/recovery-and-emergencies).

If the message says "Too many failed attempts. Try again in 15 minutes", wait. The lock survives a restart, so restarting does not help. If the cause was a ban on your address, lift it under Firewall from another address.

## A customer asks me to recover their data, or they lost their password and recovery key

**Answer.** You cannot, and that is by design. Customer data is encrypted so that only the people in that account can read it. The Host never sees it, and holding the server does not give you a key to it. The customer is 100 percent responsible for their data, their recovery key and their own exports.

What you can do, safely:

- **Forgotten password.** Use **Email a password reset link** or **Set a temporary password** for that person in Accounts. They then sign in and choose a new one.
- **Lost two-factor device.** Use **Reset two-factor authentication** for that person.
- **Account suspended by mistake.** Choose **Reactivate**.
- **Account closing.** An account that is closing is kept for 7 days. An Administrator of that account can restore it in their app during that time, and you can press **Restore** on the account sheet. After the 7 days the account is erased and cannot be restored.

What you cannot do: read, export, repair or decrypt their inventory, sales or customers. If the account's encryption is set up and nobody has the password or the saved recovery key, the data cannot be opened by anyone. In the Accounts list, a chip saying **No recovery key** is a useful early warning. You can nudge that customer to save theirs, and the [Onboarding](#/docs/onboarding) page shows who has not.

Explain this plainly and kindly, and encourage regular exports. See [Security](#/docs/security).

## An alert is showing and I do not know what it means

Open [Alerts](#/docs/alerts). Each problem is listed once, with a counter, and clears by itself when the cause is gone. The server watches email, backups, sign-in floods, storage, the database and trials about to end, every five minutes. **Check now** forces a fresh look. You can set a problem aside to hide it from the banner. It still clears itself when fixed.

## After an update something looks wrong

Open [Updates](#/docs/updates). It shows the running version, whether a newer release exists, what the last update did and the number of unexpected errors since the version started, with a link to the error log. Updating never happens by itself: you rebuild the container from the new version. Always take a backup first. If errors appear right after an update, open [Logs](#/docs/logs) with the **Errors** quick filter, and restore your backup if you need to go back.

## The Overview shows "A database restore is staged"

A restore has been prepared and will be applied the next time the server restarts. Restart the app when you are ready, remembering that it signs everyone out. Restoring from the Backups page restarts the server for you, so you normally only see this banner if the restart did not happen.

## General FAQ

### Can I see a customer's inventory or sales?

No. The Host Console shows counts, plan dates and security facts, such as whether an account has two-factor on or a recovery key saved. It never shows business content. The "Data" panel on an account only says whether encryption is set up and how many stored records exist. See [Overview](#/docs/overview).

### What is the difference between the Owner and a helper?

The Owner is the first Host administrator. Only the Owner can add or delete other administrators, reset their two-factor, set their temporary passwords and sign them out. Helpers can use the rest of the console, once they have two-factor on. The Owner is also the person who receives alert emails. See [Security](#/docs/security).

### What is a Reseller ID?

It is the account code, shaped like BX-ABC123, that identifies a customer business. Customers sign in as `username@BX-ABC123`. You will see it in Accounts, Pipeline, Onboarding and the logs. Ask for it first when a customer contacts you.

### Can I stop new people signing up?

Yes. Turn off **Open sign-ups** in [Settings](#/docs/settings). Existing accounts keep working.

### How long is the free trial and how do I change it?

The length is set in Settings under **Free trial length for new sign-ups (days)**. It applies only to accounts created afterward. For an existing account, use **Extend trial** or **Change plan** on that account.

### How do I tell customers about maintenance?

Use the **Announcement banner** in Settings. It shows one plain-text message (up to 400 characters) at the top of every customer's app, in blue, amber or red, with an optional last day.

### What does the Host do about backups of customers' data?

You back up the whole platform, which holds each customer's data in the form the customer encrypted it. Backups let you restore the service. They do not give you any way to read the contents. Customers remain responsible for their own backups and exports: each Administrator can save their own backup file in the reseller app.

### How long are logs kept?

By default the database copy of the activity log keeps 90 days, which you can change under Server options in Settings (**Keep the activity log (days)**). Sign-in history per account has its own setting. The [Audit trail](#/docs/audit-trail) records what each Host administrator did, firewall and ban changes, and Host Console sign-ins.

### Should I use SQLite or PostgreSQL?

SQLite is good for testing and small sites. For many distributors working at once, switch to PostgreSQL or MariaDB using `node server.mjs migrate-db --to ...`. The original database is left untouched, and the target must be empty. The step-by-step is in [Settings](#/docs/settings) and [Running the server](#/docs/running-the-server).

### Where do I start if I am new?

Read [Getting started](#/docs/getting-started), then [Overview](#/docs/overview). The [Glossary](#/docs/glossary) explains every unfamiliar word.
