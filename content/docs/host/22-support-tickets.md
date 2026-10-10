---
title: Support tickets
summary: Work the tickets that signed-in resellers open from their app: the list and its filters, a ticket with its requester panel, replies and internal notes, statuses, the response target, Host notes, Support settings and the Owner-only purge.
keywords: new ticket alert, notice, notices, digest, recipients, threshold, hourly limit, live list, new tickets, show, refresh, overdue count, support, ticket, tickets, T-1042, reply, internal note, canned reply, status, waiting on reseller, waiting on host, resolved, closed, priority, category, assignee, response target, overdue, business days, screenshot, attachment, host notes, purge, retention, requester, rate limit, open tickets cap
order: 22
covers: nav:support, New-ticket notices, Show new tickets in Alerts, Email the Host about new tickets, Show reseller replies in Alerts, Email the Host about reseller replies, Send emails to, All Host administrators, Owner only, A chosen list, Which tickets, Every ticket, Only High and Urgent, Chosen list, Daily digest instead of one email per ticket, Notice emails per hour, N new tickets show, N overdue, Overdue count, Screenshot viewer, Open in new tab, Download, Previous, Next, Support red number, Support, Tickets, Settings, Active tickets, Overdue, Waiting on Host, Waiting on reseller, Resolved, Closed, Assigned to, Time waiting, Requester, Their other tickets, Host note, Host notes, Reply to reseller, Internal note, Insert a canned reply, After sending set the status to, Add screenshot, Categories and priorities, Canned replies, Targets and limits, Response target, Days before Resolved closes by itself, Screenshots per message, Largest screenshot, New tickets per account per hour, Open tickets per account, Retention, Purge closed tickets, Support tickets are waiting for a reply, Ticket reply sent
---

## What this page is for

The **Support** section is where you answer resellers who write to you from inside their app. A reseller opens a ticket with a category, a subject, a message, optional screenshots and, if they choose, a diagnostics summary. You read it here, reply, leave notes for your colleagues, and follow it until it is resolved. Only signed-in resellers can open tickets. There is no public form yet, and no live chat, service-level contract or knowledge-base search.

Tickets are different from everything else a reseller does. Their inventory, customers and sales are encrypted with their own key and you cannot read them. A ticket is plain text that the reseller chose to send you, so you can read it. The ticket form tells them so: it says that tickets can be read by myBoxStock, and asks them not to paste customer details, passwords or their recovery key. If a reseller pastes one anyway, tell them to change the password and do not copy it elsewhere.

![The Support list with the Overdue count, filters and the new-tickets bar.](shot:host-support "The Support list with the Overdue count, filters and the new-tickets bar.")

## The ticket list

Open **Support**. The **Tickets** tab lists tickets, newest activity first. The default filter is **Active tickets**: Open, Waiting on Host and Waiting on reseller. Use the filters to narrow the list:

- **Status**: Active tickets, Open, Waiting on Host, Waiting on reseller, Overdue, Resolved, Closed or All tickets.
- **Priority**, **category** and **assignee** (anyone, unassigned, or one Host administrator).
- **Search**: a ticket number such as T-1042, words from the subject, the reseller name or Reseller ID, the person's username or email, or words inside any message.

Each row shows the ticket number, subject, reseller, status, priority, who has it, the last activity and **Time waiting**. A red **Overdue** chip appears when nobody has answered within the response target. Click a row to open the ticket. Your filters are remembered while you open tickets and come back.

### The Overdue count

At the top of the page, above the filters, a chip shows how many tickets are overdue, for example **2 overdue**. It turns red when the number is above zero and stays grey at zero. It is the same number as the red mark in the menu, the **Support tickets are waiting for a reply** alert and the Overview Support card, so the four always agree. Click the chip to show only the overdue tickets (the **Status** filter changes to Overdue); click it again to go back to **Active tickets**. Next to it a line reminds you of the response target in business days.

### The list keeps itself current

You do not need to reload. The count in the menu and the open Support list check for news about every 20 seconds. The list is only asked again when something changed.

- A change to a ticket already in the list, such as a reply, a new status or a new assignee, is swapped into its row. Your filters, the words in the search box, your place on the page and the ticket you are reading stay exactly as they were.
- When new tickets arrive that match your filters, the list does not jump. A bar above it says **1 new ticket, show** (or **N new tickets, show**). Click **show** when you are ready and they appear at the top.
- Checking pauses while the browser tab is hidden or the window is minimised, and runs once straight away when you come back. A ticket you are in the middle of answering is never disturbed.

## One ticket

