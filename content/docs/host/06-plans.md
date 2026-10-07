---
title: Plans
summary: How trials, free (comped) and paid accounts work, how to write your plan list with prices and limits, set the trial length, record receipts, and what read-only means when a plan ends.
keywords: plans, pricing, price, trial, free trial, trial length, comped, free, paid, paid through, expiry, ended, read-only, receipts, billing, billed every, users included, devices included, limits, add a plan, save plans, remove
order: 6
covers: nav:plans, Add a plan, Save plans, Remove, Name, Price, Billed every, Month, Year, Users included, Devices included, Note, trial length, Trial, Free, Paid, Trial ended, Paid ended, Change plan, Extend trial, Record a receipt, Paid through, read-only, Free trial length for new sign-ups (days)
---

## What this page is for

Plans has two jobs that are easy to mix up, so it helps to separate them right away.

1. The **Plans page** is a written list of the plans you intend to offer: a name, a price, how often it is billed, and limits for users and devices. It is a notebook for you, ready for when payments are connected.
2. The **plan of each account** is a separate matter: every customer account is, at any moment, on a trial, free (comped) or paid. You set that per account under [Accounts](#/docs/accounts) with **Change plan**.

> At the top of the Plans page a blue notice says it directly: prices and limits are recorded here only. Nothing is charged and no limit is enforced yet. Writing "5 users" on a plan does not stop an account having 8.

This page covers both, because understanding the account states is what makes the list make sense.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

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
- A friend of the business: **Change plan** to Free, reason "comped, launch partner".
- A customer paid for a year: **Change plan** to Paid with Paid through next year's date, or record a receipt (below) and tick the apply box.

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

Open **Plans**. You see one card for each plan, and two buttons at the bottom: **Add a plan** and **Save plans**.

### Each plan's fields

- **Name** (up to 60 characters). Every plan must have one, and two plans cannot share a name. The card heading shows it as you type, or "New plan" while empty.
- **Price**. A number such as 29.00. Leave empty for a free plan. Letters and symbols are ignored.
- **Billed every**. A drop-down: **Month** or **Year**.
- **Users included**. A whole number from 1 upward, or empty for "No limit".
- **Devices included**. A whole number from 1 upward, or empty for "No limit".
- **Note**. Up to 200 characters for yourself, such as "Includes email receipts".

Each card also has a **Remove** button that takes it off the list. Nothing is deleted from the server until you press **Save plans**.

### Steps to write your list

1. Press **Add a plan**. A blank card appears.
2. Fill in its fields. Repeat for each plan, for example Starter, Standard and Pro.
3. Press **Save plans**. You will see "Plans saved" and the saved list reloads.

You can have up to 20 plans. If a number is not valid, the page tells you which plan to check ("Check the numbers for ..."), and nothing is saved until you fix it.

### Example list

- Starter: 19.00 per month, 2 users, 1 device.
- Standard: 39.00 per month, 5 users, 3 devices.
- Annual: 390.00 per year, no user limit, no device limit.

Remember these are notes. An account's actual plan is still Trial, Free or Paid, set by you in Accounts.

## Tips and mistakes

- Do not tell customers a limit is enforced when it is not. Say what you will accept.
- Setting a very short trial length without telling people leads to confused customers when they become read-only. Mention it on your sign-up page or in the [announcement banner](#/docs/settings).
- Changing the trial length does not touch accounts already running. Use Extend trial for those.
- Always give a clear reason on plan changes. Future you, or a colleague, will be glad.
- Remember the customer-side responsibility: a read-only account can still export, and customers are responsible for making their own exports. Remind people before a plan ends.
- Check [Overview](#/docs/overview) for the "ended" count and [Alerts](#/docs/alerts) for trials about to end.

## Related pages

[Accounts](#/docs/accounts) holds the Change plan and receipt tools, [Pipeline](#/docs/pipeline) lists trials and renewals, [Settings](#/docs/settings) has the trial length, and [Email](#/docs/email) lets you reword the "Trial ended" message.
