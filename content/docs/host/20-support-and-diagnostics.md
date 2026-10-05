---
title: Support and diagnostics
summary: How to help a reseller who writes to you: what their Copy diagnostics text tells you, what you can and cannot see, why you cannot restore one reseller from your own backups, and how to answer questions about their backup file and phone scanning.
keywords: support, diagnostics, copy diagnostics, help a reseller, reseller backup, mbsbackup, back up now, restore, add what is missing, replace everything, undo last restore, camera, scan, scanner, barcode, QR, https, permission, safety copy, what can the host see, zero-knowledge
order: 20
covers: Copy diagnostics, diagnostics, Backup and restore, Back up now, Choose file, Add what is missing, Replace everything, Undo last restore, Your account is newer than this file, This file cannot be used, Last backup, No backup yet, Not today, myboxstock-backup, .mbsbackup, restore point, Take a photo, Type it instead, Small, Medium, Large, Flash, Scan, camera blocked, hardware scanner, Export everything
---

## What this page is for

Resellers can now look after their own safety. Their app has a **Backup and restore** page where an Administrator saves a backup file and restores from one. It also has a **Copy diagnostics** button that makes a short summary to send to you. This page explains how to use that summary, how it fits with your own backups, and how to answer the questions you are most likely to get.

> Customers own their data and are responsible for it. The Host stores it encrypted and cannot read it or recover it. A backup file kept somewhere safe is the reseller's own protection, and yours is the protection of the platform.

## Reading a Copy diagnostics message

When a reseller says "something is wrong", ask the Administrator to open **Backup and restore**, press **Copy diagnostics** in the Help card and paste the text into an email or message to you. If their browser blocks copying, a sheet shows the text so they can select it by hand. Only Administrators see this button.

The text is plain and short. It holds counts, codes and times, and never any tenant data. Lines you will see:

