---
title: Pipeline
summary: Track new sign-ups, who is on a trial and when it ends, what is due to renew in the next 30 days, and which active accounts have gone quiet.
keywords: pipeline, sign-ups, signups, trials, renewals, gone quiet, inactive, trial ending, days left, last seen, outcome, comped, ended, nudge, follow up, churn
order: 4
covers: nav:pipeline, Sign-ups this week, On a trial, Trials ending in 7 days, All accounts, Where accounts stand, Trials running, Renewals next 30 days, Gone quiet, Business, Reseller ID, Owner, Days left, Last seen, Ended, Ends, Paid, Trial, comped
---

## What this page is for

Pipeline is the "who should I talk to this week?" page. It turns the plan and sign-in facts the server holds into four short lists so you can follow up with the right people at the right time: welcome the new ones, nudge the trials that are about to end, chase renewals, and check on accounts that stopped using the service.

Like the rest of the Host Console it uses only plan dates, contact addresses and last-seen times. It never shows what anyone has in stock or sold, because the server cannot read it. The page says so in its subtitle: only plan and contact details, never anyone's business data.

The page loads when you open it. It does not refresh itself, so reopen **Pipeline** (or reload the browser page) to see fresh figures.

> Pipeline is read-only. To act on someone you see here, find them in [Accounts](#/docs/accounts) by business name or Reseller ID and use the support tools there.

## The four numbers at the top

### Sign-ups this week

The number of accounts created in the last 7 days. Underneath, a note shows how many were created in the last 30 days. Why it matters: it is your growth heartbeat. If you launched a campaign on Monday, you will see it here by Tuesday. A week of zero is worth a thought: is [Settings](#/docs/settings) set to **Open sign-ups**? Is your site address right?

### On a trial

How many accounts are in a free trial that is still running. The note underneath says the trial length currently used for new sign-ups, for example "14-day trials". That figure comes from the **Free trial length for new sign-ups (days)** setting. See [Plans](#/docs/plans) and [Settings](#/docs/settings).

### Trials ending in 7 days

How many of those trials end within a week. The note reads "worth a nudge". These are your most valuable conversations: people who have tried the product and are about to hit read-only.

### All accounts

The total number of accounts since the start, with the note "since the start". This includes suspended, closing and ended accounts that have not been erased.

## Where accounts stand

A card of chips showing the current state of every account:

- **on trial** (blue);
- **paid** (green);
- **comped** (green), meaning free accounts that you gave and that never expire;
- **ended** (red), meaning a trial or paid period has run out.

The card's description says it is the current state of every account, not a history. The point of the card is to answer "where did my trials end up?". If you see many "ended" and few "paid", people are trying the product and not continuing. That is a conversation to have with them, perhaps through a short email, or a change to your trial length. If you see a big "comped" number, check you meant to give so many free accounts.

An account that was on a trial and you extended it is still counted as on trial. An account you turned into a free comped account counts under comped.

## Trials running

A table of every account on a running trial, soonest to end first. Columns:

- **Business**: the business name.
- **Reseller ID**: the account code.
- **Owner**: the owner's email, so you can write to them.
- **Days left**: a chip. It is blue normally and amber when 7 days or fewer remain. "1 day" is singular.
- **Last seen**: how long ago the account was last active, based on the later of the last sign-in, the last use of the app, and the day it was created.

If nobody is on a trial it says "No one is on a trial right now."

How to use it:

1. Look at the top rows: amber chips with a recent **Last seen** are engaged people about to lose write access. Reach out, thank them, and offer help to continue.
2. Amber chips with **Last seen** of many days ago are people who drifted away. A short check-in email may bring them back, and extending their trial may be fair.
3. Open [Accounts](#/docs/accounts) for the ones you want to help, use **Change plan** or **Extend trial** with a reason.

> A trial that ends does not delete anything. The account becomes read-only: the people can still sign in and look at their data, but cannot change it. The server also sends the owner a "trial ended" email by itself. See [Plans](#/docs/plans).

## Renewals, next 30 days

A table of accounts whose end date is within the next 30 days, soonest first. It shows:

- paid accounts that are running out, and paid accounts that have already lapsed;
- trials that are about to end, and trials that ended within the last 14 days.

Each row has the business name, Reseller ID, a chip showing **Paid** or **Trial**, the owner's email, and a chip showing the date. An amber chip reads "Ends" followed by the date. A red chip reads "Ended" followed by the date, for ones that have already passed.

Only plans with an end date appear. A paid account with no end date, and comped free accounts, never show up here because they do not expire. If there is nothing to show you will see "Nothing is due in the next 30 days."

Why it matters: renewals are how you keep revenue steady. Because payments are recorded by hand for now, this list is also your reminder list for chasing invoices.

A typical routine each Monday:

1. Open **Renewals, next 30 days**.
2. For each amber row, send the owner a renewal note.
3. For each red row, decide: wait, extend with a reason, or let them stay read-only.
4. When a payment arrives, open the account in [Accounts](#/docs/accounts), press **Record a receipt**, tick "Also set the plan to Paid through that date", and the row drops off the list once the new date is more than 30 days away.

## Gone quiet

A list of active accounts that nobody has signed in to for more than a week. Only accounts that are active (not suspended) and still able to write are shown, up to 50, the longest-quiet first. Each row shows the business name, Reseller ID, a chip with their plan state and "last seen" with how long ago.

If everyone has been around, it says "Everyone has been around in the last week."

Why it matters: a quiet account is an early sign of someone who will not renew, or of someone who got stuck. Often the cause is a technical one: they never confirmed their email, lost their authenticator, or never saved a recovery key and are worried. A friendly note from you can save the customer.

> Quiet is not the same as unhappy. A small business that does stock-takes monthly will look quiet. Use your judgement, and use the [Onboarding](#/docs/onboarding) page to see whether a quiet new account was stuck at setup.

## Putting Pipeline to work

Here are three simple patterns.

- **Daily glance (one minute).** Look at Sign-ups this week and Trials ending in 7 days. If the second number is above zero, plan the nudges.
- **Weekly review (ten minutes).** Work through renewals, gone-quiet and where accounts stand. Write down who you contacted so you do not nudge anyone twice.
- **After a change.** If you shorten or lengthen the trial length in [Settings](#/docs/settings), check Pipeline over the next weeks to see the effect on how many trials end up paid.

## Mistakes to avoid

- Assuming the lists update live. They do not; reopen the page.
- Reading "Last seen" as an exact sign-in time. It is the latest of several signals and is only a guide.
- Treating "Gone quiet" as accounts to suspend. Suspending is for abuse or non-payment, not for silence.
- Forgetting the owner's email is the address the account was created with. The person who really runs the business may be somebody else, so confirm before you share any account details.
- Sharing the lists. They contain customer names and emails; handle them as private.

## Related pages

[Overview](#/docs/overview) shows the same plan counts in one row. [Plans](#/docs/plans) explains trials, free and paid. [Onboarding](#/docs/onboarding) shows how far new accounts got through setup. [Accounts](#/docs/accounts) is where you act on what you find here.
