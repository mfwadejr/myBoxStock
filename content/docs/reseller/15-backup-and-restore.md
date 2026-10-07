---
title: Backup and restore
summary: Save a backup file of your whole account, put it back if something goes wrong, undo a restore, and copy diagnostics for the site's administrator.
keywords: test a backup file, check a backup, is my backup good, team members, pending invitations, add team members, backup, back up, restore, undo, undo last restore, mbsbackup, backup file, save to files, share sheet, add what is missing, replace everything, newer than this file, safety copy, restore point, diagnostics, copy diagnostics, lost data, deleted by mistake, recovery key, preview, refused, cannot be used, export everything, spreadsheets, last backup, no backup yet
order: 15
covers: nav:backup, Backup and restore, Full backup, Back up now, Last backup, No backup yet, Your backup is ready, Save backup file, Not now, Restore from a backup file, Choose file, Restore from backup, Add what is missing, Replace everything, Your account is newer than this file, In the file, In your account, Restoring, Restore finished, Undo last restore, Undo restore, This file cannot be used, The restore did not finish, Spreadsheets, Export everything, Help, Copy diagnostics, .mbsbackup, safety copy, restore point, keeping the backup file safe, Team members are in the backup, Add team members, pending invitations, Test a backup file, Test file, What is inside, Compared with your account now, Passed, Failed, Not checked, Added since, Changed since, Missing now, Unchanged, This file is older than your latest changes
---

## Why this page matters

