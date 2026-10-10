---
title: Demo mode
summary: Build made-up reseller accounts of a chosen size for testing, screenshots and measuring, without ever touching a real account. This page explains the switch, the four standard sets and Custom sets, the backup that comes first, the demo logins, how demo accounts show up in the Host numbers, and how to remove them.
keywords: demo, demo mode, demo data, test data, fake accounts, sample accounts, sample data, Demo3, Demo300, Demo1000, Demo5000, size set, custom set, build, recipe, seed, filler, DEMO chip, demo banner, screenshots, load test, measuring, remove demo, reset demo, demo password, open as reseller, backup first
order: 24
covers: nav:demo, Demo mode, Demo3, Demo300, Demo1000, Demo5000, Backup first, Back up now, Continue without a backup, PROCEED WITHOUT BACKUP, Build, Edit recipe, Reset to defaults, Reset demo, Remove, Remove all demo data, Delete set, Add a Custom set, Custom, Partly built, Not built, Stop, Demo logins, Show, Copy, Open as this reseller, Reset password, Options and safety limits, Hours before a backup counts as old, Most accounts in one build, Most devices in one account, Most records in one build, Leave demo accounts out of backups, Use the real Plans page as a ceiling, Reset all demo settings to defaults, Show demo accounts, DEMO, REMOVE, RESET, How big accounts behave
---

## What this page is for

**Demo mode** builds made-up reseller accounts on this server so you can try the product at a realistic size, take screenshots for the documentation, measure how the server behaves with many accounts, or show a prospect a busy business without using anyone's real data. It sits in the left menu between **Data and retention** and **Updates**.

