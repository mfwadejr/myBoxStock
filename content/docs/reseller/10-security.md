---
title: Security
summary: Look after your own sign-in: change your password, turn on two-factor, confirm your email, manage the recovery key, and see your own devices.
keywords: security, terms, privacy policy, updated terms, accepted terms, site admin, name menu, account menu, sign out, closing account, close account, erased, what backups keep, password, change password, two-factor, 2FA, authenticator, recovery codes, recovery key, email, confirm email, host administrator, link, export, close account, encryption, forgot password, temporary password, unlock
order: 10
covers: nav:security, Terms of Service, Privacy Policy, Updated terms, Accept and continue, Legal links, Site admin, name menu, account menu, Closing your account, Export everything first, Your password, Close this account, Restore account, closing account erase date, Reseller ID, username, Two-factor authentication, Set up, Turn off, authenticator code, recovery codes, I've saved them, Email address, Change email, Send confirmation, Send it again, Password, Change password, Current password, New password, Recovery key, Create new recovery key, Download, Print, I have saved my recovery key somewhere safe, Host administrator, Link Host administrator, Remove link, Your data, Export everything, Close my account, Close account, Restore account, Encryption, Where you're signed in, Recent sign-ins, Forgot password, Unlock your data, Account deleted by the Host, account erased email
---

## What the Security page is for

