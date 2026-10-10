---
title: Overview
summary: A live picture of the server: how many accounts and people, whether backups are healthy, plan counts, CPU, memory and storage, firewall activity and email.
keywords: dashboard, home, overview, accounts count, users, signed in now, database, backup status, cpu, memory, storage, disk, load, uptime, version, firewall, blocked, rate-limited, banned, mail queue, banner, restore staged
order: 2
covers: nav:overview, Email is on but no test email has passed since it was last changed, Send a test email, red number, Last snapshot, Last full-site backup, Last test restore, Copy off this server, Backup space left, Not protected yet, need attention, Background job, Accounts, Users, Signed in now, Database, Backups card, Plans card, on trial, ending within 7 days, free, paid, ended, CPU, Memory, Storage, Server, Protection, blocked, rate-limited, banned now, mail sent queued failed, Email links will not work banner, database restore staged banner, Alerts banner, Set the site address, Support card, Open Support, waiting on Host, unassigned, Demo accounts on Overview, DEMO, Show demo accounts, What you can and cannot see here
---

## What this page is for

Overview is the page you land on after signing in, and where the brand mark at the top left takes you. It answers one question: is the server fine right now? You do not need to read every number each day. You need to know what normal looks like so that something unusual stands out.

The page refreshes itself every 10 seconds while you keep it open, so you can leave it on a spare screen during a busy launch. Leaving the page stops the refreshing.

> Overview only shows server and identity facts. There is nothing here about any customer's stock, sales or customers, because the server cannot read them.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## The heading line

Under the page title you see the server's host name, how long it has been running ("up" followed by a duration) and the app version, for example `v0.20.0`. Why it matters:

