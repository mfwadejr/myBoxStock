---
title: Security
summary: Protect your own sign-in with two-factor and a strong password, manage the list of Host administrators, and know what the Owner can do when someone is locked out.
keywords: set up, sign-in lockout, lockouts survive restart, six wrong tries, security, two-factor, 2fa, totp, authenticator, recovery codes, password, administrator, owner, helper, temporary password, sign out, reset two-factor, add administrator, delete administrator, contact, lockout, reset-host-admin
order: 11
covers: nav:security, Two-factor authentication, Set up, Turn off, Password, Change password, Current, New, Update, Host administrators, Add administrator, Username, Email, Temporary password, Edit, Delete, Name, Cell number, Support actions, Reset two-factor, Set temporary password, Sign out everywhere, Owner, you, Last sign-in, Contact, Two-factor, reset-host-admin, Sign-in lockout, locked for 15 minutes, Unlock
---

## What this page is for

The Host Console can see every account on your server, manage plans, take backups and change settings. The **Security** page is where you protect that power. It has three parts: your own two-factor sign-in, your own password, and the list of Host administrators with the tools to manage it.

One important boundary to remember: even with full access, Host administrators cannot see any customer's business data. Customers own that data and hold the keys to it. Security here is about protecting the platform and the console, not about reaching into customer records.

> Treat a Host administrator sign-in like the keys to the building. Strong password, two-factor on, and nobody shares a login.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## Your two-factor authentication

Two-factor means that signing in takes two things: your password (something you know) and a six-digit code from an app on your phone (something you have). Even if someone learns your password, they cannot get in without the phone.

The card shows whether two-factor is on. When it is on it says a code from your authenticator app is required at sign-in. When it is off it says that is strongly recommended.

### Setting it up

1. Install an authenticator app on your phone if you do not have one. Any app that supports standard time-based codes works, such as 1Password, Google Authenticator or Authy.
2. On the Security page, click **Set up**.
3. Scan the picture with the app. If you cannot scan, use the key shown under it ("Can't scan? Enter this key") and type it into the app.
4. Type the six-digit code the app now shows and confirm. If the code does not match, check that your phone's clock is correct and try again. Codes change every 30 seconds.
5. A box titled "Save your recovery codes" appears. Write them down or save them in a password manager before you click "I've saved them". They will not be shown again.

### What recovery codes are

You get a set of recovery codes. Each one works only once and can stand in for the six-digit code if you lose your phone. When you use one at sign-in, the log notes it and one fewer remains. Keep them somewhere separate from the phone.

### Turning it off

The **Turn off** button appears when two-factor is on. It asks for your **Password** and a current **Authenticator code**. It removes your saved two-factor secret and your recovery codes. If you turn it on again later, you get a fresh secret and new codes.

Turning it off is rarely a good idea. If you are replacing your phone, set up again with the new phone instead.

> If you are a helper administrator, turning it off means you can no longer use the console until you set it up again. See "Helpers must have two-factor" below.

## Your password

The **Password** card has one button, **Change password**. It opens a box with three actions: type your **Current** password, type a **New** one, then press **Update**. A message says "Password updated".

Rules for a new password: at least 10 characters, with both letters and numbers. A longer phrase is better than a short complicated one. Use a password nobody has used with you before, and do not reuse one from another site.

Why change it: whenever you suspect someone has seen it, when you first sign in with a temporary password, and as a routine now and then. Changing it does not turn off two-factor.

You will be sent to a change-password screen right after signing in if your password was just set by the Owner or by the first-run setup. Complete it to continue.

## The Host administrators list

The **Host administrators** card lists everyone who can sign in at `/host/`. The columns are:

- **Administrator** is the username. An **Owner** label marks the Owner. If the person has a name on file, it appears below the username.
- **Contact** shows the email address and cell number if saved, or a dash.
- **Two-factor** shows a green **on** or an amber **off**.
- **Last sign-in** shows how long ago they last signed in.
- The last column holds buttons. Your own row shows a **you** label.

### The Owner and helpers

The Owner is the first administrator created, normally the one called `admin`. The Owner is the oldest account in the list. The Owner can never be deleted, and the role never moves to someone else. Everyone else is a helper.

The Owner manages the others. Helpers can change their own contact details and password, but cannot add, delete, reset or sign out anyone.

Why have helpers: so that a colleague can handle support without sharing your login. Each person's actions are written to the log under their own name, and you can remove one person without disturbing the rest.

### Adding an administrator (Owner only)

1. Click **Add administrator** above the table.
2. Type a **Username**. Use 3 to 40 characters: lowercase letters, numbers, dots, underscores or hyphens.
3. Type their **Email**. Their email lets them receive notices such as two-factor resets and backup failure messages.
4. Type a **Temporary password** of at least 10 characters with letters and numbers.
5. Click **Add**.
6. Give them the username and temporary password by a private channel such as a phone call or a password manager share, not in a group chat.

When they first sign in, they must choose a new password straight away, and then they must set up two-factor before the console opens.

### Helpers must have two-factor

Every helper must have two-factor on before they can use any part of the console. A helper without it can sign in but is stopped and asked to set it up first. The Owner is exempt from this rule, so that a mistake can never lock you out of your own server. That exemption is a reason for the Owner to turn two-factor on voluntarily, since the Owner is the account attackers will want most.

### Editing contact details

Click **Edit** on your own row to change your own details. The Owner can click **Edit** on anyone's row. The box has:

- **Name** (up to 100 characters).
- **Email**. It must look like a valid address, or be left empty.
- **Cell number**. Digits, spaces, plus, brackets, hyphens and dots, 6 to 30 characters, or leave it empty.