The **Security** page is where you look after your own way into the account. Every person on the team has it, whatever their role, and each person sees and changes only their own settings. A few extra cards appear for Administrators only (the recovery key, the link to a Host administrator sign-in, and the export and close-account tools). Backups have their own page, [Backup and restore](#/docs/backup-and-restore). Those are marked below.

Why it matters: your account holds your stock, your customers and your sales history. Your password and your recovery key are the only things that can open that information, and nobody else can open it for you. Spending ten minutes here once is the best protection you can give your business. For the bigger picture, read [Your data, your responsibility](#/docs/your-data-your-responsibility).

At the top of the page you see your **Reseller ID** and your **username**. The Reseller ID is the account name that looks like `amber-fox-4271`. You need both, plus your password, to sign in. Write the Reseller ID down somewhere safe; it was in your welcome email, and an Administrator can tell you if you lose it. The sign-in page remembers the Reseller ID on a browser you have used before, so you then only need your username and password.

> If you have not confirmed your email address, a blue banner appears at the top of this page and of Home. See the email section below.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## Two-factor authentication

The first card is **Two-factor authentication**. It is optional, and it is a very good idea. Once on, signing in needs two things: your password, and a six-digit code from an app on your phone. A stranger who learns your password still cannot get in without your phone.

The card says either "Optional, and a good idea. Adds a code from your phone at sign-in." (when it is off) or "On." (when it is on).

### Turning it on

You need an authenticator app on your phone, such as 1Password, Google Authenticator or Authy.

1. Click **Set up**.
2. A box titled "Set up two-factor" shows a square code (a QR code). In your authenticator app, choose to add an account and scan it.
3. If you cannot scan it, type in the long key shown under the code ("Can't scan? Enter this key") instead.
4. Type the six-digit number your app now shows into the box.
5. Click **Turn on**. If the code is refused, check that your phone's clock is correct and try the next code.
6. A second box, "Save your recovery codes", shows eight codes. Each code works once if you lose your phone. Copy or write them down somewhere safe, then click **I've saved them**. They will not be shown again.

### Signing in with two-factor

After you enter your password, a screen titled "Two-factor code" asks for the six-digit code from your authenticator app, or a recovery code. Type it and click **Verify**. If you use a recovery code, that code is used up; keep the rest for later.

### Turning it off

1. Click **Turn off**.
2. In the "Turn off two-factor" box, enter your **Password** and the current **Authenticator code**.
3. Click **Turn off**.

Turning it off also throws away your old recovery codes. If you turn it on again later you get a fresh set.

> Two-factor protects your sign-in. It is not the same as the recovery key, which protects your data. Keep both.

Common mistakes: scanning the code and then forgetting to type the first six-digit number (it is not on until you do); not saving the recovery codes; and losing the phone with no recovery codes. If you lose both your phone and your recovery codes you cannot complete sign-in, because **Reset access** on the [Team](#/docs/team) page changes a password but does not switch two-factor off. In that case contact your site administrator, and keep your recovery codes somewhere safe so it does not come to that.

## Email address

The **Email address** card shows the address on your login and whether it is "confirmed" or "not confirmed yet". If there is no address it says "No email address on your account."

Why it matters: your email address is used for password-reset links, for new sign-in alerts (see [Activity](#/docs/activity)), and for notices about your account. An Administrator also cannot add people to the team until their own address is confirmed.

### Confirming your address

When the site can send email, a banner appears on Home and Security: "Confirm your email address ... We sent a link to (your address)." If it says you cannot use password reset by email and cannot add people to your team yet, that is because confirmation is still outstanding.

1. Open the email we sent and click the link. You see "Email confirmed".
2. If you cannot find it, click **Send it again** in the banner. You will see "Sent. Check your inbox."
3. If the link says it has expired or was already used, sign in and press **Send it again**.

You may be asked to wait a minute between requests, and there is a daily limit. If your site has no email set up, you will be told that email is not set up on this site.

### Changing your address

1. Click **Change email**.
2. In the "Change email address" box, type the **New email address** and your **Password**.
3. Click **Send confirmation**. A message says to check the new mailbox.
4. Open the email at the new address and click the link.

Your old address stays in use until you click the link in the new mailbox, so a typo cannot lock you out. You cannot change to the address you already have.

## Password

The **Password** card has a **Change password** button. It reminds you that changing your password keeps your access to the encrypted data.

1. Click **Change password**.
2. Enter your **Current password**.
3. Enter a **New password**. It needs at least 10 characters, with letters and numbers.
4. Click **Change**. You see "Password changed".

Behind the scenes, your browser re-protects your data key with the new password so that nothing is lost. This is why changing the password inside the app is safe, while other routes need extra care (see below).

Tips for a good password: use a phrase of several words plus a number, do not reuse a password from another site, and use a password manager if you can.

### Temporary passwords

When an Administrator creates your login or uses **Reset access**, you receive a temporary password. The first time you sign in, the screen "Choose a new password" asks for the temporary one and a new one. You cannot go further until you do. Your access to the business data carries over.

### Forgot your password

On the sign-in page, click **Forgot password?** and enter the email address on your account. A reset link is emailed for each account that uses that address. Click it, choose a new password and sign in.

Important: a reset link changes your sign-in password but does not carry your data key with it. After a reset, the data screen may say that your password no longer unlocks your data. At that point you will need the **recovery key** (next section), or an Administrator can give you fresh access with **Reset access**. This is the single most common reason people get stuck, so keep your recovery key safe.

### The "Unlock your data" screen

Your data is encrypted, so after you sign in (or after you refresh the page, depending on the unlock setting an Administrator chose in [Settings](#/docs/settings)) you may see **Unlock your data**. Enter your password and click **Unlock**. If you cannot, click "Forgot it? Use your recovery key", enter the key and your current password, and click **Restore access**. From then on your data opens with that password.

If you have no recovery key, ask an Administrator in your account to use **Reset access** for you.

## Recovery key (Administrators)

This card is shown to Administrators once encryption is on. It says either "Saved. It is the only way to restore access if every password is forgotten." or "Not confirmed yet." and warns that creating a new one makes the old one stop working.

The recovery key is a long code, split into groups, made when encryption was first turned on for your account. It is created in your browser. The site never sees it and cannot recreate it. If every password on the account is forgotten, this key is the only way back in.

### Saving the key

When a key is made you see "Save your recovery key" with the key on screen. It cannot be skipped:

1. Click **Download** to save a text file named `myboxstock-recovery-key.txt`, and/or **Print** to print it.
2. Store it somewhere safe and separate from your computer, such as a password manager, a locked drawer, or a safe.
3. Tick **I have saved my recovery key somewhere safe**. Only then does **Continue** switch on.
4. Click **Continue**. The account records that the key is confirmed.

If you sign in and a key was made but never confirmed, the screen appears again so that it cannot be forgotten.

### Creating a new key

You cannot view the old key again, because only you hold it. If you have lost it or it may have been seen by someone else, make a new one:

1. Click **Create new recovery key**.
2. Confirm in the box "Create a new recovery key?". It says the old key will stop working.
3. Save the new key exactly as above, and tick the box to continue.

Do this while you can still sign in and unlock your data. If you leave it until you have forgotten your password too, nothing can be done.

> Treat the key like the key to a safe. Anyone who holds it can open your account data. Do not email it to yourself or leave it in a shared folder.

## Host administrator link (only where allowed)

This card appears only to Administrators on accounts where your site administrator has allowed it. It is meant for the rare person who both runs the site and runs a reseller account.

- **Link Host administrator**: opens a box asking for your **Host username**, **Host password** and a **Two-factor code** (only if your Host sign-in uses one). Click **Link**. You then get a **Site admin** entry in your name menu at the top right (the button with your username). It opens the Site admin console in a new tab. You still sign in to each separately, and nothing from your account's data is shared with the Host side.
- **Remove link**: after you confirm, the **Site admin** entry goes away on both sides. You can link again later.

If you do not see this card, linking is not turned on for your account, and you do not need it. Accounts that are not linked have only **Sign out** in the name menu.

## Your data (Administrators)

This card gives you two tools. The full explanation, with advice on routines, is in [Your data, your responsibility](#/docs/your-data-your-responsibility).

- **Export everything**, with its **Export** button: builds one zip file in your browser with your spreadsheets (inventory, customers, sales, sale items) and your settings. It never passes through the server. A message says how many files were made. The same button is also on the **Spreadsheets** card of [Backup and restore](#/docs/backup-and-restore). Anyone who has the file can read it, and you cannot restore from it. For a file you can restore from, use **Back up now** on the Backup and restore page.
- **Close my account**, with its **Close account** button: see the next section.

> Security is for your sign-in. Your safety copy of the data is the **Backup and restore** page. Make a backup file there as well as keeping your recovery key safe. You will need both to rebuild after a bad day.

### Closing your account

Only an Administrator can close the account. Here is exactly what happens.

1. Click **Close account**. In the box "Close this account?" you can click **Export everything first**. Then type your own **Your password** and your **Reseller ID**, and click **Close account**.
2. The account is locked straight away for **7 days**. People who are not Administrators are signed out and cannot sign in. Administrators can still sign in, but only to look around: reading, exporting and making a backup file still work, and anything that changes data is refused with "This account is closing, so changes are paused. An Administrator can restore it."
3. An "account is closing" email with the erase date goes to the account's owner email and to the Administrator who closed it. A red banner with the date shows on every page.
4. During the 7 days an Administrator can click **Restore account** in the red banner. The Host administrator can also bring it back for you.
5. After the 7 days the site erases the account automatically (it checks when it starts and every hour). **There is no way back after that.** Everything is deleted: the people and their sign-in history, the devices, customers, sales and receipts, your keys and recovery key, your billing history and your restore point. An "account erased" email goes to the owner and the Administrators. In rare cases the person who runs the site can also delete an account straight away, without the 7 days (for example when you ask them to). They cannot read your data and cannot bring the account back. If the site's email is set up, one "account erased" email then goes to the owner and the Administrators, saying the account was deleted by the site's Host, when, and the reason they gave if any. The delete never waits for that email, so if email is not set up nobody is emailed, which is one more reason to keep your own backup file and export.

What stays behind:

- Plain log entries that say something happened, with the link to your account removed. They hold no business data.
- Counts of how many receipt emails were sent.
- **Backups the site took before the erase.** The site's own full-site and offsite backup copies still hold your encrypted account until they are cleared out. With the default settings that is at most about 8 weeks, and the site can choose a different time. They cannot be opened without your password or recovery key, and the site cannot read them anyway.

> Backups you made yourself are yours. Closing the account does not touch your **.mbsbackup** files or your exports, and you can still make a backup while the account is closing. Make one first if there is any chance you will want the data later. A backup file can only be restored into the account it came from, so keep the Reseller ID with it.

## Encryption card

The last settings card, **Encryption**, tells you whether your inventory, customers and sales are encrypted in your browser. When it is on it says the hosting service stores the data but cannot read it. If it says "Not turned on yet", an Administrator needs to sign in and follow the on-screen steps to turn it on and save a recovery key.

## Your own sign-ins and devices

Below the cards are two tables that belong to you alone: **Where you're signed in** (your open devices, each with a **Sign out** button except the one you are on) and **Recent sign-ins** (your own history, with **Load more**). They work exactly as described on the [Activity](#/docs/activity) page, but only for you. Use them to sign out a lost phone or to check that nobody else has tried your login.

## Checklist for every person

1. Choose a strong password.
2. Turn on two-factor and save the recovery codes.
3. Add and confirm your email address.
4. Glance at **Recent sign-ins** now and then.

For Administrators, add:

5. Save the recovery key and confirm it.
6. Make a backup file on the [Backup and restore](#/docs/backup-and-restore) page every week, and keep the file away from your device.
7. Export everything now and then if you also want spreadsheets.

## Terms and Privacy Policy

When you created the account, you agreed to the **Terms of Service** and **Privacy Policy**. The footer at the bottom of every page links to them, together with **Data responsibility and acceptable use** and **Billing, trial and refund terms**. Each shows its version and effective date. The account records which version was accepted and when; the Host administrator can see that on the account's sheet, and nothing else about it.

myBoxStock, its owner and supporting staff cannot see your customer data (inventory, customers, sales, receipts and prices) and are not responsible or liable for it. You own your data and are 100 percent responsible for it, for your recovery key, and for your own backup files and exports.

If the terms change, Administrators are shown **Updated terms** at their next sign-in and must press **Accept and continue** before they can use the account. See [Getting started](#/docs/getting-started).

## If your plan is read-only

If your trial or paid period has ended, you can still sign in, change your password, turn two-factor on or off, export your data, make a backup file, and close the account. Changes that count as account updates, such as changing your email, creating a new recovery key, linking or signing out devices, are refused until the plan continues. See [Plans, trials and billing](#/docs/plans-trials-billing).

## Related pages

- [Your data, your responsibility](#/docs/your-data-your-responsibility)
- [Backup and restore](#/docs/backup-and-restore)
- [Activity](#/docs/activity)
- [Team](#/docs/team)
- [Troubleshooting and FAQ](#/docs/troubleshooting-faq)
