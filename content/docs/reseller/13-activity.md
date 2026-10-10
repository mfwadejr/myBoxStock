---
title: Activity
summary: See who has signed in to your account, from where, and which devices are signed in right now, and sign people out when you need to.
keywords: activity, sign-in history, sessions, devices, sign out, sign out everyone, new location, wrong password, blocked, IP address, login alerts, who signed in, returns history, who processed a return
order: 13
covers: nav:activity, Where people are signed in, Sign out everyone else, Sign out everyone, Person, Device, IP address, Started, Last active, This device, Sign out, Team sign-in history, When, Result, Signed in, Wrong password, Wrong code, Blocked, New location, Load more, Showing N of M sign-ins, Nothing recorded yet, new sign-in email, Returns and refunds, Processed by, Credit note
---

## What the Activity page is for

The Activity page answers two simple questions about your business account:

1. **Who is signed in right now, and on which device?**
2. **Who has tried to sign in recently, from where, and did it work?**

Think of it as the guest book and the door-log for your shop. You would not leave a physical shop without knowing who holds a key. In the same way, this page shows you every person and device that can currently reach your account, so you can spot anything that does not look right and close the door on it.

The page is called **Activity** in the menu. It is only shown to people with the **Administrator** role. If a person with another role (Standard or View) opens it, they see a short note saying that only administrators can see team activity. Everyone, including non-administrators, can still see their own sign-ins and their own devices at the bottom of the [Security](#/docs/security) page.

> Activity shows facts about signing in: names, times, devices and network addresses. It never shows your inventory, customers or sales. Those are encrypted in your browser and are covered in [Your data, your responsibility](#/docs/your-data-your-responsibility).

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## Where people are signed in

The first card on the page is titled **Where people are signed in**. It lists every sign-in that is currently open on your account, for the whole team. Each row is one device or browser that is signed in. A person who uses a laptop and a phone will appear twice.

![The Activity page with where people are signed in and the team sign-in history](shot:reseller-activity-1 "The Activity page: who is signed in, and recent sign-in attempts.")

The table has these columns:

- **Person**: the full sign-in name of the person, which is their username followed by your Reseller ID.
- **Device**: a short description worked out from the browser, for example the browser name and the kind of computer or phone. It is a good guess, not a guarantee.
- **IP address**: the network address the sign-in came from. At a shop or home it is usually the same for every device on that internet connection. A phone on mobile data will show a different one.
- **Started**: the date that sign-in began.
- **Last active**: how long ago that device last talked to the account, shown in plain words such as "5 minutes ago". The page records this at most about once a minute, so it is close, not exact.
- A final column with a **Sign out** button on every row except your own.

The row for the device you are using right now carries a blue **This device** label. It has no Sign out button, so you cannot lock yourself out by accident from this table.

If nobody is signed in the table shows "No active sessions." You will always see at least yourself, so in practice this appears only if something unusual is going on.

### How long a sign-in lasts

A sign-in stays open for up to 14 days from when it began, unless the person signs out sooner or someone signs them out. After that, they sign in again. Entries are removed automatically once they expire.

Two-step sign-ins that were never finished (for example, someone typed the right password but never entered the authenticator code) are not listed as signed in.

### Sign out one device

Use this when a single device should no longer have access: a phone that was lost, a laptop at a former helper's home, or a browser you see that nobody recognises.

1. Open **Activity** in the menu.
2. In **Where people are signed in**, find the row. Check the **Person**, **Device** and **Last active** columns to be sure it is the right one.
3. Click **Sign out** at the end of that row.
4. A short "Signed out" message appears and the row disappears from the list.

The device is signed out straight away. The next time that browser contacts your account it will be shown the sign-in page. Nothing is deleted: the person's login, their password and your data are all untouched. They can simply sign in again with their password (and their authenticator code if they use two-factor).

### Sign out everyone else

The **Sign out everyone else** button sits at the top right of the card. Use it when you want to end every sign-in on the account except the one you are using.

1. Click **Sign out everyone else**.
2. A box asks "Sign out everyone else?" and explains that everyone except you will have to sign in again on every device.
3. Click **Sign out everyone else** in the box to confirm, or cancel to back out.

Good times to use it:

- A staff member has left and you want to be certain none of their devices is still open. (Then also use the [Team](#/docs/team) page to turn off or remove their login, otherwise they can simply sign in again.)
- You see a device or an address you do not recognise.
- You have changed something important, such as a password, and want everyone to start fresh.

### Sign out everyone

The red **Sign out everyone** button ends every sign-in, including your own.

1. Click **Sign out everyone**.
2. A box asks "Sign out everyone?" and says that everyone, including you, will have to sign in again.
3. Confirm with **Sign out everyone**. You are returned to the sign-in page.

Use this one when you want a clean slate, for example after a lost laptop that belonged to you, when you are not sure which row is the unknown one.

> Signing someone out does not stop them signing in again with a correct password. If the real problem is that someone should not have access at all, turn off or remove their login on the [Team](#/docs/team) page. If the problem is that someone may know a password, change it (see [Security](#/docs/security)) or use **Reset access** on the Team page.

## Team sign-in history

The second card is titled **Team sign-in history**. It is a log of sign-in attempts for everybody on the account, newest first. The newest 100 entries are shown at a time. The columns are:

- **Person**: whose login was used.
- **When**: the date and time of the attempt.
- **Result**: a coloured label saying what happened (see below).
- **IP address**: where the attempt came from.
- **Device**: the browser and computer or phone type.

If nothing has been recorded yet the card says "Nothing recorded yet."

### What the results mean

- **Signed in** (green): the sign-in worked.
- **Wrong password** (red): somebody entered the right username with the wrong password.
- **Wrong code** (red): the password was right but the two-factor code or recovery code was wrong.
- **Blocked** (amber): the attempt was refused, for example because there had been too many failed tries in a short time. After six wrong attempts the account's sign-in is paused for 15 minutes to protect it. The person who runs the site can end the pause early (an "unlock"); that never shows or changes anyone's password.

### Repeat counts and New location

Two small extras can appear next to the result:

- **x 3** (a small grey count): several identical failures from the same address within about ten minutes are grouped into one line instead of filling the list. The number tells you how many.
- **New location** (amber): a successful sign-in from an address that this person had never signed in from before. The very first sign-in a person ever makes is not marked, because there is nothing to compare it with.

A New location label is not proof of anything bad. It is normal when someone signs in from a new internet connection, travels, or switches from Wi-Fi to mobile data. It is a prompt to check: "Was that you?"

### Load more

The history shows the newest 100 entries. On a tablet, laptop or desktop it sits in a box about 640 pixels tall that scrolls on its own, and a line under it says "Showing 100 of 340 sign-ins". Press **Load more** to add the next 100 older entries. When there is nothing older the button disappears. On a phone there is no inner box: the whole page scrolls instead, and **Load more** is at the bottom of the list. The same works in **Recent sign-ins** on your [Security](#/docs/security) page.

### How long history is kept

Your site administrator decides how many days of sign-in history are kept. The default is 90 days, and older entries are removed automatically. If you need a record for longer than that, write down or screenshot anything important before it expires.

## Returns and refunds

Below the sign-in history, Administrators see a **Returns and refunds** card. It lists every return processed on the account, newest first: when, the credit note number, the receipt it belongs to, how many devices, the amount refunded and who processed it (with their user type). Click a row to open the credit note. Every return is also written to the site's activity log with the person who processed it, whatever their user type, but never customer names or details. See [Returns and refunds](#/docs/returns-and-refunds).

## New sign-in email alerts

When a person signs in successfully from an address they have never used before, and that person has an email address on their login, the site sends them an email telling them the time, the device and the address. This is the same event that shows as **New location** in the history.

Why this is useful:

- If it was you, you can ignore the email.
- If it was not you, you can act quickly: change your password, sign out the other devices, and tell your administrator.

For these emails to arrive, three things must be true: the person has an email address saved, your site's email is working, and the message is not caught in a spam folder. Ask people to keep their email address up to date on the [Security](#/docs/security) page. If you never receive such emails, ask your site administrator whether email is set up.

## Examples and routines

**A weekly look.** Once a week, open Activity and scan the history. You are looking for red labels you do not recognise, amber **New location** labels for people who were not travelling, and sign-ins at odd hours. It takes a minute.

**When a staff member leaves.**

1. Open **Team** and turn off or remove their login.
2. Open **Activity** and click **Sign out** on any rows that still show their name, or use **Sign out everyone else**.
3. Check the history over the next few days for **Wrong password** entries under their name. These suggest someone is still trying.

**Someone lost a phone.** Ask the person to change their password from [Security](#/docs/security) on another device, then use **Sign out** on the row for the lost phone. Because your business data is encrypted and kept in the browser only while it is open, a signed-out device cannot read it again without the password.

**A burst of Wrong password entries.** Many red lines from one address usually mean somebody guessing. Two-factor sign-in (see [Security](#/docs/security)) makes guessing far less useful. Consider asking everyone on the team to turn it on.

## Common mistakes

- **Thinking Sign out removes a person.** It only ends the current sign-in. Use the [Team](#/docs/team) page to turn off or delete a login.
- **Using Sign out everyone by accident.** It signs you out too. Use **Sign out everyone else** if you want to stay signed in.
- **Ignoring New location.** It is worth thirty seconds to ask the person.
- **Expecting to see inventory changes here.** This page is only about signing in.
- **Expecting very old history.** Entries are removed after the retention period set by your site administrator.

## If your plan is read-only

If your trial or paid period has ended, your account is read-only (see [Plans, trials and billing](#/docs/plans-trials-billing)). You can still open Activity and look at everything, but the sign-out buttons count as changes and are refused with a message explaining that the account is read-only. Contact your site administrator to continue.

## Related pages

- [Security](#/docs/security) for your own password, two-factor and your own devices.
- [Team](#/docs/team) for adding, turning off and removing people, and for resetting access.
- [Troubleshooting and FAQ](#/docs/troubleshooting-faq) if someone cannot sign in.
