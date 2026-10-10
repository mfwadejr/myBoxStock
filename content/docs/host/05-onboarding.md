---
title: Onboarding
summary: See how far each new account gets through setup (created, email confirmed, first sign-in, recovery key saved, plan started), which accounts are Free, whose trial or paid period has ended, and use it to find the people who need help.
keywords: onboarding, free chip, free accounts, plan ended, trial ended, paid ended, finished setup, load more, long lists, setup funnel, new accounts, stuck, stopped at, email confirmed, first sign-in, recovery key, plan started, last 30 days, last 90 days, all time, nudge, activation
order: 5
covers: nav:onboarding, Terms and Privacy acceptance, Terms accepted, Last 30 days, Last 90 days, All time, Setup funnel, Account created, Email confirmed, First sign-in, Recovery key saved, Plan started, Account by account, Business, Reseller ID, Age, Email, Signed in, Recovery key, Plan, Stopped at, done, not yet, finished, Load more, Showing N of M accounts, Free accounts, Trial or paid period ended, Plan ended, Trial ended, Paid ended, Finished setup, free
---

## What this page is for

A new customer has to do a few things before the product is really theirs: confirm their email address, sign in, save their recovery key and start a plan. Some people sail through. Others stall at one step and never come back. Onboarding shows you where people stop, so you can fix the step if many people stall at the same place, and so you can write to the individuals who are stuck.

The page uses only facts the server already holds: identity and setup status. It never looks inside an account, and could not, because the data is encrypted in the customer's browser. The page subtitle says: use it to see where people stop, and who to nudge.

> Onboarding explains why a customer has not got going. It cannot tell you whether they are using the product well. Only they know that.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

![Onboarding](shot:host-onboarding "Onboarding: the setup funnel and account-by-account progress.")

## Choosing the time range

At the top is one drop-down with three choices:

- **Last 30 days** (the default);
- **Last 90 days**;
- **All time**.

It filters by when the account was created, not by when anything happened. Choose a short range to judge the effect of something you changed recently, such as a new welcome announcement or a fix to email. Choose a longer range for a steadier picture when you have few sign-ups. The page lists up to 500 accounts, newest first.

Changing the range reloads the page with that range, and your choice is remembered for as long as you stay in the console.

## The setup funnel

The first card is called **Setup funnel**. Under the title it says how many accounts were created in this period (for example "12 accounts created in this period"). Below that are five steps, each with a count and a bar. The bar for each step is drawn relative to the first step, so you can see how many fall away.

The five steps, in order:

