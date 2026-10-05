---
title: Accounts
summary: Find a customer account, check its health, and use the support tools: suspend, reset passwords and two-factor, temporary passwords, plan changes, receipts, closing and erasing.
keywords: accounts, search, customer, support, suspend, reactivate, reset password, temporary password, two-factor reset, 2FA, confirm email, resend, mark confirmed, sign out everywhere, disable sign-in, delete user, delete account, closing, restore, erase, plan, extend trial, receipt, support history, host link, health filter, recovery key
order: 3
covers: nav:accounts, Search by business Reseller ID or email, All plans, On trial, Free (comped), Paid, Ended / read-only, Any health, No recovery key saved, No two-factor, Email not verified, Inactive 30 days, Encryption not set up, Closing, Suspended, Business, Reseller ID, Owner, Users, Plan, Status, Health, Last sign-in, Account sheet, Change plan, Extend trial, Suspend, Reactivate, Record a receipt, Remove receipt, Plan history, Support history, Allow this account to link a Host administrator, People, Manage, Delete, Restore, Email a password reset link, Resend the confirmation email, Mark as confirmed, Set a temporary password, Reset two-factor authentication, Sign out everywhere, Disable sign-in, Enable sign-in, Delete this user, Reason
---

## What this page is for

Accounts is where you help customers. Most of what customers ask you for falls into a few groups: "I cannot sign in", "I lost my authenticator", "I never got the confirmation email", "please extend my trial", "please close my account". Everything you need for those is here.

It is just as important to know what is not here. You will never see a customer's inventory, sales, customers or receipts. Their data is encrypted in their own browser before it reaches the server, so even the Host cannot read it. At the top of every account sheet a blue note says it plainly: you can help with sign-in and security, and business data is not visible to host administrators.

> The customer owns their data and is 100 percent responsible for it, for saving their recovery key, and for making their own exports. Resetting a password or two-factor lets someone sign in again. It does not give anyone the ability to read data they could not already open. If a customer loses their recovery key and every device, the data cannot be recovered by you.

## The account list

Open **Accounts**. Under the heading is the reminder that inventory, sales and customers are private. The list shows up to 500 accounts, newest first.

### Searching

