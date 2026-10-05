---
title: Backup and restore
summary: Save a backup file of your whole account, put it back if something goes wrong, undo a restore, and copy diagnostics for the site's administrator.
keywords: backup, back up, restore, undo, undo last restore, mbsbackup, backup file, save to files, share sheet, add what is missing, replace everything, newer than this file, safety copy, restore point, diagnostics, copy diagnostics, lost data, deleted by mistake, recovery key, preview, refused, cannot be used, export everything, spreadsheets, last backup, no backup yet
order: 15
covers: nav:backup, Backup and restore, Full backup, Back up now, Last backup, No backup yet, Your backup is ready, Save backup file, Not now, Restore from a backup file, Choose file, Restore from backup, Add what is missing, Replace everything, Your account is newer than this file, In the file, In your account, Restoring, Restore finished, Undo last restore, Undo restore, This file cannot be used, The restore did not finish, Spreadsheets, Export everything, Help, Copy diagnostics, .mbsbackup, safety copy, restore point, keeping the backup file safe, Team members are not in the backup
---

## Why this page matters

Your data is yours, and keeping it safe is your job. The site stores your records locked, with a key only you hold. That means the site cannot read your data, and it cannot get it back for you either. A backup file that you keep somewhere safe is your protection. Read [Your data, your responsibility](#/docs/your-data-your-responsibility) for the whole picture.

A backup helps when:

- someone deleted devices, customers or sales by mistake,
- an import or a bulk change went wrong,
- the person who runs the site had to put the whole site back to an older copy, and you lost recent work,
- you want a copy before you close the account or make a big change.

Only **Administrators** see **Backup and restore** in the menu. On a phone it is under **More**. It sits between **Settings** and **Activity**.

## The page, card by card

The page has four cards.

### Full backup

This card has a chip and one button.

- The chip says **Last backup** and how long ago, for example "Last backup 3 days ago" (green), or **No backup yet** (amber). It turns amber too when your last backup is more than 7 days old.
- **Back up now** makes the backup file. The card shows the name it will use: `myboxstock-backup-<your Reseller ID>-<date>.mbsbackup`.

### Restore from a backup file

- **Choose file** opens your phone's or computer's file picker. Pick a file that ends in `.mbsbackup` and comes from this account. You see a preview before anything changes.
- **Undo last restore** shows only while an undo copy exists. See below.

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
- your settings and catalog.

Not in the file:

- **Team members.** The file does not hold your users, their roles or their sign-ins. If you ever rebuild an account, you add people again on the [Team](#/docs/team) page.
- Your password and your recovery key themselves. The file holds your data key locked under them, so **the file only opens with your password or your recovery key.**

The file is safe to keep: your records stay locked inside it, in the same way as on the site. Only a small header is readable, which says the file type, your Reseller ID, when it was made and which app version made it. A thief would face the same lock as on the site's own copy. Still, treat it like your data and keep it private.

## Keeping the file safe

- Keep **two copies in two places**, and keep one away from the device you work on. For example Files or iCloud Drive plus a USB drive.
- Keep the Reseller ID and date in the name so you know which is newest.
- A backup file only restores into **the account it came from**. Keep the Reseller ID with it.
- Keep your **recovery key** too, somewhere separate. If you forget your password and lose the recovery key, nobody can open the file, and nobody can open the account either.
- Changing your password later does not stop an older file from restoring into the same account. A file is refused only if it was made with a different key, for example before the account was set up again. See "When a file is refused".

> Test your habit once. Choose the file on the Restore card, look at the preview, and press **Cancel**. Nothing changes, and you know the file works.

## Restoring step by step

1. Open **Backup and restore** and press **Choose file** on the **Restore from a backup file** card.
2. Pick your `.mbsbackup` file. On an iPhone or iPad the picker shows Files and iCloud Drive.
3. A sheet **Restore from backup** opens. It says when the file was made, and with which version of myBoxStock.
4. Look at the comparison. It has two columns, **In the file** and **In your account**, with rows for **Devices**, **Customers**, **Sales** and **Backup made / newest change**.
5. If you see a red box **Your account is newer than this file**, read it carefully (see below).
6. Choose **Add what is missing** or **Replace everything** (see below). The button at the bottom changes its name to match.
7. Press the button. A sheet **Restoring...** shows progress with "Writing your data (3 of 12 steps)". Keep the page open and do not close the browser.
8. **Restore finished** tells you what happened, for example "4 added, 6 replaced, 2 removed, 190 already the same." Press **Done**.

You can **Cancel** at step 6. Nothing changes until you press the final button.

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

### Your account is newer than this file

The red box appears when the last change in your account is later than the last change in the file. It says when the newest change was made. It is a warning that the file is older than your work. **Replace everything** would throw that newer work away. Choose **Add what is missing**, or cancel and find a newer file.

The times come from the site's clock, not from your phone, so a phone with the wrong date does not confuse this check.

### Undo last restore (7 days)

Before a restore changes anything, the site keeps a **safety copy** of your account as it was. It is kept for **7 days**, and there is only one at a time. A new restore replaces the old safety copy. The copy is stored locked, like all your data.

While a safety copy exists, the Restore card shows **Undo last restore**, with the time of the restore and the day it expires.

1. Press **Undo last restore**.
2. A box asks "Undo the last restore?". It says your data goes back to how it was before the restore, and that anything you changed since then is lost.
3. Press **Undo restore**. A message says "Undone: N records back as they were".

If a restore stops half way, for example because the connection dropped, the page undoes it by itself and says so: "Your data was put back exactly as it was." Try again when the connection is steady.

> After 7 days the safety copy is removed and **Undo last restore** disappears. If you press it when there is nothing to undo, you see "There is no restore to undo. The safety copy is kept for 7 days after a restore and then removed."

## When a file is refused

If the file cannot be used, a sheet **This file cannot be used** explains why. Nothing was changed. The reasons are:

- **"That file is not a myBoxStock backup."** You picked the wrong file, for example an export zip or a spreadsheet. Choose a file ending in `.mbsbackup`.
- **"That backup was made by a newer version of myBoxStock."** Refresh the page to get the latest version, then try again.
- **"That backup belongs to a different account."** The message names the Reseller ID in the file. Backup files only restore into their own account.
- **"That backup was made with a different key."** This account cannot open the file. This happens if the account was set up again since the file was made. Use the recovery key from the time the backup was made.
- **"That backup file is damaged or incomplete."** It may not have finished downloading or copying. Use another copy.

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
4. Once in a while, use **Choose file** and **Cancel** to prove the file opens.
5. Keep your recovery key safe and separate.

Related pages: [Security](#/docs/security), [Your data, your responsibility](#/docs/your-data-your-responsibility), [Home](#/docs/home) and [Glossary](#/docs/glossary).