Click **Save**. A message says "Saved".

Why contact details matter: the Owner's email address is where problem alerts are sent (see [Alerts](#/docs/alerts)). Every administrator's email address is used for backup failure notices (see [Backups](#/docs/backups)) and for the note that tells them when their two-factor has been reset. If the Owner has no email address saved, alerts are not emailed to anyone.

### Support actions (Owner only)

When the Owner opens **Edit** for another administrator, a **Support actions** section appears. These are for a locked-out person or a lost phone. Each one is written to the log.

- **Reset two-factor** removes the person's two-factor secret and recovery codes, signs them out everywhere, and sends them an email if they have one on file. You must type their username to confirm. They must set up two-factor again at their next sign-in.
- **Set temporary password** replaces their password with a random one, signs them out everywhere and requires them to choose a new password at next sign-in. The temporary password appears once on a screen titled "Temporary password". Copy it and share it securely, because it is not shown again and is not saved in the logs.
- **Sign out everywhere** ends every open session for that person immediately.

You cannot use these on your own account, and the page says so if you try.

### Deleting an administrator (Owner only)

1. Click **Delete** on the person's row.
2. Type their username to confirm.
3. Confirm. They lose access immediately, their open sessions end, and any saved links of theirs are removed.

You cannot delete yourself, you cannot delete the Owner, and at least one administrator must always remain. Deleting cannot be undone, but you can add the person again with a new temporary password.

## What to do when someone is locked out

Work through these in order.

1. **A helper lost their phone.** The Owner opens Edit for them, uses **Reset two-factor**, then tells them to sign in and set it up again. If they also forgot their password, use **Set temporary password** as well.
2. **A helper forgot their password.** The Owner uses **Set temporary password**.
3. **Too many wrong tries.** After six wrong passwords or codes in a row for a sign-in name, that name is locked for 15 minutes. Waiting is one cure, and another Host administrator can press **Unlock** on the [Firewall](#/docs/firewall) page to end it sooner. Restarting the server does not help (see "Sign-in lockouts" below). Separately, the Firewall's sign-in limits can stop an address for a while. See [Firewall](#/docs/firewall).
4. **The Owner is locked out.** Another person cannot reset the Owner. Use a recovery code if you have one. If not, on the server run `node server.mjs reset-host-admin`. It prints a temporary password for the Owner account (the oldest administrator), clears its two-factor, and signs every Host administrator out. You must choose a new password at the next sign-in and set two-factor up again.
5. **You cannot reach the console at all** because of an address list or a proxy setting. See [Recovery and emergencies](#/docs/recovery-and-emergencies).

> Do the command-line reset on the server itself, and only if you are the person responsible for the server. Anyone with access to the server can use it, which is why the server's own access needs protecting too.

## Sign-in lockouts

To stop password guessing, a sign-in name is locked after **six wrong attempts in a row**. A wrong password and a wrong two-factor code both count. The lock lasts **15 minutes**, and during it even the right password is refused with a message to try again later. This is the same for Host administrators and for resellers' users.

- The count of wrong attempts is saved, and a saved count is dropped one hour after the last wrong attempt. So a few wrong tries spread over a short time still add up.
- A correct sign-in before the sixth wrong try resets the count to zero.
- **Lockouts survive a restart.** An active lockout, and the count that leads to one, are saved in the database and loaded again when the server starts, including the restart that follows an update. Restarting the container no longer lets someone in early, and it no longer clears a lock for you. Waiting 15 minutes does.
- A refused sign-in because the account is suspended, closing or disabled is not counted as a wrong attempt.
- The number of tries and the length of the lock cannot be changed. A Host administrator can end a lock early with **Unlock** (Firewall page, or a person's tools in [Accounts](#/docs/accounts)). It clears the lock and the count, never shows or changes a password, and is written to the Audit trail as "Sign-in unlocked". A locked-out Host administrator cannot unlock themselves, because they cannot sign in: another administrator does it, or they wait.
- A Host Console lockout is written to the [Audit trail](#/docs/audit-trail) as "Host Console sign-in locked", an unlock as "Sign-in unlocked", and every wrong attempt is in [Logs](#/docs/logs). Lockouts of resellers' users are in Logs only.

Separately, the Firewall limits how many sign-in attempts one address can make in a few minutes, and bans addresses that keep breaking limits. See [Firewall](#/docs/firewall).

## What Host administrators cannot do

It bears repeating because it shapes what you tell your customers. Host administrators can suspend an account, change its plan, reset a user's password or two-factor for support, and delete an account on request. They cannot read inventory, sales, customers or any other business records. Those are encrypted with keys that belong to the customer. A customer who loses both their password and their recovery key has lost access to their own data, and no Host administrator and no backup can bring it back. Customers are responsible for their own recovery key and their own exports.

Resetting a customer's password or two-factor is a support convenience for sign-in only. It does not give anybody access to the customer's data.

## Mistakes to avoid

- Skipping recovery codes and then losing the phone.
- Sending a temporary password in the same message as the username in a public place.
- Turning off two-factor "just for now" and leaving it off.
- Leaving the Owner's email blank, so alerts go nowhere.
- Deleting a helper and forgetting that their open console tab is closed immediately. Tell them first.
- Expecting a helper to be able to do the Owner's jobs. Only the Owner can add, delete, reset and sign out.

## Related pages

- [Getting started](#/docs/getting-started) for first sign-in and changing the first password.
- [Audit trail](#/docs/audit-trail) and [Logs](#/docs/logs) show who did what, including your own sign-ins, two-factor changes and lockouts.
- [Alerts](#/docs/alerts) and [Backups](#/docs/backups) use the contact details described here.
