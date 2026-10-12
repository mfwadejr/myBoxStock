---
title: Plans
summary: How trials, free (comped) and paid accounts work, how to write your plan list with prices and limits that the server enforces, set the trial length, record receipts, and what read-only means when a plan ends.
keywords: plans, pricing, price, trial, free trial, trial length, comped, free, paid, paid through, expiry, ended, read-only, receipts, billing, billed every, limits, add a plan, save plans, remove, limits list, counting period, warn at, at the cap, block adding new, new accounts start on, enforced
order: 6
covers: nav:plans, Add a plan, Remove, Name, Price, Billed every, Month, Year, Note, trial length, Trial, Free, Paid, Trial ended, Paid ended, Change plan, Extend trial, Record a receipt, Paid through, read-only, Free trial length for new sign-ups (days), Limits, Add a limit, Counts, Counting period, Warn at (percent), At the cap, Warn only, Move up, Move down, New accounts start on, Save plans and limits, Included in
---

## What this page is for

Plans has two jobs that are easy to mix up, so it helps to separate them right away.

1. The **Plans page** is a written list of the plans you intend to offer: a name, a price, how often it is billed, and what each plan includes. Prices are a notebook for you, ready for when payments are connected. The limits are real: the server enforces them.
2. The **plan of each account** is a separate matter: every customer account is, at any moment, on a trial, free (comped) or paid. You set that per account under [Accounts](#/docs/accounts) with **Change plan**.

> At the top of the Plans page a blue notice says it plainly: limits are enforced, and prices are recorded only. Nothing is charged. A limit set to **Block adding new** stops a reseller adding past the cap; **Warn only** lets them carry on after showing a notice.

This page covers both, because understanding the account states is what makes the list make sense.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

![Plans](shot:host-plans "Plans: the plan list, trial length and receipts.")

## The three kinds of account plan

### Free trial

Every new sign-up starts on a free trial. The trial has an end date. While it runs, the account works normally and Accounts shows "Trial" with "days left". When the end date passes, the account becomes read-only (see below) and the server sends the owner a "trial ended" email.

The length of a trial for new sign-ups is a platform setting. Open [Settings](#/docs/settings) and change **Free trial length for new sign-ups (days)** (a whole number from 1 to 365; the default is 14). It applies only to accounts created from then on. Existing accounts keep their own end date. The Plans page reminds you of the current length in its blue notice.

Why change it? A short trial pushes people to decide; a longer one suits products that need a full stock-take cycle to judge. Watch [Pipeline](#/docs/pipeline) to see what happens to trials after you change it.

### Free (comped)

A comped account never expires. Use it for a launch partner, a friend, an internal test business or a charity. The account shows "Free" and the note "Free account, never expires". It counts under **free** on [Overview](#/docs/overview) and "comped" on Pipeline, and it never appears in the renewals list.

### Paid

A paid account has an optional **Paid through** date. With a date, the account is in good standing until the end of that day (UTC). After that, it shows "Paid ended" and becomes read-only. Without a date it simply has no end date and never expires, which is useful for a customer on a long arrangement that you track yourself.

## What read-only means

When a trial or a paid period ends, the account is not deleted and nothing is lost. It becomes read-only:

- People can still sign in and look at everything they have, including exporting it.
- Any attempt to change something (add, edit, sell, void) is refused with a message that the plan has ended.
- The account can still be closed by its own Administrators.

This is deliberate. A customer who forgot to pay can still reach their records and decide, rather than being locked out of their own information. To bring them back, change the plan as below and they can edit again straight away, since nothing needs to be restored.

> Read-only is not the same as suspended. A suspended account cannot sign in at all, and a closing account is locked for 7 days before it is erased. Read-only is the gentle state.

## Changing an account's plan

This is done in Accounts, not on the Plans page.

1. Open [Accounts](#/docs/accounts), search for the business and click its row.
2. In the Plan section press **Change plan**. (For a trial there is also **Extend trial**, which opens the same form already set to a trial, with extension ticked.)
3. Pick the **Plan**: "Free, comped, never expires", "Free trial" or "Paid".
4. For a trial enter **Trial length (days)** from 1 to 730. Tick "Add to the current end date instead of starting today" to add days to a trial that is still running; leave it unticked to start counting from today.
5. For paid, optionally choose **Paid through**. Leave empty for no end date.
6. Write a **Reason (saved in the account's history)**. It is required (at least a few words).
7. Press **Save plan**.

Every change is recorded in the account's **Plan history** with the date, who made it, the old and new plan, and your reason.

Examples:

- A customer says the first week was lost to a holiday: **Extend trial**, 7 days, reason "holiday, agreed by email".
- A whole group needs more time (a launch week, an outage): in [Accounts](#/docs/accounts) tick the accounts, or use **Select all matching** after choosing a plan filter, and use the bulk action **Extend trial** or **Change plan**. You see a preview such as "This will extend 42 trials by 14 days", type the confirmation, and every account gets its own plan-history entry and audit entry. Bulk actions never suspend, close or delete.
- A friend of the business: **Change plan** to Free, reason "comped, launch partner".
- A customer paid for a year: **Change plan** to Paid with Paid through next year's date, or record a receipt (below) and tick the apply box.

### Many accounts at once

The bulk actions **Extend trial** and **Change plan** on the Accounts page make the same changes as the single-account form, for every ticked account, after a preview and a typed confirmation. Trials are extended only for accounts on a running trial; the others are skipped and counted. A large selection runs in the background with a progress bar. Each change is recorded in the account's plan history with the reason you typed, and in the [Audit trail](#/docs/audit-trail) under Bulk account actions.

## Receipts and billing records

Because no online payment is connected yet, you record money you received yourself, for example a bank transfer or cash.

1. Open the account in [Accounts](#/docs/accounts).
2. In **Receipts** press **Record a receipt**.
3. Fill in **Amount received** (like 29.00), **Currency** (three letters, USD by default), **How it was paid**, **Reference** such as an invoice or transfer number, optionally **Paid through (optional)** and **Note**.
4. If you tick "Also set the plan to Paid through that date", the account is set to Paid until that date in the same step.
5. Press **Save receipt**.

Each receipt is listed in the account with date, method, reference, "paid through" date, note and who recorded it. A **Remove** button deletes a wrong one, after asking for a reason, which is logged.

Why bother? So that when a customer says "I paid in March" you can check in seconds, and so that [Pipeline](#/docs/pipeline) renewals are accurate. These records are the Host's own business records about the customer. They are not the customer's sales.

> A receipt record does not charge anyone or refund anyone. It only writes down what happened.

## The plan list on this page

Open **Plans**. The page has three parts, from the top: the **Limits** list, one card for each plan, and **New accounts start on**. Two buttons sit at the bottom: **Add a plan** and **Save plans and limits**.

### The Limits list

The **Limits** card lists everything you can cap. It works like the Makes and models list in a reseller's Settings: add, rename, reorder and remove rows. A new site starts with three: Team members, Devices and Sales. Each row has:

- **Name**. What you and the reseller call it, such as "Devices" or "Customers this year". Two limits cannot share a name.
- **Counts**. What is counted, from a fixed menu: **Administrators**, **Team members (including administrators)**, **Device records**, **Sales records**, **Customer records** and **Models**.
- **Counting period**. **All time** (the default), **Rolling 12 months** or **Rolling 30 days**. A rolling period counts only records created inside it.
- **Warn at (percent)**. When use reaches this share of the number, the reseller sees a nearly-full notice. The default is 80.
- **At the cap**. **Warn only** or **Block adding new**.
- **Move up**, **Move down** and **Remove**. Order is only for how the list reads. Removing a limit removes its numbers from every plan and every account.

What can be counted is limited by what the server can see. It knows how many device records, sales, customers and models an account holds, and how many people it has, because those are listed in the clear. It cannot see inside a record, so it cannot count devices in stock, devices on loan or sold devices separately. **Device records** counts every device record, sold or not, and a sold device keeps counting for as long as the record exists. That is deliberate: it is a limit on the data the reseller holds, not on what is on their shelf.

> A cap on people stops an Administrator adding someone new. A cap on records stops the whole save, so a batch is never half stored. Opening, editing, selling, exporting and deleting are never blocked by a limit.

### Each plan's fields

- **Name** (up to 60 characters). Every plan must have one, and two plans cannot share a name. The card heading shows it as you type, or "New plan" while empty.
- **Price**. A number such as 29.00. Leave empty for a free plan. Letters and symbols are ignored.
- **Billed every**. A drop-down: **Month** or **Year**.
- **Note**. Up to 200 characters for yourself, such as "Includes email receipts".
- **Included in** the plan. One number box for every limit in the list. A whole number, 0 to allow none, or empty for "No limit".

Each card also has a **Remove** button. Nothing is deleted from the server until you press **Save plans and limits**. A plan that accounts are on cannot be removed: the page names how many accounts use it and asks you to move them first.

### New accounts start on

The **New accounts start on** drop-down chooses the plan every new sign-up is put on, starting with their free trial. Choose **No plan (no limits)** to start people unlimited. It affects only sign-ups from then on. Move an existing account from its own sheet, as described under [Accounts](#/docs/accounts).

### Steps to write your list

1. Look at the Limits list. Rename, reorder or remove rows, or press **Add a limit** for a new one.
2. Press **Add a plan**. A blank card appears with a number box for each limit.
3. Fill in the fields and the numbers. Repeat for each plan, for example Starter, Standard and Pro.
4. Press **Save plans and limits**. You will see "Plans and limits saved" and the saved list reloads.
5. Pick **New accounts start on** if you want new sign-ups limited, and save again.

You can have up to 20 plans and 30 limits. If a number is not valid, the page tells you which plan and limit to check, and nothing is saved until you fix it.

### What a reseller sees

On Home, a **Your plan** card shows each limit with a bar and "used of limit". Past the warn-at share, a notice says so; at the cap, it says they have reached the limit, and for **Block adding new** that they cannot add more. A refused save says "Your plan allows" with the limit and numbers, and "Nothing was saved". Imports are checked before any row is saved. You see the same bars for each account on its sheet.

### Example list

- Limits: Team members (all time, block), Devices (all time, warn at 80, block), Sales this year (rolling 12 months, warn only).
- Starter: 19.00 per month, 2 team members, 150 devices.
- Standard: 39.00 per month, 5 team members, 1000 devices.
- Annual: 390.00 per year, no team limit, 5000 devices.

Remember these prices are notes. An account's actual state is still Trial, Free or Paid, set by you in Accounts, and its plan decides only the limits.

## Tips and mistakes

- Tell customers the limits in your sign-up page and plan description. A blocked reseller sees the number, but it helps to hear it first.
- Start with **Warn only** while you learn what normal use looks like, and move to **Block adding new** for the limits that protect your server.
- Setting a very short trial length without telling people leads to confused customers when they become read-only. Mention it on your sign-up page or in the [announcement banner](#/docs/settings).
- Changing the trial length does not touch accounts already running. Use Extend trial for those.
- Always give a clear reason on plan changes. Future you, or a colleague, will be glad.
- Remember the customer-side responsibility: a read-only account can still export, and customers are responsible for making their own exports. Remind people before a plan ends.
- Check [Overview](#/docs/overview) for the "ended" count and [Alerts](#/docs/alerts) for trials about to end.

## Related pages

[Accounts](#/docs/accounts) holds the Change plan and receipt tools, [Pipeline](#/docs/pipeline) lists trials and renewals, [Settings](#/docs/settings) has the trial length, and [Email](#/docs/email) lets you reword the "Trial ended" message.