- **App version and Build**: which version of the site the reseller is on. Compare it with your [Updates](#/docs/updates) page.
- **Device**: their phone or computer and browser, and the screen size and language.
- **Reseller ID, Plan and Billing**: who they are, and whether the account is on a trial, paid, ended or read-only, with days left on a trial.
- **Users**: how many people, by role.
- **Two-factor**: how many of them have it on.
- **Encryption**: whether the vault is on and whether the recovery key has been confirmed as saved.
- **Last full backup**: when they last saved a backup file, or "never".
- **Restore undo available**: "yes" if they restored recently and can still undo it.
- **Recent warnings and errors for this account**: up to the last 20, each with a time, a level, an event code and a short message. Internet addresses are replaced with "[address]".

### How to use it

1. Look at the **Reseller ID** and find the account in [Accounts](#/docs/accounts).
2. Check **Billing**. A plan that has ended explains many "I cannot save anything" messages. See [Plans](#/docs/plans).
3. Check **Encryption** and **Last full backup**. "Recovery key not confirmed" and "never" are the two things to nudge them about.
4. Read the recent events. The codes and messages say what failed, for example a sign-in lockout or a refused restore.
5. Check the **App version**. If it is older than yours, ask them to reload the page.
6. Search [Logs](#/docs/logs) for the Reseller ID for anything on your side. Account activity inside the reseller app (the tenant area) is deliberately hidden from the Host Console, so the diagnostics text is how you see it.

## What you can and cannot see

You can see: the Reseller ID, plan and billing state, user counts and roles, two-factor counts, whether encryption is set up, and the last backup time from the diagnostics. In Accounts you also see people, their email status and last sign-in.

You cannot see: inventory, customers, sales, receipts or any record. You cannot see the recovery key. You cannot see what is in a reseller's backup file, and you never receive it unless they send it to you, which they should not.

> Never ask a reseller to send you a backup file or a recovery key. Even with the file, you could not open it without their password or recovery key.

## The reseller's own backup file

You may be asked what the file is, so here is the short version.

- The file is named `myboxstock-backup-` followed by the Reseller ID and the date, and ends in `.mbsbackup`. It is made in the reseller's browser by **Back up now**.
- It is plain JSON with a small readable header (format and version, Reseller ID, when it was made, app version). Everything else is the account's records, which were already encrypted, plus a sealed index, and the account's keys wrapped by the password and by the recovery key.
- It holds items, models, customers, sales and receipts, and settings and catalogue. It does not hold users, roles or sign-ins, so team members are not in it.
- It opens only with the account's password or recovery key. A stolen file is as hard to attack as the server's own copy.
- On an iPhone or iPad a sheet "Your backup is ready" offers **Save backup file**, which opens the share sheet so they can choose Files. Elsewhere it downloads. "Last backup" is only recorded once the file is saved.
- Accounts that are closing can still make a backup.

Administrators also see a reminder on Home, "Your last backup was N days ago" or "You have not made a backup yet", with **Back up now** and **Not today**. It shows when the last backup is older than 7 days.

### Restoring from their file

On the same page, **Choose file** opens a preview of the file next to the account as it is now, with two choices:

- **Add what is missing** is the default. It only adds records the account does not have and never overwrites. It can bring back records deleted after the backup.
- **Replace everything** overwrites changed records, adds missing ones and removes records that are not in the file. The button turns red.

A red banner "Your account is newer than this file" appears when the account's latest change is later than the file's. A safety copy is kept for 7 days, and **Undo last restore** puts things back. A restore that fails is undone automatically.

A file may be refused with "This file cannot be used" if it is not a backup, is from a newer version, belongs to a different Reseller ID, was made with a different key, or is damaged or cut short. You cannot open or fix the file for them. Ask which of these applies and point them to the matching step on their own Backup and restore page.

## Why you cannot restore one reseller from your backups

Your snapshots, offsite copies and full-site backups hold the whole database as it was at one moment. They are all-or-nothing:

- A restore puts every account back to that moment. You cannot pull one reseller out and leave the others alone.
- The data is encrypted for each reseller and you cannot open it, so you cannot extract or repair part of an account either.
- Anything a reseller did after your backup is gone from the site after a restore.

That is the reason each reseller's own backup file matters. After you restore, resellers see the site announcement that the site was restored from a backup taken at a given time. A reseller with a newer backup file of their own then opens **Backup and restore**, chooses the file and picks **Add what is missing** to recover their recent work. Without one, they have only what your backup held.

> If you ever have to restore, tell your resellers straight away, and ask them to check their recent sales. See [Backups](#/docs/backups) and [Recovery and emergencies](#/docs/recovery-and-emergencies).

If an account was erased after closing, there is no restore from the site. An older backup of yours may still hold the encrypted account until it is pruned, with the defaults at most about 8 weeks. See [Accounts](#/docs/accounts).

## Questions about scanning with the phone camera

Resellers can scan serial numbers, MAC addresses and codes with the phone camera, using a small camera button in the field or on the scan box. A keyboard-style hardware scanner keeps working exactly as before. For you as the Host, the facts are:

- The camera only works when the site is opened over **https** (a local address on the same machine also counts). If the Site address in [Settings](#/docs/settings) is plain http, or the proxy does not pass https through, resellers see "The camera only works when this site is opened over https". This is the most common cause.
- The picture is read on the phone. Frames are never sent to the server and never stored, and nothing about scanning is logged. There is nothing for you to see or fix on the server.
- If the camera is blocked, the reseller has to allow it in the browser. On an iPhone: Settings, Safari, Camera. The scanner screen then offers **Try again**.
- The scanner has a box-size choice (**Small**, **Medium**, **Large**), a **Flash** button only where the phone supports it (not on iPhone Safari), **Type it instead** and **Take a photo**.
- A MAC scan accepts 12 hex digits in the usual forms and fills the field as `XX:XX:XX:XX:XX:XX`. A code that is not a MAC is ignored in a MAC field.

If a reseller says scanning does not work, ask for: the phone and browser, whether the site address starts with https, what the on-screen message says, and the diagnostics text. Almost every case is the https address or a blocked camera permission.

## Related pages

[Accounts](#/docs/accounts) has the support tools for people and plans. [Backups](#/docs/backups) explains your own backups. [Troubleshooting and FAQ](#/docs/troubleshooting-faq) lists common problems. [Glossary](#/docs/glossary) explains the terms.