Your data is yours, and keeping it safe is your job. The site stores your records locked, with a key only you hold. That means the site cannot read your data, and it cannot get it back for you either. A backup file that you keep somewhere safe is your protection. Read [Your data, your responsibility](#/docs/your-data-your-responsibility) for the whole picture.

A backup helps when:

- someone deleted devices, customers or sales by mistake,
- an import or a bulk change went wrong,
- the person who runs the site had to put the whole site back to an older copy, and you lost recent work,
- you want a copy before you close the account or make a big change.

Only **Administrators** see **Backup and restore** in the menu. On a phone it is under **More**. It sits between **Settings** and **Activity**.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## The page, card by card

The page has five cards.

### Full backup

This card has a chip and one button.

- The chip says **Last backup** and how long ago, for example "Last backup 3 days ago" (green), or **No backup yet** (amber). It turns amber too when your last backup is more than 7 days old.
- **Back up now** makes the backup file. The card shows the name it will use: `myboxstock-backup-<your Reseller ID>-<date>.mbsbackup`.

### Restore from a backup file

- **Choose file** opens your phone's or computer's file picker. Pick a file that ends in `.mbsbackup` and comes from this account. You see a preview before anything changes.
- **Undo last restore** shows only while an undo copy exists. See below.

### Test a backup file

A separate card, so that testing is clearly not restoring. **Test file** opens the file picker. The file is checked right in your browser: nothing is restored, changed or sent, and the site's host sees nothing. It works even when your account is read-only (trial or plan ended), because it only reads. See "Testing a backup file" below.

### Spreadsheets

**Export everything** gives you one zip file with CSV spreadsheets and your settings. You can open them in Excel, Numbers or Google Sheets. Anyone who has the file can read it, and you cannot restore from it. It is not a backup. The same button is also on the [Security](#/docs/security) page.

### Help

**Copy diagnostics** copies a short health summary for the site's administrator. See the last section on this page.

## Making a backup

### On an iPhone or iPad

1. Open **Backup and restore** (under **More**).
2. Tap **Back up now**. A message says "Preparing your backup...".
3. A sheet called **Your backup is ready** shows the file name. Tap **Save backup file**. (**Not now** closes the sheet and nothing is saved.)
4. The share sheet opens. Choose **Save to Files**, pick a folder such as iCloud Drive, and tap **Save**. You can also send it to yourself by email or to another app.
5. A message says "Backup saved. Keep the file somewhere safe." The chip now says "Last backup today".

### On an Android phone or a computer

1. Open **Backup and restore** and press **Back up now**.
2. Your browser downloads the file, usually to your Downloads folder.
3. A message says "Backup saved. Keep the file somewhere safe."
4. Move the file to a safe place away from this device, such as a USB drive or a cloud folder.

> The "Last backup" time is only recorded once the file has really been handed to you. If you cancel the share sheet, the chip does not change.

> If your trial or plan has ended and the account is read-only, you can still make and save a backup file, and the "Last backup" time still updates. Restoring is not possible until the account can be changed again. See [Plans, trials and billing](#/docs/plans-trials-billing).

### The reminder on Home

If you are an Administrator and you have no backup, or your last one is older than 7 days, Home shows a banner: "You have not made a backup yet." or "Your last backup was N days ago." It has two buttons.

- **Back up now** does the same as on this page. The banner goes away once the file is saved.
- **Not today** hides the banner until tomorrow. It is remembered on that device only.

### How big is the file, and how long does it take?

The file grows with your records. The more devices, customers and sales you have, the bigger it is and the longer it takes to make on a phone. Keep the page open until the message appears. If the file is too big to email, use Files, a cloud folder or a USB drive.

## What is in the file, and what is not

In the file:

- your devices, models and makes,
- your customers,
- your sales and receipts, with their test records and warranties,
- your settings and catalog,
- your **team list**: each person's username, email and user type (Administrator, Standard or View). It is locked with your key like everything else, so it is kept whether or not you ever restore it.

Not in the file:

- **Passwords, two-factor secrets and sign-ins.** The file never holds a password, a two-factor secret or a sign-in. People who come back from the team list are **pending invitations**: each one gets a temporary password from you and then chooses their own password and sets up their own two-factor.
- Your password and your recovery key themselves. The file holds your data key locked under them, so **the file only opens with your password or your recovery key.**

The file is safe to keep: your records stay locked inside it, in the same way as on the site. Only a small header is readable, which says the file type, your Reseller ID, when it was made and which app version made it. A thief would face the same lock as on the site's own copy. Still, treat it like your data and keep it private.

## Keeping the file safe

- Keep **two copies in two places**, and keep one away from the device you work on. For example Files or iCloud Drive plus a USB drive.
- Keep the Reseller ID and date in the name so you know which is newest.
- A backup file only restores into **the account it came from**. Keep the Reseller ID with it.
- Keep your **recovery key** too, somewhere separate. If you forget your password and lose the recovery key, nobody can open the file, and nobody can open the account either.
- Changing your password later does not stop an older file from restoring into the same account. A file is refused only if it was made with a different key, for example before the account was set up again. See "When a file is refused".

> Test your habit once. Use **Test file** on the **Test a backup file** card. Nothing changes, and you know the file works.

## Testing a backup file

Use this to find out whether a file is good **before** you need it. It is a separate card from **Restore**, so you never restore by accident.

1. Press **Test file** on the **Test a backup file** card and pick your `.mbsbackup` file.
2. A sheet **Test a backup file** opens with a banner: **This file passed every check** (blue) or **This file failed a check, so it cannot be used** (red). Either way it says that nothing was restored or changed.
3. Under the banner is a list with a **Passed** or **Failed** mark for each check: **Is a myBoxStock backup file**, **Made for this account**, **Opens with this account's key**, **Complete and not damaged** (the number of records and the checksum), **Every record can be opened** (each one is opened, so a record that was changed inside the file is caught) and, when the file has one, **Team list can be opened**.
4. The test stops at the first check that fails and shows the same plain words as a restore would (see "When a file is refused"). The checks after it say **Not checked**.
5. If everything passed, **What is inside** shows the date the file was made, the version of myBoxStock that made it and the numbers of **Devices**, **Customers**, **Sales** and **Team members** next to what your account has now.
6. **Compared with your account now** lists, for devices, customers and sales (and other records such as settings, if any), how many records were **Added since** (in your account but not in the file, because they were made later), **Changed since**, **Missing now** (in the file but not in your account) and **Unchanged**. A line under it says in plain words what that means, for example "This file is older than your latest changes", "Your account is missing 3 records that this file still has" or "This file matches your account as it is now". The comparison uses only the list of record ids and revisions in the file.
7. If the file has a team list, the sheet shows how many people are in it by user type, how many are already in your account and how many would be added as pending invitations.

Press **Done** to close the sheet. Nothing was changed. A test never changes the "Last backup" time either.

## Restoring step by step

1. Open **Backup and restore** and press **Choose file** on the **Restore from a backup file** card.
2. Pick your `.mbsbackup` file. On an iPhone or iPad the picker shows Files and iCloud Drive.
3. A sheet **Restore from backup** opens. It says when the file was made, and with which version of myBoxStock.
4. Look at the comparison. It has two columns, **In the file** and **In your account**, with rows for **Devices**, **Customers**, **Sales** and **Backup made / newest change**.
5. If the file has a team list, there is a switch **Add team members (N in this file)**, **on** by default (see "Team members" below). Turn it off if you only want your records back.
6. If you see a red box **Your account is newer than this file**, read it carefully (see below).
7. Choose **Add what is missing** or **Replace everything** (see below). The button at the bottom changes its name to match.
8. Press the button. A sheet **Restoring...** shows progress with "Writing your data (3 of 12 steps)". Keep the page open and do not close the browser.
9. **Restore finished** tells you what happened, for example "4 added, 6 replaced, 2 removed, 190 already the same." If team members were added it also says how many. Press **Done**.

You can **Cancel** at step 7. Nothing changes until you press the final button.

### Add what is missing, or Replace everything

**Add what is missing** (the default) adds everything the file has that your account does not have. It never changes or deletes anything that is already in your account.

- Use it when something was **deleted** and you want it back, or after the site restored an older copy and you want your recent devices and sales back.
- It is the safe choice. It can also bring back records you deleted on purpose after the backup was made, so check afterwards.
- It does not undo edits. If you changed a price after the backup, the new price stays.

**Replace everything** makes your account match the file exactly. The button turns red.

- It **overwrites** records that differ from the file, adds missing ones, and **deletes** records that are not in the file.
- Use it when you want to go back in time, for example after a bad bulk change or import, and you accept that everything done since the file was made is lost.
- Never use it when you see the red **Your account is newer than this file** box, unless you really want to lose that newer work.

> If you are not sure, choose **Add what is missing**. You can always undo for 7 days.

### Team members

When the file has a team list, the restore sheet shows **Add team members (N in this file)** with the number of people by user type. The switch is **on** by default.

- **On:** each person in the file who is not already on your team comes back as a **pending invitation**. You see them on the [Team](#/docs/team) page with a **Pending invitation** tag. They cannot sign in yet. Press **Set up access** (the same as **Reset access**) to give each one a temporary password; they then choose their own password and set up their own two-factor. Their user types come back as they were in the file.
- **Off:** only your records are restored. The team list stays in the file for another time.
- A person who matches someone already on your team by **username or email** is skipped. Nobody is added twice and nobody's user type is changed.
- **Replace everything** only applies to records. It **never removes** a current team member, whatever the file says.
- **Undo last restore** also removes the invitations that restore added, as long as they are still pending. Anyone you have already given access to stays.

### Your account is newer than this file

The red box appears when the last change in your account is later than the last change in the file. It says when the newest change was made. It is a warning that the file is older than your work. **Replace everything** would throw that newer work away. Choose **Add what is missing**, or cancel and find a newer file.

The times come from the site's clock, not from your phone, so a phone with the wrong date does not confuse this check.

### Undo last restore (7 days)

Before a restore changes anything, the site keeps a **safety copy** of your account as it was. It is kept for **7 days**, and there is only one at a time. A new restore replaces the old safety copy. The copy is stored locked, like all your data.

While a safety copy exists, the Restore card shows **Undo last restore**, with the time of the restore and the day it expires.

1. Press **Undo last restore**.
2. A box asks "Undo the last restore?". It says your data goes back to how it was before the restore, and that anything you changed since then is lost.
3. Press **Undo restore**. A message says "Undone: N records back as they were". Pending invitations added by that restore are removed too.

If a restore stops half way, for example because the connection dropped, the page undoes it by itself and says so: "Your data was put back exactly as it was." Try again when the connection is steady.

> After 7 days the safety copy is removed and **Undo last restore** disappears. If you press it when there is nothing to undo, you see "There is no restore to undo. The safety copy is kept for 7 days after a restore and then removed."

## When a file is refused

If the file cannot be used, a sheet **This file cannot be used** explains why. Nothing was changed. The reasons are:

- **"That file is not a myBoxStock backup."** You picked the wrong file, for example an export zip or a spreadsheet. Choose a file ending in `.mbsbackup`.
- **"That backup was made by a newer version of myBoxStock."** Refresh the page to get the latest version, then try again.
- **"That backup belongs to a different account."** The message names the Reseller ID in the file. Backup files only restore into their own account.
- **"That backup was made with a different key."** This account cannot open the file. This happens if the account was set up again since the file was made. Use the recovery key from the time the backup was made.
- **"That backup file is damaged or incomplete."** It may not have finished downloading or copying. Use another copy.
- **"That backup file is damaged: one of its records cannot be opened."** Only **Test a backup file** says this, because only the test opens every record. Use another copy.
- **"That backup file is damaged: its team list cannot be opened."** Use another copy.

More help is in [Troubleshooting and FAQ](#/docs/troubleshooting-faq).

## After the site restored an older copy

If the person who runs the site restored the whole site from an older backup, a red banner tells you: "The site was restored from a backup taken (date) UTC. Sales or changes made after that time may be missing. Please check your recent activity." Press **Close** to hide it once you have read it.

To get your recent work back, use your own latest backup file:

1. Open **Backup and restore** and press **Choose file**.
2. Pick your newest `.mbsbackup`.
3. Leave **Add what is missing** selected and press it.
4. Open [Sales](#/docs/sales) and [Inventory](#/docs/inventory) and check that your recent items are back.

Anything you did after your newest backup file and before the site restore cannot be brought back from a file. That is why a backup every week, and before risky work, matters.

## Copy diagnostics

If something odd is happening and you need help, press **Copy diagnostics** on the **Help** card. It copies a short plain-text summary. A message says "Diagnostics copied. Paste them into your message to the Host admin." Then paste it into an email or message to your site's administrator.

The summary has: the app version and build, your device, screen size and language, your Reseller ID, your plan and billing state, how many people you have by role and how many use two-factor, whether encryption is on and your recovery key is confirmed, when you last made a backup, whether an undo is available, and the last 20 warnings or errors for your account (codes and messages only, with network addresses removed).

It never contains your devices, customers, sales or prices. If your browser blocks copying, a box titled **Copy diagnostics** shows the text already selected. Copy it by hand.

## A good routine

1. Every week, open **Backup and restore** and press **Back up now**.
2. Save the file to two places.
3. Before a big import, a bulk change or closing the account, make an extra one.
4. Once in a while, use **Test a backup file** to prove the file opens and to see how it compares with your account.
5. Keep your recovery key safe and separate.

Related pages: [Security](#/docs/security), [Your data, your responsibility](#/docs/your-data-your-responsibility), [Home](#/docs/home) and [Glossary](#/docs/glossary).
