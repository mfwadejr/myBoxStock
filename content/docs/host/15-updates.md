---
title: Updates
summary: What the Updates screen shows, how to set up the release check, and the safe way to update myBoxStock yourself: back up, rebuild the container, check the result, and roll back if needed.
keywords: updates, update, upgrade, version, running version, newest release, release address, github, releases latest, last update, errors since start, rebuild container, docker compose, zimaos, migrations, rollback, roll back, backup before update, changelog, check now
order: 15
covers: nav:updates, Running version, Newest release, Last update, Health since start, Open the error log, Release address, Save, Check now, What changed, a newer version is available, you are up to date, not checked yet, not checking, clean, check the logs, database changes
---

## The most important thing to know

**This server never updates itself.** No update is ever downloaded or installed in the background. When a new version of myBoxStock comes out, you choose when to install it, and you install it by rebuilding the container from the new version.

The Updates screen is a dashboard for that process. It tells you what is running now, whether a newer release exists, and how the last update went. It has no "Install update" button, on purpose: updating a live server that holds other people's businesses should be a decision you make at a time you pick, with a backup in hand.

## The three status cards

### Running version

The big number is the version of myBoxStock that this server is running, for example `0.18.2`. Underneath it you see:

- The build label, if the container was built with one (shown as "build" followed by the label). Builds made by hand may not have one.
- When the server last started, such as "started 3 hours ago".

The same version is also shown on the Overview screen and at the web address `/healthz`, which is handy for a quick check from a monitoring tool.

### Newest release

This card shows the newest version found at your release address. The note underneath tells you the state:

- **not checking**: you have not entered a release address, so no checks happen.
- A red-toned message (such as "The release address answered 404."): the last check failed. The reason is shown.
- **a newer version is available**: the newest release is higher than the running version.
- **you are up to date**: the newest release is the same as, or older than, what you run.
- **not checked yet**: an address is saved but no check has completed.

### Last update

This card remembers the last time the version changed. It shows the old and the new version, for example `0.18.1 to 0.18.2`, how long ago it happened, and:

- **clean** when no unexpected errors have been recorded since the server started, or **check the logs** when some have.
- How many database changes were applied during that start ("2 database changes"), if any.

Before any update has happened, the card says "none seen" and "shown after the first update". The first time the server starts after you update, this card fills in automatically.

## When a newer version is available

If the Newest release is higher than the running version, a blue notice appears: "Version X is available. Take a backup first (Backups), then rebuild the container." When the release feed supplies a link, a **What changed** link opens the release notes in a new tab. A matching entry also appears on the Alerts screen at information level. It is not emailed to you.

Always read the release notes before updating. Every version has an entry that lists what was added, changed or fixed, and any known limitations.

## Health since start

This card counts the unexpected errors the server has recorded since it last started. A green "0 errors" is what you want. If the number is above zero it turns red and an **Open the error log** link takes you straight to the Logs screen filtered to the error area for the last seven days.

Use it right after an update: if the number goes up in the first few minutes, something is wrong and you should read the entries before you walk away. Note that this counts entries in the error area only. Warnings, such as failed sign-ins, are not counted here.

## Release address

The release address is optional. It lets the server check once a day whether a newer version exists. Without it, nothing is checked and you hear about new versions some other way.

What to type: the address of your release feed. For GitHub this has the form

`https://api.github.com/repos/OWNER/REPO/releases/latest`

where OWNER and REPO are the project's GitHub owner and repository names. It must begin with `https://`, have no spaces and be no longer than 300 characters. The feed is expected to answer with a version label such as `v0.18.2` in its `tag_name` (or `version`) field. That is what GitHub's "latest release" address returns.

### Steps to turn the check on

1. Open **Updates**.
2. In the **Release address** box (it shows "https://" as a hint), type or paste the full address.
3. Press **Save**. You see "Saved".
4. Press **Check now**. You see "Checked", and the Newest release card fills in.

The **Check now** button is greyed out until an address is saved. Under the box a line says when the last check happened.

To stop checking, empty the box and press **Save**. The check then stops and any "newer version" alert is cleared. Saving a different address forgets the previous answer until the next check.

### What is sent and received

