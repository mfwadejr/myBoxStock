---
title: Alerts
summary: Understand the problems the server finds on its own, what each alert means, when you are emailed, and how to set one aside or let it clear itself.
keywords: load more, showing, offsite upload failed, alerts, alert, banner, warning, problem, email failing, backup failing, failed sign-ins, storage full, disk, database errors, trials ending, update available, set aside, check now, owner, counter
order: 9
covers: nav:alerts, Check now, Needs a look, Set aside, Recently cleared, seen N times, emailed, problem, warning, heads-up, Email is not being delivered, The scheduled backup is failing, Many failed sign-ins, Storage is almost full, Database problems, Trials ending soon, Version is available, red banner, Open Alerts, Load more, Showing N of M alerts
---

## What alerts are

The server watches its own health and speaks up when something needs your attention. You do not have to remember to look at the Email page, the Backups page and the Logs page every morning. If something is wrong, an entry appears on the **Alerts** page, a red banner shows across the top of the Host Console, and the Owner administrator gets an email.

Alerts are about the server only: email delivery, backups, sign-in floods, disk space, database errors, trials about to end, and new versions. Nothing inside a customer's account is ever read. An alert about trials, for example, only counts how many are ending. It never names an account or looks at business records.

> Think of the Alerts page as a short to-do list the server writes for you. An empty list is the goal. Most entries remove themselves once you fix the cause.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## How alerts are found

The server runs a check pass over every alert type every five minutes, starting shortly after it starts. Each check does one of two things:

- If the problem is present, it raises the alert (or adds to one already open).
- If the problem is gone, it clears that alert automatically.

You can also run a pass yourself with the **Check now** button at the top of the Alerts page. It runs all checks right away, refreshes the lists and the banner, and shows "Checked". Use it after you have fixed something, to see the alert clear without waiting.

## The alert types

Every alert has a headline, a plain description of what was found, and a level shown as a coloured label. There are three levels:

- **problem** (red) is serious and usually needs action soon.
- **warning** (amber) needs a look but is not urgent.
- **heads-up** (blue) is for information and planning.

### Email is not being delivered (warning)