The most important promise comes first. Demo mode only ever builds, resets or removes accounts that carry the **demo tag**. Real accounts, their records, their settings and the plans you have set up are never read, changed or counted as demo. Every demo action is recorded in the [Audit trail](#/docs/audit-trail), and a demo password never appears in any log.

Everyone who can sign in to the Host Console can read this page. Changing anything, and anything that touches a demo password, needs the **Owner** or **Administrator** role. A read-only Host role, if one is added later, will see the page but not the buttons.

![Demo mode](shot:host-demo "Demo mode: the switch and the four standard size sets.")

## The switch

At the top, the **Demo mode** switch is **off** on a fresh server. While it is off:

- **Build** and **Reset demo** are disabled and refuse to run.
- Demo logins cannot sign in. Anyone who tries sees a clear message saying that Demo mode is switched off.
- Demo accounts that already exist stay where they are. They are not deleted by switching off.

Switching it **off** also signs out every demo session that is open. Switching it back on lets the demo logins in again. Both changes are written to the Audit trail as **Demo mode switched on or off**.

## Four standard sets and your own

Each **set** is a recipe for a group of accounts. Four standard sets come ready to build.

- **Demo3** has 3 accounts. It builds in a few seconds and is the one to use for screenshots and quick checks.
- **Demo300** has 300 accounts with up to 2,000 devices in an account. It takes roughly ten to twenty seconds on a normal server and uses about 60 MB.
- **Demo1000** has 1,000 accounts. It puts real load on the server while it builds, so a test copy of the site is the better place for it.
- **Demo5000** has 5,000 accounts, the largest standard set. Use it on a test copy only.

Every set has its **Owner login**, a **Standard** login and a **View** login, named after the set. Demo3 gives `demo3`, `demo3-std` and `demo3-view`. The other accounts in the set are filler: they exist so the Host numbers, lists and searches have a realistic size, and they share one password that you can see and change under **Demo logins**.

Use **Add a Custom set** for any other size. Give it a name of 3 to 20 letters and numbers that starts with a letter, for example `Pilot2`. A Custom set gets the logins `pilot2`, `pilot2-std` and `pilot2-view` and shows a **Custom** chip. A Custom set that is not built can be removed from the list with **Delete set**.

Each set card shows how many people, devices and records it will make, how big the largest account is, and, once built, what exists now. The chip says **Not built**, **Built** or **Partly built** (for example after you stopped a build).

## The recipe

**Edit recipe** opens every number a set uses, so nothing is hidden:

- How many accounts, and the fewest, most and "very large" devices per account.
- How many people each account has, and the mix of roles (Administrator, Standard and View).
- The mix of device states: sold, available, reserved, returned, damaged and archived.
- How many customers per hundred sold devices, the most devices in one sale, and how many months of history to spread sales over.
- The mix of account plans: trial, free and paid.
- The **seed**. The same seed gives the same accounts, the same Reseller IDs and the same records every time, which is what makes screenshots and measurements repeatable.

While you type, an estimate line shows the accounts, people, devices, records, disk space and time the recipe will need, and turns red with the reason if a safety check would refuse it. **Save** keeps your numbers for the next Build. Accounts already built are not changed.

**Reset to defaults** puts one set back to its built-in recipe. A Custom set goes back to a small generic recipe and keeps its name. The button at the bottom, **Reset all demo settings to defaults**, puts every recipe and every option back, removes Custom sets from the list and leaves the on or off switch and anything already built untouched.

## Backup first

**Build**, **Reset demo** and **Remove** all begin with a check. The **Backup first** card shows when the last full-site backup was made. If it is older than the limit (24 hours by default), a sheet called **Take a backup first** opens.

- **Back up now** runs the normal full-site backup as a background job, with its progress bar, and carries on to your action when it is done.
- The **Owner** administrator can instead type `PROCEED WITHOUT BACKUP` and choose **Continue without a backup**. This is audited as **Demo started without a backup**. Other administrators cannot do this.

The first Build is treated the same way: with no backup on record, it cannot start until one is made. The backup itself is described on [Backups](#/docs/backups); if you have not set a passphrase there yet, do that first.

> Full-site backups and offsite copies leave demo accounts out by default, so restoring one never brings demo data back. You can change that under Options. Whole snapshots and safety copies still hold them, and **Test a backup file** on [Backups](#/docs/backups) tells you how many demo accounts a file left out or holds.

## Building, stopping and the progress strip

Choose **Build** on a set. A sheet shows the estimate, and for the large sets a warning about load. After the backup check the job starts and the usual progress strip appears at the top of the page, with the step it is on and a percentage. Only one background job runs at a time, so a Build waits if a backup or prune is running.

The strip has a **Stop** button. A stopped Build ends after the account it is on, so only whole accounts remain, and the set shows **Partly built**. A stopped set is not resumed: use **Reset demo** to start over or **Remove** to clear it.

Before anything is written, Build checks four things and refuses with a plain reason if one fails:

1. **Name clash.** If a real reseller already uses a name, Reseller ID or sign-in that the set would create, nothing is built and the clashing names are listed.
2. **Size limits.** The set may not exceed the limits under Options (accounts, devices per account, records in one build).
3. **Disk space.** There must be room for the estimated size with a safety margin.
4. **Already built.** A built set must be removed or reset first.

If the plan ceiling is on, no demo account gets more devices than the largest real plan allows.

![The Demo logins table](shot:host-demo-2 "The Demo logins table: passwords stay hidden until you choose Show.")

## Demo logins

The **Demo logins** table lists, for every set, the Owner, Standard, View and "all other accounts" rows. Each row has four buttons.

- **Show** reveals the password for 15 seconds, then hides it again.
- **Copy** puts the password on your clipboard.
- **Open as this reseller** opens the reseller sign-in in a new tab and signs you in as that login, with a one-time link that works for a minute. If you are already signed in to a real reseller account in the same browser, use a private window, because the new sign-in replaces the old one.
- **Reset password** makes a new password. The Owner administrator may type their own (12 or more characters); everyone else gets a generated one. Resetting the filler row changes the shared password of every filler account in the set. The old password stops working and anyone using it is signed out.

Each press is recorded in the Audit trail (**Demo password shown, copied or changed** and **Opened as a demo reseller**), with the login name but never the password.

## What the rest of the console shows

Demo accounts are real rows in the database, so they **count in the Host numbers**: Accounts, Users, plan counts and storage on [Overview](#/docs/overview) include them, and a small amber **DEMO** chip beside the numbers says how many are demo. In the account list ([Accounts](#/docs/accounts)) every demo account carries a **DEMO** chip.

The checkbox **Show demo accounts** on Overview and Accounts hides them from those numbers and lists. Your choice is remembered in this browser only.

Inside the reseller app, anyone signed in with a demo login sees an amber **DEMO** banner on every page, so a demo can never be mistaken for a customer's business.

## Email and billing

Demo accounts **never send email** and are **never billed**. Their addresses end in `@demo.myboxstock.invalid`, a name that cannot exist on the internet, and the mail system refuses them on the spot. Reset links, confirmation emails and receipts for a demo account are refused with a message and nothing is queued. The trial sweep and the trial-ending alerts skip them as well, so a demo account never expires into a read-only state.

## Options and safety limits

- **Hours before a backup counts as old** sets the age used by Backup first.
- **Most accounts in one build**, **Most devices in one account** and **Most records in one build** are the safety limits.
- **Leave demo accounts out of backups** is on by default. It applies to full-site backups on SQLite. A PostgreSQL or MariaDB dump is always whole, and a quick database snapshot is whole too.
- **Use the real Plans page as a ceiling** is off by default.

Save them with **Save options**.

## Remove and Reset demo

**Remove** on a set card, or **Remove all demo data** at the bottom, first shows a preview: how many demo accounts, people and records will go, and how many real accounts will **not** be touched. You must type `REMOVE` to continue. **Reset demo** removes and rebuilds with the current recipe, and needs `RESET`. Both run as stoppable background jobs, after the backup check.

The database file does not shrink after a removal. When it finishes, a note offers **Compact the database**, described on [Data and retention](#/docs/data-and-retention).

## In the Audit trail

The **Demo mode** filter in the [Audit trail](#/docs/audit-trail) lists every switch, setting change, Build, Remove, Reset, Stop, password action, Open, override and refused attempt. Refused attempts (for example a role that may not manage Demo mode) are recorded too.

## How big accounts behave

Demo mode is also how the big-account speed measurements were made for this release (see the figures in the project notes, "Big-account speed measurements"). On a laptop the largest demo account (about 3,000 devices) reaches a usable Home in about one second after sign-in. On a recent phone it takes about two seconds, and on an older phone about three, because the phone has to decrypt every record in the browser. Opening Inventory, Sales or Customers and searching them stays quick at these sizes, and the browser holds only a few megabytes of decrypted records. Nothing was changed in the app to take these measurements, so the figures describe what resellers get today. If you want to measure your own server, build Demo300 or larger on a test copy (not the live server), sign in as the large demo account on the devices you care about, and time it. Remove the demo data afterwards.

## Tips and common questions

- **Why can I not build?** The switch is off, a job is running, the set is already built, a name clashes, or a limit or disk check failed. The message says which.
- **Can customers see demo accounts?** No. Demo accounts are separate reseller accounts with their own Reseller IDs. Real resellers cannot see them.
- **Can I use demo data for measuring?** Yes. Build the same set with the same seed, and the records have the same content each time; only the encryption differs because every build makes fresh keys.
- **Are demo records real?** Yes. They are encrypted in the same way as a customer's, by the app's own code, so the real app opens them normally.
- **What if I forget a password?** Use **Show**, or **Reset password**.