- A very short uptime that you did not expect means the server restarted, perhaps after an update, a crash or a power cut. Check [Logs](#/docs/logs) and [Alerts](#/docs/alerts).
- The version tells you what you are running when you compare it to the [Updates](#/docs/updates) page.

## Warning banners at the top

Up to three banners can appear above the cards.

### A red bar about problems

On every page, not just Overview, a red bar says how many problems need a look, with an **Open Alerts** link. It disappears when there are none, and alerts you have set aside do not count. Open it and work through them; see [Alerts](#/docs/alerts).

### Email links will not work

This banner appears when the server cannot work out a proper public address to put in emails. It explains the problem and offers **Set the site address**, which takes you to [Settings](#/docs/settings). Fix this early: until the site address is right, confirmation and password-reset emails will contain links that go nowhere, and customers will contact you.

### Email has not been tested

This note appears when email is on but no test email has passed since the email settings last changed. It links to [Email](#/docs/email), where **Send test email** or **Check my email setup** will confirm that messages really go out. A passing test removes it.

### A database restore is staged

This appears when you have asked for a restore from [Backups](#/docs/backups) and it will be applied on the next restart. Until you restart, the server still uses the current data. If you did not expect this banner, open Backups and check before restarting, because applying a restore replaces what the server holds.

![The Host Overview with made-up demo data](shot:host-overview "The Host Overview with made-up demo data: the top numbers, the Backups, Plans and Support cards and server health.")

## The four top numbers

- **Accounts** is how many customer accounts exist. The small note under it says how many are suspended. A suspended account is one you or a colleague switched off under [Accounts](#/docs/accounts).
- **Demo accounts** made by [Demo mode](#/docs/demo-mode) count in these numbers, and a small amber **DEMO** chip under Accounts and Users says how many of them are demo. When demo accounts exist, a **Show demo accounts** checkbox appears: clear it to see the numbers, plan counts and storage for real accounts only. The choice is remembered in this browser only.
- **Users** is how many people there are across all accounts. Each account has at least one administrator, plus whatever staff they add.
- **Signed in now** counts different people who used the app in the last 15 minutes. It is not the number of open sign-ins, which would overstate it because a sign-in lasts a long time. Use it to pick a quiet moment for maintenance: if it is 0 or 1, restarting hurts almost nobody.
- **Database** shows which database engine is in use (for example SQLite or PostgreSQL) and, for a file-based database, its size. If the database is on a separate server it says "external server" instead of a size. A steadily growing size is normal as customers add records. A sudden jump is worth a look at [Logs](#/docs/logs).

## The Backups card

This card shows, in one place, whether your backups would really save the site. A heading card carries a label and a link, **Open Backups**, and two rows of numbers sit under it, with the destinations listed below when you have any.

The label on the right is one of:

- **Protected** (green): a copy is held off this server and a test restore of it passed. This is the same Protected state as in Backup setup on the Backups page.
- **Not protected yet** (amber): nothing is wrong, but the site is not yet safe from losing the disk or the machine. Finish Backup setup.
- **N need attention** (red): one or more backup alerts are open. The same problems are on the [Alerts](#/docs/alerts) page.

The first row of numbers:

- **Last snapshot** is how long ago the newest frequent snapshot was taken, with its date and time.
- **Last full-site backup** is how long ago the last good full-site backup finished, its size and that it was verified. If scheduled backups are off it says so. It turns red when the schedule is on but the last good backup is older than the window (more than 2 days for nightly, more than 8 days for weekly).
- **Last test restore** is how long ago a test restore last passed, or Never. It turns red after 30 days. If a later test failed, a red note says when.
- **Copy off this server** is Yes or No, and which destinations hold a copy. A backup that lives only on this machine is lost with it.
Why you care: a backup that quietly stopped is the classic way servers lose everything. Treat red as urgent. See [Backups](#/docs/backups). Remember this is a backup of the server. It does not replace the customers' own exports. If the worst happens, [Disaster recovery](#/docs/disaster-recovery) is the runbook, with a printable checklist.

The second row:

- **Destinations** counts how many of your turned-on destinations are working and how many are failing.
- **Backup space left** is the free space on the disk that holds the backup folder, as a size and a percentage, and how much the backups use. It turns red when 5 percent or less is free, or when there is not room for two more copies of the newest backup.
- **Protected** repeats the state above in words.
- **Background job** says Failed, with the job name and how long ago, when a Test restore, restore, backup or Test a backup file job ended with an error. It clears when you dismiss the job strip on the Backups page or start another job.

Under the numbers, **Destinations** lists each turned-on destination by name with when a copy was last sent and when it last failed, if ever.

Why you care: a backup that quietly stopped, or that was never tested, is the classic way servers lose everything. Treat red as urgent. See [Backups](#/docs/backups). Remember this is a backup of the server. It does not replace the customers' own exports.

> A copy that only lives on the same machine is not protection against losing the machine. Choose a destination under Backups so a copy is sent away.

The card shows counts, times and destination names only. It never reads anything inside an account.

## The Plans card

A single row of chips counts accounts by plan:

- **on trial** are accounts in a free trial that has not ended;
- **ending within 7 days** are trials or paid periods about to run out (it turns amber when above zero, a prompt to nudge those customers);
- **free** are comped accounts that never expire;
- **paid** are paid accounts still in date;
- **ended** are trials or paid periods that have run out. These accounts are read-only: people can still look at their data, but changes are refused.

These are the same numbers explained on [Plans](#/docs/plans) and listed by name on [Pipeline](#/docs/pipeline). Use "ended" as your to-do list for follow-up with customers who may want to pay or be given more time.

## The Support card

Below the Plans card, the **Support** card shows the state of the ticket queue: how many tickets are open, how many are waiting on you, how many are overdue (past the response target of business days set in Support settings) and how many nobody has taken. **Open Support** goes to the ticket list. An overdue ticket also raises an alert. The same number of tickets waiting on you (Open or Waiting on Host) is shown as a red number on the **Support** item in the left menu, and on the **More** button on a phone or tablet. It disappears when it reaches zero, refreshes when a page loads and every couple of minutes, and updates right after you reply or change a status. See [Support tickets](#/docs/support-tickets).

## CPU, Memory and Storage

Three cards show the machine's resources. Each has a big percentage, a bar that turns amber above 75 percent and red above 90 percent, and (for CPU and Memory) a small history graph.

- **CPU** shows the number of cores as a chip, the current percentage, and a line "Load" with three numbers. The load numbers are the machine's recent average busyness. As a rule, if the first load number is above the number of cores for a long time, the server is working harder than it can keep up with.
- **Memory** shows total memory, the percentage in use, how much that is, and "app uses" followed by how much memory myBoxStock itself is using. A high percentage by itself is common on Linux, which uses spare memory for caching. Worry if it stays red and the app's own use keeps climbing.
- **Storage** shows total disk size, the percentage used and how much is free. This is the one to watch most. A full disk stops the database writing, stops backups and can corrupt a day. Act well before 90 percent: delete old backups you no longer need, add disk space, or move to a larger volume.

> A single brief spike on the CPU graph is normal, for example during a backup. Look for a pattern.

## Server and Protection cards

- **Server** shows the operating system, the Node version (the engine the app runs on) and the processor model. It is mostly for support conversations: tell whoever helps you these.
- **Protection** counts firewall activity since the server last started: **blocked** requests, **rate-limited** requests (people who asked too fast and were slowed), and **banned now** (addresses currently refused). The blocked and rate-limited counts start again from zero after a restart, but bans do not: an active ban is saved and is still in force after a restart or an update, so **banned now** can be above zero straight after the server starts. Next to them is the mail summary: how many messages were sent and queued, plus a red count of failed ones if any.

What is normal: a public website attracts bots, so some blocked and rate-limited requests are expected. A sudden large jump may mean someone is hammering the site; open [Firewall](#/docs/firewall) and [Logs](#/docs/logs) to see from where.

For mail, queued numbers should return to zero within a minute or two. If **failed** appears in red, or queued keeps growing, outgoing email is broken. Open [Email](#/docs/email); customers cannot confirm addresses or reset passwords without it.

## What to worry about, in order

1. A red backup label, a failed test restore, or a restore you did not expect.
2. Storage above 90 percent.
3. The "Email links will not work" banner, or failed mail.
4. A red alerts bar.
5. A restart you did not expect (short uptime).
6. Memory or CPU stuck in red.

## What to do about each, in short

1. Backups: open [Backups](#/docs/backups), read the failure reason, fix the folder or passphrase, and run one by hand.
2. Storage: free space or enlarge the disk, and check [Backups](#/docs/backups) for old files.
3. Email: [Email](#/docs/email) and the [Settings](#/docs/settings) site address.
4. Alerts: open each, act, then set aside what you have dealt with.
5. Restart: [Logs](#/docs/logs) shortly before the time it happened.
6. Resources: if it is steady growth, plan a bigger server; if brief, ignore it.

For emergencies read [Recovery and emergencies](#/docs/recovery-and-emergencies), and for server care see [Running the server](#/docs/running-the-server).

## What you can and cannot see here

Every number on this page is about the server, not about anyone's business. You can see how many accounts exist, how many people belong to them, how big their stored data is, which plan each is on, and when each last signed in. You cannot see what a reseller sells, owns or charges: inventory, customers, sales, receipts, prices and notes are encrypted in the reseller's browser before they reach the server, and only the reseller (and the people they invite) can open them. The server stores them as unreadable blocks. The totals above count those blocks and their size, never what is inside. See [Accounts](#/docs/accounts) for the exact list of what the Host can look at when helping one reseller.

## Tips

- Overview is safe to leave open; it only reads.
- The numbers are about the platform. For help with one customer go to [Accounts](#/docs/accounts).
- Compare **Signed in now** with **Users** to get a feel for how active your customers are. A low ratio is normal for small businesses that check in once a day.
- If a card shows a dash or "Unavailable", the server could not read that measurement (some hosting environments hide disk figures). It is not by itself a fault.
