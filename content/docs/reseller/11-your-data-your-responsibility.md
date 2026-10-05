---
title: Your data, your responsibility
summary: How your data is encrypted, what the site can and cannot see, and what you must do to keep your business information safe: your password, your recovery key and your own exports.
keywords: encryption, zero-knowledge, recovery key, export, backup, ownership, responsibility, lost password, lost key, privacy, erase, close account, 7 days, data loss, who can see my data, checklist
order: 11
covers: encryption, recovery key, export, backups, ownership, Export everything, Close account, Restore account, Unlock behaviour, Create new recovery key, 7 days, checklist
---

## The short version

myBoxStock is built so that **your business information belongs to you, and only you and your team can read it**. That is a real benefit: nobody at the company that hosts the site can look through your stock, your customers or your sales.

It also comes with a responsibility that we want to state clearly and kindly:

- **You own your data, and you are 100% responsible for it.**
- **You are responsible for your password and your recovery key.** If you lose every password and you lose the recovery key, your data cannot be recovered by anyone. Not by us, not by your site administrator, not by anyone else.
- **You are responsible for your own regular exports.** An export is your own copy, kept by you, in a place you control.

Please read this page once, carefully, and then go through the checklist near the end.

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
- Technical health of the site itself.

**Things the site cannot see**

- Your inventory: what devices you have, serial numbers, costs, prices, test results.
- Your customers: names, phones, emails, notes.
- Your sales: receipts, totals, items, discounts, profit.
- Your settings and field choices for the business.
- Your passwords or your recovery key.

If somebody at the site is asked to look at your data, there is nothing readable for them to look at.

## You own your data

Because the data is yours and only you can read it:

- **You decide who sees it**, by creating or removing people on the [Team](#/docs/team) page.
- **You can take it with you at any time**, using **Export everything** (below).
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

## Export: your own copy

An export is the most important habit on this page. It is a copy of your business information that you keep, readable without the app.

### What an export contains

**Export everything** creates one zip file named like `myboxstock-your-business-2026-10-05.zip`. Inside:

- `README.txt`, a short explanation of the files.
- `inventory.csv`, every device, with test results.
- `customers.csv`, your customers.
- `sales.csv`, every sale, including voided ones.
- `sale_items.csv`, one row for each device on each sale.
- `settings.json`, your fields, test steps, warranty periods and catalogue.

The CSV files open in Excel, Numbers and Google Sheets. The export is built inside your browser and does not pass through the server. A note is added to the account log that an export happened (just the fact, never the contents).

### How to export

Only Administrators have the export button.

1. Open **Security** from the menu.
2. Find the **Your data** card.
3. Next to **Export everything**, click **Export**.
4. Your browser saves the zip file, and a message says how many files were created.
5. Move the file to your chosen backup place (see below), and check that you can open it.

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

> An export you have never opened is not a backup. Open the newest one occasionally and check that it looks right.

One customer's details can also be exported from the customer's page for a data-access request, as covered in [Customers](#/docs/customers).

## Backups held by the site

The site's operator takes backups of the whole site so that it can recover from a hardware failure. These backups contain only the same locked records the site already holds. They are encrypted copies. Without your password or recovery key they cannot be opened by anyone.

This matters in two ways:

- **They are not your backup.** A site backup cannot be used to get your readable data back if you lose your keys, and you cannot ask for one to be restored to recover one person's mistakes. Rely on your own exports.
- **They may outlive an erased account for a while.** If you close your account, an encrypted copy may remain in a site backup until that backup expires. It stays unreadable without your keys.

## Closing your account and what is erased

Administrators can close the account from **Security**, in the **Your data** card, with **Close my account**.

1. Click **Close account**.
2. In the box, click **Export everything first** if you have not already exported.
3. Enter your password and type your Reseller ID.
4. Click **Close account**.

What happens next:

- **Straight away**, the account is locked. People who are not Administrators are signed out and cannot sign in. Administrators can still sign in, but only to look around, export, or restore.
- **For seven days** a red banner on every page shows the date the account will be erased. While it is closing the account is read-only. An Administrator can click **Restore account** in that banner at any time to cancel the closing.
- **After seven days** everything is erased automatically: the people, the devices, your customers and your sales. This cannot be undone.
- Emails are sent when the closing starts and when the erase is finished.

Seven days is a safety net for second thoughts. It is not a backup plan. Export before you close.

## Erasing one customer

If a customer asks you to delete their personal details, an Administrator or anyone allowed to edit customers can erase the customer, which removes their name, phone, email and notes from the customer record and from past sales, while keeping the sales and totals so your books still add up. Export their details first if they asked for a copy. This is done in the browser and cannot be undone. See [Customers](#/docs/customers).

## Your checklist

Print this or put it in your calendar.

1. I know my Reseller ID and my username, and I have them written down.
2. My password is strong and not used anywhere else.
3. I have turned on two-factor and saved my recovery codes (see [Security](#/docs/security)).
4. My recovery key is saved in at least two safe places.
5. At least one other trusted Administrator exists, or someone trusted knows where the recovery key is.
6. I have confirmed my email address.
7. I export everything on a schedule (weekly or monthly), and I have put it in my calendar.
8. My exports are kept in at least two places, and I have opened the latest one to check it.
9. My exported files are protected, because they hold customer details.
10. When someone leaves my team, I turn off or remove their login and check [Activity](#/docs/activity).
11. I export before closing the account or making any big change.
12. I understand that if I lose every password and the recovery key, nobody can recover my data.

## Related pages

- [Security](#/docs/security) for the recovery key, the export and the close-account tools.
- [Settings](#/docs/settings) for the unlock behaviour.
- [Plans, trials and billing](#/docs/plans-trials-billing) for what read-only means.
- [Glossary](#/docs/glossary) for plain meanings of terms such as recovery key.