The server makes one small request to the address, waits up to eight seconds, and reads only the version label and the link to the release page. Nothing about your customers or your server goes out except the usual details of a web request. The automatic check runs once a day while the server is running (the first one a day after the server starts, so press **Check now** if you want an answer straight away).

Possible problems and what they mean:

- "Enter a full https:// address, or leave it empty to stop checking": the box has something that is not an https address.
- "The release address answered 404.": the address is wrong or the project has no published release yet. Other numbers are the other server's reply.
- "The release address did not answer in time.": a network problem, or the other end is slow.
- "The release address did not return a version number.": the address works but is not a release feed.
- A failed check never affects your server. It only shows a message here.

If your server cannot reach the internet at all (some locked-down networks), checks will fail with a timeout. You can still update; you just need to find out about new versions yourself.

## How to update, step by step

The details depend on how you run the server, but the order is always the same. These steps assume the standard Docker setup described in [Running the server](#/docs/running-the-server), including a ZimaOS box running the container.

1. **Read the release notes.** Note anything that says it needs action from you.
2. **Warn your customers.** Turn on the announcement banner in [Settings](#/docs/settings), for example "The site will be offline for about five minutes at 10 PM." Pick a quiet time.
3. **Take a backup.** Open [Backups](#/docs/backups), press **Full-site backup**, choose a passphrase of at least 12 characters and download the file. Keep it somewhere other than the server. Write the passphrase down safely; without it the backup cannot be opened. Note the current version number from the Updates screen as well.
4. **Get the new version.** Put the new version's files where the container is built from (for example by pulling the new release into the project folder), or pick the new image if you run a published one.
5. **Rebuild and restart the container.** In the folder containing your `docker-compose.yml`, run `docker compose up -d --build`. On ZimaOS, use the same idea in its own screens or in a terminal: rebuild or redeploy the app from the new version. The key point is that the container is recreated while the **data folder stays attached**.
6. **Wait a minute or two,** then open the Host Console and sign in.
7. **Check the Updates screen.** Running version should show the new number. Last update should read "old to new" and say "clean". If it mentions database changes, that is normal. Health since start should be 0 errors.
8. **Spot-check.** Sign in as a test account, and use the **Send test email** button on the Email screen to make sure mail still goes out.
9. **Turn the announcement banner off.**

### What happens to the database

You do not run anything for the database. When the new version starts, it applies any database changes it needs, once and in order, before accepting traffic. Each one is recorded and written to the log. The Last update card shows how many were applied. They only go forward; there is no automatic way to undo them, which is why the backup in step 3 matters.

### Why back up first, every time

Updates are usually uneventful, but a backup turns a bad surprise into a ten-minute inconvenience. It costs a minute and a download. Do it even for "tiny" releases.

## Rolling back sensibly

Think of rolling back as two separate questions: which code is running, and which data does it see.

**If the new version does not start or is plainly broken and showed no database changes** (the Last update card says nothing about database changes), the data is the same shape as before. Put the previous version back and rebuild the container. Nothing else is needed.

**If the update did apply database changes,** the older code may not understand the newer database. In that case:

1. Put the previous version's files back and rebuild the container.
2. Restore the backup you took in step 3, so the data matches the older code. On the standard setup this is the Restore button next to a backup file on the Backups screen (you type RESTORE to confirm), or the `restore-bundle` command described in [Recovery and emergencies](#/docs/recovery-and-emergencies).
3. Check the Updates screen shows the older version and 0 errors.

Be aware that restoring returns the platform to how it was at the backup. Anything that happened since (new sign-ups, plan changes, new administrators) is lost from the platform's records, so roll back soon rather than later. The restore also keeps a safety copy of what was there before.

> Tip: do not skip a lot of versions on a hunch. Updating one release at a time, reading each entry in the changelog, makes a problem easy to pin down. If you have fallen far behind, take a backup, update, and check the Updates screen as usual.

## Mistakes to avoid

- Deleting or not attaching the data folder when you rebuild. The container is disposable; the data folder is not. If the container starts with an empty data folder you will see a brand-new server and a new first-run administrator password. Stop, reattach the right folder and restart.
- Updating without a backup you can actually open. Test that you know the passphrase.
- Ignoring "check the logs" on the Last update card.
- Changing the release address to something that is not a release feed.
- Expecting the screen to install anything. It only reports.