The top card holds the ticket header: number, status, priority, category, who it is **Assigned to**, when it was created, the last activity and the **Time waiting**. Change the status, priority, category or assignee with the four dropdowns. Each change is saved at once, written to the thread as a line, and recorded in the [Audit trail](#/docs/audit-trail).

Time waiting is counted from the reseller's last message while the ticket waits on you, and from your last reply while it waits on the reseller. Resolved and Closed tickets do not wait.

### The requester panel

Beside the conversation, the **Requester** panel tells you who you are talking to without leaving the ticket:

- The reseller (account) name, linked to the account, and the Reseller ID.
- Plan and account status.
- The person who opened the ticket: username, user type and email.
- How old the account is.
- The app version and the browser or device the ticket was opened from. If the version is older than the server's, the panel says so.
- **Their other tickets**, open and past, each linked.
- The **Host note** for this reseller, if one exists.

### The conversation

Messages from the reseller are plain. Your replies are shaded blue, and internal notes are shaded yellow. Status lines and assignments appear as small grey lines; assignment, priority and category lines are for you only, while status lines are visible to the reseller. Screenshots show under the message that carried them, and a ticket opened with diagnostics has a **Diagnostics attached** section you can expand. Everything is shown as text, never as markup.

## Replying and leaving notes

Under the conversation, switch between **Reply to reseller** and **Internal note**.

- A reply goes to the reseller. Choose what the ticket becomes after sending: Waiting on reseller is the default, and Resolved or any other status is available. If nobody had the ticket, replying assigns it to you.
- An internal note is for the Host only. The reseller never sees it, it does not change the status, and it does not notify them.
- **Insert a canned reply** adds a ready-made text to the box. You can edit it before sending.
- **Add screenshot** attaches PNG or JPG pictures, within the limits you set.

The **Support** item in the left menu shows a red number: the tickets waiting on you (Open or Waiting on Host), the same count as the Overview Support card. It hides at zero, updates when a page loads and every couple of minutes, and right after you reply or change a status. On a phone or tablet, where Support is under **More**, the number shows on the **More** button too.

The ticket page lines up its facts: the Requester card and the ticket details card use one label column, so the values start at the same place, and on a phone each label sits above its value.

When a reply is sent, the reseller sees a red number beside their name in the app. If Email is set up and the person has an address, they are also emailed that there is a reply. The email names the ticket but does not contain the reply. If Email is not set up, the confirmation says so: emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The in-app number always works.

## Screenshots in the viewer

Click or tap a screenshot in the conversation, or the small preview of a picture you are attaching, to open the **Screenshot viewer** on top of the ticket. It scales the picture to fit; tap it to zoom to full size and again to zoom out. **Close**, Escape, a click outside and the back gesture on a phone all close it and return you to the same place in the ticket. When a message has several screenshots, **Previous** and **Next** show a count such as "2 of 3". **Download** saves the picture and a small **Open in new tab** link opens the raw image. The pictures are served exactly as before (checked by content, never run as a page), and a screenshot attached to an internal note still cannot be fetched by the reseller.

## Statuses

- **Open**: new, or the reseller has just written. It needs you.
- **Waiting on Host**: you have picked it up and it is still with you.
- **Waiting on reseller**: you asked a question or answered, and are waiting.
- **Resolved**: you believe it is sorted.
- **Closed**: finished. Replies are no longer accepted, and the reseller is told to open a new ticket.

A reply from the reseller reopens a Resolved ticket and returns it to Open. A Resolved ticket closes by itself after the number of days you set. You can also close one by hand, or reopen a closed one by changing its status.

## The response target and the overdue alert

The **Response target** is a number of business days (Monday to Friday, default 2). A ticket that is Open or Waiting on Host and has had no reply for that long is overdue. One grouped alert, **Support tickets are waiting for a reply**, appears on [Alerts](#/docs/alerts) and on the Overview, names the oldest tickets, and is emailed once to the Owner if Email is set up. It clears by itself when the tickets are answered. The same number is shown as the **Overdue** chip on this page. The Overview also shows the open-ticket count, how many wait on you, how many are overdue and how many are unassigned.

## Host notes on a reseller

Open an account on [Accounts](#/docs/accounts). Besides the **Account** tab there is a **Tickets** tab listing every ticket that reseller has opened, and a **Host notes** tab with a free-form note shared by all Host administrators. Use it for things like who to call, a promise you made or a billing arrangement. The reseller never sees it, and saving it is audited.

## Support settings

The **Settings** tab holds everything you define:

- **Categories and priorities**: the lists resellers and you choose from, one per line, and which priority new tickets start with. Tickets keep the wording they were opened with if you later rename or remove a category.
- **Canned replies**: titles and texts.
- **New-ticket notices**: how the Host hears about a ticket right away. See the next section.
- **Targets and limits**: the response target in business days, the days before Resolved closes by itself (default 7), the number and size of screenshots (PNG or JPG only), how many new tickets one account may open per hour, and how many open tickets one account may have at once.

### New-ticket notices

When a reseller opens a ticket, you hear about it at once, in two ways. Every Standard, View and Administrator reseller's ticket counts the same.

- **In the app.** A line appears in [Alerts](#/docs/alerts), for example "New ticket #1042 from Alex Boxes: Scanner will not focus (High priority)", with a link to the ticket. It raises the Alerts count and the red banner. High and Urgent tickets are red. The line clears by itself when anyone opens the ticket or replies to it.
- **By email.** Through the [Email](#/docs/email) setup, with the subject "[myBoxStock] New support ticket #1042: Scanner will not focus". The message names the reseller, the priority and the category, and shows the first lines of what they wrote with a link to the ticket. It never contains screenshots, diagnostics or anything else from the ticket.

The settings in the **New-ticket notices** card:

- **Show new tickets in Alerts**: on by default.
- **Email the Host about new tickets**: **off** by default. Nothing is emailed until Email is set up. The switch stays locked while Email is off. Set up Email, send a test email that arrives, then come back and switch it on. While it is still off but Email works, Alerts shows a heads-up reminder.
- **Show reseller replies in Alerts** and **Email the Host about reseller replies**: the same two switches for when a reseller answers a ticket that is now waiting on the Host. In-app is on by default, email is off. The alert clears when you open or answer the ticket.
- **Send emails to**: **All Host administrators** (default; everyone who has an email address on file), **Owner only**, or **A chosen list** (tick the administrators under **Chosen list**; at least one is needed). The in-app alert is shown to everyone who opens Alerts whatever you choose here.
- **Which tickets**: **Every ticket** (default) or **Only High and Urgent**. A ticket below the threshold raises no alert and no email.
- **Daily digest instead of one email per ticket**: off by default. When on, one email a day lists the new tickets and reseller replies since the last one, and no per-ticket emails are sent. Alerts are not affected.
- **Notice emails per hour**: the safety limit, 1 to 200, default 20. Every email counts, so one ticket sent to three administrators uses three. When the limit is reached the rest are not emailed (they still show in Alerts) and the skipped notices are logged.

Click **Save support settings** under the card (or at the bottom of the tab). If you try to switch on the email switches while Email is not set up, you get a plain message and nothing changes.

Screenshots are checked by their actual contents, not their file name, so a renamed file of another type is refused. They are stored in the database, so every snapshot, full-site backup and database dump carries them. See [Backups](#/docs/backups).

## Retention and purging

Closed tickets are kept, with their messages and screenshots, until the Owner administrator purges them. Nothing purges by itself unless the Owner sets an automatic age for closed tickets on [Data and retention](#/docs/data-and-retention) (off by default). That page also has **Prune now** for closed tickets, with a preview first. Under **Retention**, the Owner can use **Purge closed tickets**: choose how many days a ticket must have been closed (0 means every closed ticket), see how many match, type PURGE to confirm, and the tickets are deleted for good. Other administrators see the count but cannot purge, and a refused attempt is recorded. Only closed tickets can be purged. Backups made earlier still hold the tickets until they age out.

When a reseller's account is erased, its open tickets are closed and the tickets stay, with the account's name and Reseller ID copied onto them, until purged. The Terms and Privacy Policy say that tickets can be read by myBoxStock and that closed tickets are kept until purged.

## The audit trail

Everything you do here is recorded under the **Support tickets** filter of the [Audit trail](#/docs/audit-trail): opening a ticket (once per administrator per ticket per day), replies, notes, status, priority, category and assignment changes, automatic closing, settings, Host notes and purges. The entries name who did it and which reseller it concerned. Every new-ticket notice is also recorded, with the system as the actor: **New-ticket alert raised**, **New-ticket email queued**, **New-ticket email not sent** (with the reason: below the threshold, Email not set up, no recipient, or the per-hour limit) and **Daily support digest sent**. The emails themselves appear in the recent messages list on [Email](#/docs/email) until the retention rules remove them.

> Reply in plain words and keep it short. Ask for diagnostics when you need the version and warnings, and remind resellers not to paste passwords or recovery keys. See also [Support and diagnostics](#/docs/support-and-diagnostics).


Opening a ticket is logged as **Ticket opened by the Host** only the first time each Host administrator opens that ticket on a given day, so reading a long conversation does not fill the trail. Every real action (reply, internal note, status, priority, category, assignment, purge) is logged every time.