Type in the box that says "Search by business, Reseller ID or email". It matches part of the business name, the Reseller ID (a code like `BX-ABC123` which is the customer's account identifier) or the owner's email. The list updates a moment after you stop typing.

Why: customers rarely know their Reseller ID but always know their business name and email. If they quote a Reseller ID, search for it exactly to avoid mixing up two businesses with similar names.

### The plan filter

The first drop-down narrows by plan:

- **All plans** (no filter).
- **On trial**: accounts in a running free trial.
- **Free (comped)**: accounts you gave a free plan that never expires.
- **Paid**: paid accounts still in date.
- **Ended / read-only**: trials or paid periods that have run out. These accounts can look but not change anything.

### The health filter

The second drop-down finds accounts that need a nudge. It only uses identity and security facts.

- **Any health** (no filter).
- **No recovery key saved**: encryption is set up but the customer has not confirmed saving their recovery key. This is the most important filter, because without the key, forgotten credentials mean lost data. Contact these customers.
- **No two-factor**: none of the account's Administrators has two-factor on.
- **Email not verified**: someone in the account has an email address that has not been confirmed.
- **Inactive 30 days**: nobody has signed in for 30 days (or the account is more than 30 days old and nobody ever has).
- **Encryption not set up**: the customer never finished setting up their data encryption.
- **Closing**: accounts in the 7-day closing period.
- **Suspended**: accounts you have switched off.

You can combine search, plan and health. Use **Closing** at the start of each week so nobody is erased by surprise.

### The columns

- **Business** is the business name.
- **Reseller ID** is the account code.
- **Owner** is the owner's email.
- **Users** is how many people the account has.
- **Plan** shows Trial, Trial ended, Free, Paid or Paid ended, with "days left" for running ones.
- **Status** shows green "active", red "suspended", or a red "Closing, erases" with the date.
- **Health** shows chips: "No recovery key", "Not encrypted", "2FA off", "Email not verified", or a green "Good" when none apply.
- **Last sign-in** shows how long ago anyone last signed in, or "never".

Click any row to open that account's sheet.

## The account sheet

The sheet is a pop-up with these sections from top to bottom. Press **Done** to close it.

### Header, Closing and Data

The name, status chip, Reseller ID and creation date. If the account is closing, a red bar says when it will be erased and offers **Restore**. The **Data** section says whether the account is **Encrypted** or "Not set up yet", and how many "stored records" exist. The count is of opaque encrypted blobs. It tells you whether the account has ever stored anything, never what it is.

### Plan, Change plan and Extend trial

Shows the current plan, any note, the end date ("Ends" or "Ended"), and whether the account is read-only. "Plan history" can be expanded to list every change with date, who made it and the reason.

**Change plan** opens a form:

1. Choose **Plan**: "Free, comped, never expires", "Free trial" or "Paid".
2. For a trial, set **Trial length (days)** (1 to 730, default 14). Tick "Add to the current end date instead of starting today" to extend instead of restarting.
3. For paid, optionally set **Paid through** (a date). Leave it empty for no end date.
4. Write a **Reason (saved in the account's history)**.
5. Press **Save plan**.

**Extend trial** is a shortcut that appears only for accounts on a trial. It opens the same form with Free trial chosen and the add-to-current box ticked. Why: a customer who got busy in week one deserves another week, and extending is kinder than restarting. See [Plans](#/docs/plans).

### Support tools: Suspend and Reactivate

**Suspend** signs everyone in the account out and stops anyone from signing in until you press **Reactivate** (the same button changes its name). Both ask for a **Reason**. Use suspend for non-payment, abuse or a hijacked account. It does not delete anything.

### Receipts

**Record a receipt** writes down money received outside the app, such as a bank transfer. Fields:

- **Amount received** (for example 29.00) and **Currency** (a three-letter code, default USD).
- **How it was paid** and **Reference** (invoice or transfer number).
- **Paid through (optional)** and a tick-box "Also set the plan to Paid through that date".
- **Note**.

Press **Save receipt**. Each saved receipt appears with a **Remove** button, which asks for a reason. This is only a record. Nothing is charged by the app. See [Plans](#/docs/plans).

### Support history

Lists up to the 15 most recent actions Host administrators took on this account, with date, who, what and the reason you gave. It is the quickest way to answer "did anyone already reset this?" before you do it again.

### Site admin linking

A switch labelled "Allow this account to link a Host administrator". When on, the Link option appears in that account's own Security page, so someone who both runs the site and a reseller account can switch between the two. It is off by default. Only the Owner administrator can change it; for everyone else the switch is greyed out. Turning it off removes existing links. Why you might use it: you run a reseller account yourself and want a quick switch. Otherwise leave it off.

### People

Every person in the account, with chips for their role, **2FA**, **disabled**, and **Verified** or "Not verified" email, plus their login and last sign-in. Press **Manage** beside a person for their tools.

### Delete

The red **Delete** button erases the whole account immediately. See "Closing, restoring and erasing" below.

## Managing a person

Pressing **Manage** opens a list of buttons. Several are greyed out when they make no sense, for example a person with no email.

1. **Email a password reset link**: queues an email with a link valid for one hour. Needs an email on file and asks for a **Reason**. This is the first thing to try for "I forgot my password".
2. **Resend the confirmation email**: sends the "please confirm your address" email again. Enabled only for people with an unconfirmed email. If email is not set up it tells you; if one was sent a moment ago, wait a minute; there is also a daily limit per person.
3. **Mark as confirmed**: marks the email confirmed without the customer clicking. Use it only when you have checked another way, such as by phone. It requires a reason such as "confirmed by phone".
4. **Set a temporary password**: creates a one-time password, signs the person out everywhere and forces them to choose a new one at next sign-in. It is shown only once in a box, so copy it and give it to them through a safe channel. It is never written to the log.
5. **Reset two-factor authentication**: switches off two-factor and clears their recovery codes, signs them out, and emails them that it happened. They set it up again on next sign-in. Enabled only when they have two-factor on.
6. **Sign out everywhere**: ends all of their sessions on every device.
7. **Disable sign-in** (or **Enable sign-in**): stops (or restores) one person's ability to sign in, without touching the rest of the account. Disabling also signs them out.
8. **Delete this user**: removes the person from the account permanently. You must type their login to confirm. You cannot delete the last Administrator of an account; delete the whole account instead.

All of these ask for a **Reason** except Resend the confirmation email and Delete this user (which asks you to type the login instead). A reason is a few words (at least 3 characters, up to 200). It is saved in the log with your name and shown in Support history. Good reasons are specific: "Owner called, lost phone", not "ok".

> Before resetting two-factor or setting a temporary password, make sure the person is who they say they are. Phone back a number you already hold, or reply to the owner's email address. Someone who tricks you into a reset takes over the account's sign-in.

### Typical cases

- **Forgot password**: Email a password reset link. If their email is wrong or unavailable, Set a temporary password.
- **Lost phone with authenticator**: Reset two-factor authentication, then tell them to set it up again.
- **No confirmation email**: Check [Email](#/docs/email), try Resend, and as a last resort Mark as confirmed.
- **Employee left**: Disable sign-in or Delete this user; the account's own Administrator can also do this.

## Closing, restoring and erasing

There are two ways an account ends.

1. **The customer closes it.** From their own app, an Administrator starts closing. The account locks for 7 days (staff are signed out; Administrators can still look around and export) and then the server erases it automatically. During those 7 days you see "Closing, erases" with a date in the list and a **Restore** button in the sheet. Press **Restore** to cancel closing if the customer asks you to; it does not need a reason prompt.
2. **You delete it.** The red **Delete** button asks you to type the account's Reseller ID and then erases the account, its people, keys and records at once. It cannot be undone and the system keeps no copy. A backup of the server may still contain it, so see [Backups](#/docs/backups).

> Erasing is permanent for the customer's data. Because the data belongs to them, they should have exported it first. Only erase early when the customer has asked you to or when you have a clear reason, and write it down.

## What you can and cannot see

You can see: business name, Reseller ID, owner email, people and their logins, roles, two-factor and email status, last sign-in, plan and billing records, whether encryption is set up, how many encrypted records exist, and the support history.

You cannot see: inventory, sales, customers, receipts to their customers, the contents of any record, or their recovery key. You cannot read their data, change it, or recover it.

Related pages: [Pipeline](#/docs/pipeline), [Onboarding](#/docs/onboarding), [Plans](#/docs/plans), [Audit trail](#/docs/audit-trail) and [Logs](#/docs/logs), where every action above is also recorded.
