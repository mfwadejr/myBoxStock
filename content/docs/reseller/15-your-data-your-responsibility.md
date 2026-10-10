---
title: Your data, your responsibility
summary: How your data is encrypted, what the site can and cannot see, and what you must do to keep your business information safe: your password, your recovery key and your own exports.
keywords: models.csv, reorder levels in export, what is exported, what is in the backup, encryption, zero-knowledge, recovery key, export, backup, backup file, mbsbackup, how often to back up, host restore, restore, add what is missing, ownership, responsibility, lost password, lost key, privacy, erase, close account, 7 days, data loss, who can see my data, checklist, returns.csv, refunds
order: 15
covers: models.csv, what an export contains, encryption, recovery key, export, backups, backup file, how often to back up, where to keep the backup, after a Host restore, Add what is missing, Back up now, Backup reminder, ownership, Export everything, Close account, Restore account, Unlock behaviour, Create new recovery key, 7 days, checklist, returns.csv
---

## The short version

myBoxStock is built so that **your business information belongs to you, and only you and your team can read it**. That is a real benefit: nobody at the company that hosts the site can look through your stock, your customers or your sales.

It also comes with a responsibility that we want to state clearly and kindly:

- **You own your data, and you are 100% responsible for it.**
- **You are responsible for your password and your recovery key.** If you lose every password and you lose the recovery key, your data cannot be recovered by anyone. Not by us, not by your site administrator, not by anyone else.
- **You are responsible for your own regular backups.** A backup file is your own copy, made by you with **Back up now** on the [Backup and restore](#/docs/backup-and-restore) page and kept by you, in a place you control.
- **The site cannot read your data and cannot recover it for you.** The site keeps its own safety copies of the whole site, but they are for the site's emergencies, not for yours.

Please read this page once, carefully, and then go through the checklist near the end.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## How the encryption works, in plain words

Imagine a locked box that lives at a storage warehouse. You put your records into the box and lock it at your own desk, using a key that only you hold. The warehouse stores the locked box but never has the key, so it can never open it.

myBoxStock works like that:

1. **When your account is set up**, your browser makes a secret data key for the account. That key locks and unlocks your inventory, customers and sales.
2. **Your browser locks the data before it leaves your computer.** What is sent to the site and stored is scrambled text that means nothing without the key.
3. **Your password protects the data key.** Each person on your team has their own password, and each password can open the same box. When you sign in and enter your password, your browser unlocks the data key and shows you your information.
4. **A recovery key is made as a spare.** It is a long code shown to you once, so that you can get back in if every password is forgotten. It is created in your browser. The site does not see it.
5. **The site never has your passwords' power over the data.** The password you sign in with is checked by the site, but your data is locked with a separate, differently processed version made only in your browser. Even the site's own copy of your sign-in details cannot open the box.

The effect is that the people who run the hosting service can keep your locked box safe and available, but they cannot read what is inside. That is what "zero-knowledge" means.

## What the site can and cannot see

Your site administrator (the "Host") runs the service. To run it, they need to know a small amount about your account. This table, in words, shows the split.

**Things the site can see**

- Your account's name, your Reseller ID, and the usernames and roles of your team.
- The email addresses you gave, so that messages can be sent.
- Your plan: whether you are on a trial, paid or free account, and the dates.
- Security facts: sign-in times, devices and network addresses, whether two-factor is on, and a log of account-level events such as "someone exported" or "someone created a recovery key" (names and counts, never contents).
- How many encrypted records exist and roughly how large they are.
- Anything you choose to send on purpose in a [Support](#/docs/support) ticket (a message, a screenshot, optional diagnostics). A ticket is plain text to the team, so keep customer details out of it.
- Technical health of the site itself.

**Things the site cannot see**

- Your inventory: what devices you have, serial numbers, costs, prices, test results.
- Your customers: names, phones, emails, notes, saved addresses.
- Your sales: receipts, totals, items, discounts, profit.
- Your deliveries: ship-to addresses, shipping fees and your own shipping cost, carriers, tracking numbers, delivery, pickup and meet notes.
- Your returns and refunds: which devices came back, why, the amounts, restocking fees and credit notes.
- Your shipping labels: your return address, label choices and label logo. A label is built in your browser and never sent anywhere.
- Your settings and field choices for the business, including return reasons, limits and the Running low choices.
- Your passwords or your recovery key.

If somebody at the site is asked to look at your data, there is nothing readable for them to look at.

## You own your data

Because the data is yours and only you can read it:

- **You decide who sees it**, by creating or removing people on the [Team](#/docs/team) page.
- **You can take it with you at any time**, using **Back up now** (a file you can restore) or **Export everything** (spreadsheets), both below.
- **You are the one responsible** for its accuracy, for your customers' privacy, and for any legal obligations that apply to your business. The site does not look at your data and so cannot tell you whether you have done the right thing.

## Your password and your recovery key

There are two ways to open your data. Learn both.

**Your password.** Each person signs in and unlocks the data with their own password. Choose a strong one and change it from [Security](#/docs/security) when needed. Changing it inside the app is safe: your browser re-protects the data key with the new password.

**Your recovery key.** This is the spare. It is shown when encryption is first turned on, and you must tick a box saying you saved it before the app lets you continue. Administrators can make a new one at any time from [Security](#/docs/security) with **Create new recovery key**, which immediately makes the old key stop working.

### What happens if you lose them

- **You forget your password but have the recovery key:** you can get back in. On the "Unlock your data" screen, choose "Forgot it? Use your recovery key", enter the key and your current password, and click **Restore access**.
- **You forget your password and another Administrator or teammate still can sign in:** an Administrator can use **Reset access** on the [Team](#/docs/team) page to give you a temporary password and fresh access.
- **You reset your password using the emailed link:** this changes your sign-in password only. Your data may still need the recovery key or an Administrator's **Reset access** before it opens.
- **Everyone forgets their passwords and the recovery key is lost:** **your data cannot be recovered by anyone.** There is no master key, no back door, and no support route that can open it. The records would remain locked forever.

This is not a flaw. It is the direct result of nobody but you holding the key. Your site administrator cannot override it, and a request to do so cannot be met.

### Keeping the recovery key safe

- Download or print it when it is shown, and keep a copy in at least two safe places, for example a password manager and a printed copy in a locked drawer.
- Keep it away from the computer you use for the business, so that one accident cannot take both.
- Do not share it by email, chat or a shared folder.
- Tell one trusted person where it is kept in case you are unavailable.
- Make a new one if you suspect someone has seen it, and replace every old copy.

## Unlock behaviour

An Administrator can choose in [Settings](#/docs/settings), under **Unlock behaviour**, what happens when someone refreshes the page. **Ask for the password again (most private)** is the default. The alternative, **Stay unlocked while this tab is open**, keeps your data open in that tab, and locks it again after the minutes of inactivity set there. Use the default on shared or untrusted devices. This does not change who owns your data or who holds the keys.

## Backup file: your real protection

A backup file is a copy of your whole account that you can put back later. It is the thing that saves you from a bad day: a wrong click, a bulk change you regret, a device that was deleted, or the site having to go back to an older copy.

Only Administrators can make one. It takes a minute. Open **Backup and restore** in the menu and press **Back up now**. The full steps, with steps for phones and computers, are on the [Backup and restore](#/docs/backup-and-restore) page.

### What the file is

- It is named like `myboxstock-backup-amber-fox-4271-20261005.mbsbackup`: your Reseller ID, then the date.
- It is made inside your own browser. Your records stay locked inside it, exactly as the site holds them.
- It can only be opened with your password or your recovery key. If someone steals the file, it is as hard to open as the site's own copy.
- It holds your devices, customers, sales and receipts, your settings and catalog, and your **team list** (usernames, emails and user types, locked with your key). It never holds passwords, two-factor secrets or sign-ins. If you restore the team list, each person comes back as a pending invitation and chooses their own password; see the [Team](#/docs/team) page.
- You can check a file before you need it with **Test a backup file** on the Backup and restore page. It runs in your browser and changes nothing.

### How often

- **Weekly** if you sell most days. The Home page reminds you when your last backup is more than 7 days old.
- **Before anything risky**: a big import, deleting many devices, removing people, or changing settings in bulk.
- **Before you close the account.** Always.

### Where to keep it

- In at least two places, and one of them is not the phone or computer you use every day. For example: Files or iCloud Drive on your iPhone, plus email to yourself or a USB drive.
- On an iPhone or iPad the **Save backup file** button opens the share sheet. Choose **Save to Files**, then pick a folder.
- Do not rename the part of the name that holds your Reseller ID. It helps you find the right file, and a file only works in its own account.
- Keep your recovery key too. A backup file and the recovery key together can rebuild everything. The backup alone is useless if every password and the recovery key are lost.

### After the site restores an older copy

Sometimes the person who runs the site has to put the whole site back to an older backup, for example after a hardware fault. If that happens you will see a banner: "The site was restored from a backup taken (date and time) UTC. Sales or changes made after that time may be missing. Please check your recent activity."

Anything you saved after that moment on the site's side may be gone. You can fix that yourself if you have your own newer backup file:

1. Open **Backup and restore** and press **Choose file**. Pick your newest backup.
2. Leave **Add what is missing** selected and press the button. It brings back every device, customer and sale that your account does not have now, and it does not change anything that is already there.
3. Check Sales and Inventory. If a record you only *changed* after the site's backup looks old, undo and try **Replace everything** instead, which makes the account match the file exactly. Read the warnings in the preview first.

The more recent your backup file, the less you lose. This is why a weekly habit matters.

## Export: your own copy

An export is a copy of your business information that you keep, readable without the app, in spreadsheets. It is handy for your accountant or for looking at your numbers, but you cannot restore from it. For that you need the backup file above. Do both.

### What an export contains

**Export everything** creates one zip file named like `myboxstock-your-business-2026-10-05.zip`. Inside:

- `README.txt`, a short explanation of the files.
- `inventory.csv`, every device, with test results.
- `customers.csv`, your customers, with their saved address.
- `sales.csv`, every sale, including voided ones, with its delivery type, ship-to address, shipping fee and your own shipping cost, carrier, tracking, delivery note and shipped date.
- `sale_items.csv`, one row for each device on each sale, with a column showing whether it was returned.
- `returns.csv`, one row for each return and refund, with the credit note number, reason, amounts, who processed it and any return tracking.
- `models.csv`, the reorder level you set for each model.
- `settings.json`, your fields, test steps, warranty periods and catalogue, plus your delivery, label and return settings. It also holds your own mail server password if you set one up, so keep the zip private.

The CSV files open in Excel, Numbers and Google Sheets. The export is built inside your browser and does not pass through the server. A note is added to the account log that an export happened (just the fact, never the contents).

### How to export

Only Administrators have the export button.

1. Open **Backup and restore** (card **Spreadsheets**) or **Security** (card **Your data**) from the menu.
2. Next to **Export everything**, click the button.
3. Your browser saves the zip file, and a message says how many files were created.
4. Move the file to your chosen backup place (see below), and check that you can open it.

### How often

Choose a routine and put it in your calendar:

- **Weekly** if you sell most days. A week of lost sales records is a lot of work to rebuild.
- **Monthly** at the very least, even if you are quiet. Do it at month end, before you close the books.
- **Before any big change**: before removing people, changing many items, or closing the account.
- **Before closing the account.** Always.

### Where to keep exports

- Keep at least two copies in two places: for example, a folder on your computer and a cloud drive or USB stick.
- Keep one copy somewhere that is not the computer you use every day.
- Name the files by date so you can tell which is newest. The app already does this.
- Remember that exports are plain spreadsheets: they contain customer names, phones and emails. Protect them like the data they are. Use a locked device or password-protected folder, and delete old copies you no longer need.

> Spreadsheets are not a restorable backup. Open the newest export now and then and check that it looks right, and keep your backup file as well.

One customer's details can also be exported from the customer's page for a data-access request, as covered in [Customers](#/docs/customers).

## Backups held by the site

The site's operator takes backups of the whole site so that it can recover from a hardware failure. These backups contain only the same locked records the site already holds. They are encrypted copies. Without your password or recovery key they cannot be opened by anyone, and the site cannot read them.

This matters in three ways:

- **They are not your backup.** A site backup cannot be used to get your readable data back if you lose your keys, and you cannot ask for one to be restored to recover one person's mistakes. Rely on your own backup file.
- **They can go back in time.** If the site has to restore an older copy, your account goes back with it, and you see the banner described above. Your own newer backup file is how you get recent work back.
- **They may outlive an erased account for a while.** If you close your account, an encrypted copy stays in the site's full-site and offsite backups until they are cleared out, with the default settings at most about 8 weeks. It stays unreadable without your keys.

## Closing your account and what is erased

Administrators can close the account from **Security**, in the **Your data** card, with **Close my account**.

1. Click **Close account**.
2. In the box, click **Export everything first** if you have not already exported. Better still, make a backup file first on the [Backup and restore](#/docs/backup-and-restore) page.
3. Enter your password and type your Reseller ID.
4. Click **Close account**.

What happens next:

- **Straight away**, the account is locked. People who are not Administrators are signed out and cannot sign in. Administrators can still sign in, but only to look around, export, make a backup file, or restore the account.
- **For seven days** a red banner on every page shows the date the account will be erased. While it is closing the account is read-only. An Administrator can click **Restore account** in that banner at any time to cancel the closing.
- **After seven days** everything is erased automatically: the people and their sign-in history, the devices, customers and sales, your keys, your recovery key, your billing history and your undo copy. This cannot be undone.
- Emails are sent when the closing starts (with the erase date) and when the erase is finished. In rare cases the person who runs the site can also delete an account straight away, without the 7 days (for example when you ask them to). They cannot read your data and cannot bring the account back. If the site's email is set up, one "account erased" email then goes to the owner and the Administrators, saying the account was deleted by the site's Host, when, and the reason they gave if any. The delete never waits for that email, so if email is not set up nobody is emailed, which is one more reason to keep your own backup file and export.
- **What stays:** plain log entries with no link to your account, counts of receipt emails, and the site's own encrypted backups until they expire (at most about 8 weeks with the defaults). Your own backup files and exports are yours and are not touched.

Seven days is a safety net for second thoughts. It is not a backup plan. Back up before you close.

## Erasing one customer

If a customer asks you to delete their personal details, an Administrator or anyone allowed to edit customers can erase the customer, which removes their name, phone, email, address and notes from the customer record and from past sales (including where a parcel was sent and the notes on any return), while keeping the sales and totals so your books still add up. Export their details first if they asked for a copy. This is done in the browser and cannot be undone. See [Customers](#/docs/customers).

## Your checklist

Print this or put it in your calendar.

1. I know my Reseller ID and my username, and I have them written down.
2. My password is strong and not used anywhere else.
3. I have turned on two-factor and saved my recovery codes (see [Security](#/docs/security)).
4. My recovery key is saved in at least two safe places.
5. At least one other trusted Administrator exists, or someone trusted knows where the recovery key is.
6. I have confirmed my email address.
7. I make a backup file every week (Backup and restore, **Back up now**), and I have put it in my calendar.
8. My backup files are kept in at least two places, one of them away from my phone or computer.
9. I have tried **Choose file** once, so I know the preview works, and I know I can use **Undo last restore** for 7 days.
10. I export spreadsheets when I need them, and I protect those files because they hold customer details.
11. When someone leaves my team, I turn off or remove their login and check [Activity](#/docs/activity).
12. I back up before closing the account or making any big change.
13. I understand that if I lose every password and the recovery key, nobody can recover my data.

## Related pages

- [Backup and restore](#/docs/backup-and-restore) for making and using a backup file.
- [Security](#/docs/security) for the recovery key, the export and the close-account tools.
- [Settings](#/docs/settings) for the unlock behaviour.
- [Plans, trials and billing](#/docs/plans-trials-billing) for what read-only means.
- [Glossary](#/docs/glossary) for plain meanings of terms such as recovery key.