Raised when any message has been given up on (marked failed) in the last 24 hours, or when any message has been waiting in the queue for more than 30 minutes. The description says how many failed, how many are stuck, and the last reason. The advice is to open the Email page, then the Health tab. See [Email](#/docs/email).

Why it matters: customers cannot reset passwords and new sign-ups never get their welcome message when mail is broken. It also means other alerts might not reach you, so fix this one first.

### The scheduled backup is failing (problem)

Raised as soon as any scheduled backup fails and no good one has been made since: a frequent snapshot, an offsite copy (including a failed upload to a destination such as a NAS, S3 bucket or SFTP server), or a full-site backup. The description says which one failed and the reason given. It clears itself after the next good backup. See [Backups](#/docs/backups). A failed full-site backup is not retried until the next day, so after you fix the cause use **Run one now** on the Full-site backups tab, or **Take a snapshot now** or **Send one now** on the other tabs.

### Many failed sign-ins (warning)

Raised when there have been 20 or more failed, refused or wrong-code sign-in attempts in the last hour, counted across the whole site (customers and Host administrators together). The description gives the number and tells you to open Logs and use the "Failed sign-ins" quick filter to see where they come from. See [Logs](#/docs/logs).

Why it matters: a burst of failures is the usual sign of someone guessing passwords. It can also be one customer who forgot a password and keeps trying, so check the addresses before reacting. If it is an attack, you can block the address on the Firewall page. See [Firewall](#/docs/firewall).

The threshold of 20 per hour is fixed. It cannot be changed on the page.

### Storage is almost full (problem)

Raised when the disk holding the server's data is 90 percent full or more. The description gives the percentage. It clears when usage falls below 90 percent.

Why it matters: when the disk fills, the database cannot write, backups fail, and logs stop. Free space by removing old backups you no longer need (they live in the data folder, by default in `/data/backup`), keeping fewer copies or taking them less often, or enlarging the disk. The cost line on the Backups page tells you how much your settings will use. Send long-term copies to a destination rather than keeping many on the live disk.

### Database problems (problem)

Raised when the server has logged any database error in the last hour. The description gives the count and tells you to open Logs and choose the area "database". It clears when an hour has passed with no new database errors.

Why it matters: database errors can mean a full disk, a database server that cannot be reached, or something corrupt. Take a manual backup if you can, then read the log entries to see the reason.

### Trials ending soon (heads-up)

Raised when at least one free trial ends within the next three days. The description gives only a count, "3 trials end within 3 days", and suggests opening Accounts or Plans to follow up. It clears when no trial is in that window. See [Accounts](#/docs/accounts) and [Plans](#/docs/plans).

Why it matters: when a trial ends, the account becomes read-only. A friendly nudge from you before that day is often what turns a trial into a paying customer.

### Version is available (heads-up)

Raised when you have given the server a release address on the Updates page and its daily check finds a newer version than the one running. The headline names the version, for example "Version 0.19.0 is available", and the description says to rebuild the container to update. It clears by itself once you are running that version or newer, or when you remove the release address. See [Updates](#/docs/updates).

This is the only alert that does not send an email. It appears on the page and in the banner only, because a new release is not an emergency.

## Reading the Alerts page

The page opens with the **Check now** button, then up to three sections.

### Needs a look

These are the open alerts, newest activity first. A note says "These clear by themselves when the problem is gone." Each line shows:

- The level label (**problem**, **warning** or **heads-up**).
- The date and time it was last seen.
- A counter chip such as **seen 12 times**, shown when it has been found more than once.
- A green **emailed** chip if the Owner was sent an email about it.
- A **set aside** link.
- The headline in bold with the details underneath.

If nothing is open the section says "All clear. Nothing needs attention."

### Set aside

Appears only when you have set something aside. Alerts here are hidden from the banner. The note says "Hidden from the banner. They clear by themselves when the problem is gone." The newest 100 are shown. If there are more, a line under the list says "Showing 100 of 130" and **Load more** adds the next 100.

### Recently cleared

The latest 100 problems that went away, so you can see that a problem you fixed really did clear, or spot one that keeps coming and going. It shows "Nothing cleared recently." when empty.

Both history lists scroll inside a box of their own on tablets and computers, so a long list does not push everything else off the screen. On phones the page scrolls instead. The open alerts in **Needs a look** are not in a box, because there are only a few.

## Grouping with a counter

The same problem tends to repeat. If email is down for a day, there could be hundreds of failures. Rather than make hundreds of entries, the server keeps one alert for each kind of problem and counts how often the checks have found it. Each time a check pass finds the problem still there, it adds one to the counter, refreshes the date, and updates the description with the latest numbers.

So **seen 12 times** means the problem has been present across 12 check passes (roughly an hour at five minutes per pass). It does not count messages or attempts. Treat the counter as "how long has this been going on".

## One email to the Owner

When a new alert opens, the server sends a "Host alert" email to the Owner administrator, who is the oldest Host administrator account that has an email address on file. The email has the headline, the details and the time. It is sent once for that alert, no matter how many times the problem is found again. The line "emailed" on the alert shows that it went out.

What this means in practice:

- If the Owner has no email address saved, nobody is emailed about alerts. Add one on the Security page. See [Security](#/docs/security).
- If a problem clears and later comes back, it is treated as new and you are emailed again.
- If email itself is broken, the alert email may not arrive. This is why you should also glance at the banner.
- The backup failure also has its own separate email to every administrator with an address, if you left that option on. So on a backup failure you can receive two messages: one from the backup schedule and one alert email.

You can reword the "Host alert" email on the Email page, Messages tab, under System.

## Setting an alert aside

If you have seen an alert and decided to deal with it later, click **set aside**. The alert moves to the **Set aside** section and no longer counts toward the red banner. It is not deleted, not silenced forever, and it is not emailed again. If the problem goes away, it clears like any other. If the problem stays, the alert stays in the Set aside section and its counter keeps rising.

When to use it: a known issue you cannot fix right now, such as "Trials ending soon" when you already have a plan to contact them, or a version notice you will act on at the weekend.

When not to use it: do not set aside a backup or storage problem just to make the banner go away. The banner is the one thing that reminds you.

> There is no button to bring an alert back from Set aside. If it should be looked at again, wait for the problem to clear and return, or fix it.

## Auto-clear

You never need to dismiss a problem to make it disappear. Every check pass compares what it finds with what is open. When the problem is no longer there, the alert is closed, moved to **Recently cleared** and a note is written to the activity log. This applies to open alerts and to alerts you set aside.

## The red banner

While at least one alert is open, a red banner appears at the top of the page on every Host Console screen except the Alerts page itself. It says how many problems need a look, for example "2 problems need a look.", with a link, **Open Alerts**.

- The number counts open alerts of every level, including heads-ups such as trials and updates.
- Alerts you set aside are not counted.
- The banner updates when you move between pages, and straight away after **Check now** or **set aside**.

> If the banner is always there because of a heads-up you do not care about, set that one aside. A banner you learn to ignore will hide the day a real problem shows up.

## A sensible routine

1. Look at the Alerts page when you sign in, or whenever the red banner shows.
2. Start with problems (red), then warnings, then heads-ups.
3. Fix the cause, then click **Check now** to confirm it clears.
4. Once a week, look at **Recently cleared**. An item that keeps appearing there is a sign of something to fix properly.

## Mistakes to avoid

- Not having an email address on the Owner account, so alerts are never sent.
- Setting aside a serious problem instead of fixing it.
- Expecting the counter to count customer actions. It counts check passes.
- Expecting an email when a new version is available. That one is not emailed.
- Assuming an alert about trials or sign-ins names any customer. They only give counts.

## Where to go next

- [Overview](#/docs/overview) shows the health of the server at a glance.
- [Logs](#/docs/logs) has the detail behind sign-in and database alerts.
- [Backups](#/docs/backups), [Email](#/docs/email) and [Firewall](#/docs/firewall) are where the matching problems get fixed.
- [Troubleshooting and FAQ](#/docs/troubleshooting-faq) lists common causes.