1. **Account created**: every account in the range, by definition.
2. **Email confirmed**: at least one person in the account has a confirmed email address. Accounts from before email confirmation was introduced are counted as confirmed too.
3. **First sign-in**: at least one person in the account has signed in.
4. **Recovery key saved**: the customer has confirmed that they saved their recovery key. This is the step that protects their data.
5. **Plan started**: the account is on a plan that is running: a trial that has not ended, a paid period that has not ended, or **Free** (comped). Free counts as done, because it is the final step and you chose it. The page uses the same plan rule as the [Accounts](#/docs/accounts) page, so the two always agree on who is Free and who has ended. A trial or paid period that **has ended** does not count as started any more: that account is flagged **Plan ended** instead (see below).

Under the five bars a line shows two extra counts: **Free accounts** (how many accounts in this period are Free, so comped accounts stand out) and **Trial or paid period ended** (how many have a **Plan ended** flag, so you can see who to nudge).

### Reading the funnel

A funnel nearly always narrows as it goes down. What matters is where it narrows sharply.

- **Big drop at Email confirmed.** People sign up but never click the link. Likely causes: email is not working, the message goes to spam, or the site address in [Settings](#/docs/settings) is wrong so the link breaks. Check [Email](#/docs/email) first, send a test, and look at the wording of the confirmation message under the Messages tab.
- **Drop at First sign-in.** They confirmed but never came back. Maybe the sign-in format confused them (customers sign in with a username and the Reseller ID, such as `username@BX-ABC123`). A clear welcome message helps.
- **Drop at Recovery key saved.** This is the one that worries you most. A customer who never saved the key is relying on remembering every credential. If they lose them, their data is gone, and you cannot get it back. Nudge these people. The [Accounts](#/docs/accounts) health filter **No recovery key saved** lists them too.
- **Drop at Plan started.** Free accounts are counted as started, so a drop here usually means trials or paid periods that have **ended** (the **Trial or paid period ended** count tells you how many). Check **Plan** in Accounts, and write to those customers if you want them to continue.

## Account by account

The second card is a table, newest first. The description says "Stopped at" is the first step not done yet. Columns:

- **Business**: the business name.
- **Reseller ID**: the account code.
- **Age**: how many days since the account was created, for example "3d".
- **Email**: whether email is confirmed.
- **Signed in**: whether anyone has signed in.
- **Recovery key**: whether the recovery key is saved.
- **Plan**: whether a plan is running. Free accounts show a blue **free** chip. An account whose trial or paid period has ended shows a red **Trial ended** or **Paid ended** chip. Anything else shows **done** or **not yet**.
- **Stopped at**: the name of the first step not yet done, **Plan ended** when everything else is done but the trial or paid period has run out, or a green **Finished setup** chip when every step is done. A step that is already done is never shown here.

Each of the step columns shows a green chip saying **done** or a plain chip saying **not yet**. On a phone every row becomes a card with the same chips, and nothing scrolls sideways.

If no accounts were created in the chosen range you will see "No accounts in this period."

### Long lists

The **Account by account** table can be long. On tablets and computers it scrolls inside a box of its own, about 640 pixels tall, with a line such as "Showing 100 of 180 accounts" and a **Load more** button that adds 100 more. On phones there is no box: the rows become cards and the page scrolls. The range menu stays above, so a new choice reloads the list from the top.

### Example

Suppose a row shows Age 2d, Email done, Signed in done, Recovery key not yet, Plan done (or the blue free chip), Stopped at "Recovery key saved". That customer is up and running but has not saved their recovery key. A short, friendly email from you that explains why the key matters, and that you cannot recover their data for them, is exactly the right nudge.

Another row shows Age 9d, Email not yet, everything else not yet, Stopped at "Email confirmed". Here, try this order: look up the account in [Accounts](#/docs/accounts), open the person with **Manage**, and press **Resend the confirmation email**. If their email address is wrong or unreachable, contact them another way and, only if you have verified them, use **Mark as confirmed**.

## How to use it to help people: a routine

1. Open **Onboarding** with **Last 30 days**.
2. Read the funnel. Note the step with the biggest drop.
3. Scroll to Account by account. Skip rows that are younger than a day or two, since people need time.
4. For each stuck row older than a few days, open [Accounts](#/docs/accounts) and search by Reseller ID.
5. Use the right tool for the stuck step:
   - **Email confirmed**: Resend the confirmation email.
   - **First sign-in**: Email a password reset link, which doubles as a gentle reminder, or write to the owner.
   - **Recovery key saved**: write to the owner; there is nothing you can click for them.
   - **Plan ended** (red chip): the trial or paid period has run out and the account is read-only. Write to the owner, or open the account and use **Change plan** or **Record a receipt**.
6. Note what you did. Support history in the account records your actions.

> Be careful what you promise. You can restore access to the account, but you cannot recover data that was encrypted for a key the customer has lost. Be clear in your message to the customer about that, and encourage them to also keep their own exports.

## What to do with the whole picture

- If most new accounts finish, you are doing well; keep the welcome email wording clear.
- If many stop at the same step, fix the cause rather than nudging each person. Examples: repair the email setup, correct the site address, reword a message in [Email](#/docs/email), or add a line to the [announcement banner](#/docs/settings) such as "Please save your recovery key when you first sign in."
- Compare ranges. If Last 30 days looks much worse than Last 90 days, something changed recently. Check [Updates](#/docs/updates) and [Logs](#/docs/logs).

## Terms and Privacy acceptance

Accepting the Terms of Service and Privacy Policy is not a funnel step, because the sign-up form will not create an account without it: every new account has accepted. You can see the accepted version and time under **Terms** on each account's sheet in [Accounts](#/docs/accounts). Accounts created before the Terms were introduced show **Not accepted yet**; their Administrators are asked once at their next sign-in. When the Terms change, the same happens for every account, so a rise in people who stop at sign-in just after an update may simply be the **Updated terms** screen.

## Mistakes to avoid

- Treating Free accounts as failures. They are intentionally free, are counted as done, and carry their own **free** chip.
- Ignoring red **Trial ended** and **Paid ended** chips. Those accounts are read-only until you act.
- Nudging brand-new accounts too early. Give people a couple of days.
- Asking customers to send you their recovery key. Never do that, and never accept it. The key is theirs alone.
- Treating **Finished setup** as success. It only means the setup steps are done.

## Related pages

[Pipeline](#/docs/pipeline) covers trials and renewals. [Accounts](#/docs/accounts) holds the support tools. [Plans](#/docs/plans) explains trial and free states.
