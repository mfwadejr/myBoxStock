---
title: Team
summary: Give your staff their own sign-ins, choose what each person is allowed to do, reset a forgotten password, and switch off or remove someone who has left.
keywords: pending invitation, set up access, restore team, team in backup, team, staff, users, add person, employees, roles, administrator, standard, view, permissions, reset access, reset password, disable, enable, delete user, 2FA, sign out, account menu, backup, last sign-in, temporary password, email confirmation
order: 7
covers: nav:team, Team members are in the backup, Pending invitation, Set up access, Sign out in the account menu, Add person, Username, Email (optional), Role, Temporary password, Add, Cancel, Role, 2FA, Last sign-in, From IP, Signed in on, Reset access, New temporary password, Reset, Delete, Disable, Enable, Administrator, Standard, View, users.manage, Reseller ID
---

## What the Team page is for

The **Team** page is where you decide who can sign in to your business account and what they are allowed to do once they are in. Instead of everyone sharing one password, each person gets their own username. That gives you three big benefits:

- **Safety.** If someone leaves, you switch off just their sign-in. Nobody else has to change a password.
- **Control.** A new part-time helper can ring up sales without being able to change your settings or see who else has access.
- **Accountability.** Your account keeps an [Activity](#/docs/activity) record of who did what, which only works if each person signs in as themselves.

This page is only for **Administrators**. Anyone else does not see **Team** in the menu, and if they reach it they are told "Only administrators can manage the team."

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## How people sign in

Everyone on your account signs in with three things:

1. The **Reseller ID** of your business. It looks like `amber-fox-4271`. It is shown at the top of the Team page and on the [Security](#/docs/security) page, and it was in your welcome email. Everyone on your team uses the same Reseller ID.
2. Their own **username**.
3. Their own **password**.

The sign-in screen remembers the Reseller ID on that browser, so next time only the username and password are needed.

Behind the scenes a person's full sign-in name is their username followed by `@` and your Reseller ID, for example `sam@amber-fox-4271`. You will see this full form when you are asked to confirm a delete.

## The three user types (roles)

Every person has one user type, called a **Role**. The app comes with three, and these are the ones you can choose from when you add someone.

### Administrator

Can do everything. That includes:

- everything a Standard user can do,
- the **Team**, **Settings** and **Activity** pages,
- giving discounts of any size (Standard users are limited by a setting),
- changing the warranty on an existing sale,
- using **Export everything** and **Close account** on the Security page,
- creating a new recovery key.

Give this role only to people you trust fully, such as yourself and perhaps a business partner. An Administrator can also read the mail server details saved in Settings, if you have set up your own mail server.

### Standard

For everyday staff. A Standard user can:

- see and change **Inventory** (read and write),
- record sales on **Quick sale** and see **Sales**, including voiding a sale,
- see and change **Customers**.

A Standard user cannot open **Team**, **Settings**, **Backup and restore** or **Activity**, cannot change a warranty on an existing sale, cannot make or restore a backup, export everything or close the account, and can only give discounts up to the limit you set in [Settings](#/docs/settings) (the default is 10 percent of a sale).

### View

For people who only need to look, such as a bookkeeper or someone on work experience. A View user can open **Inventory**, **Sales** and **Customers** and look at them, print and email receipts and export a single customer, but cannot add, change, delete or sell anything. The buttons that make changes are hidden or the fields are greyed out. They do not see **Quick sale**.

### What every person can see

Every signed-in person has **Home**, **Security** (for their own password, email and two-factor) and **Documentation**.

> The menu only shows what a person is allowed to use, so a Standard user's menu is shorter than yours. If a staff member says "I cannot find Settings", that is normal. It is for Administrators.

### About custom roles

The app currently offers just these three user types. There is no screen for creating your own. If you need something in between, pick the closest of the three.

## Reading the team table

The table lists everyone on your account, in the order they were added. The columns are:

- **Username** - the person's username.
- **Role** - Administrator, Standard or View.
- **2FA** - "on" (green) if they have turned on two-factor authentication, "off" otherwise. Two-factor adds a code from their phone at sign-in. It is optional and set up by each person on their own [Security](#/docs/security) page. You cannot turn it on or off for them.
- **Last sign-in** - how long ago they last signed in.
- **From IP** - the internet address of their last successful sign-in, a useful clue if something looks odd.
- **Signed in on** - how many devices they are signed in on right now, for example "2 devices".
- A final column of buttons: **Reset access**, **Delete** and **Disable** or **Enable**. These are not shown on your own row, so you cannot lock yourself out by accident.

## Adding a person

1. Open **Team** from the menu.
2. Press **Add person**. A form opens.
3. Fill in the fields:
   - **Username** - 3 to 30 characters, using letters, numbers, dots, underscores or hyphens. It must not already be used in your account. Capital letters are turned into small letters.
   - **Email (optional)** - the person's email address. If you add it, they are sent a link to confirm it, and it lets them use "Forgot password?" on the sign-in screen. If you leave it blank they simply have no email on file.
   - **Role** - choose Administrator, Standard or View.
   - **Temporary password** - at least 10 characters, with both letters and numbers.
4. Press **Add**. You see "Person added" and they appear in the table. Press **Cancel** to back out.
5. Tell the person their Reseller ID, their username and the temporary password. Do this privately, in person or by phone rather than by a public chat.

The form reminds you: "They'll be asked to change it at first sign-in." When they first sign in with the temporary password the app makes them choose a new one before they can do anything else. Their new password must be at least 10 characters with letters and numbers.

Why a temporary password? Because you should not know anyone's real password. The temporary one is only for the first sign-in.

### Your own email must be confirmed first

If your own email address has not been confirmed yet, the app will not let you add people and tells you to confirm your own email address first, using the link that was emailed to you. If you cannot find the email, a blue banner on **Home** and **Security** says "Confirm your email address" with a **Send it again** button. Once you click the link in the new email, you can add people. This only applies when the site is able to send email. The reason is that a confirmed email on the person who creates accounts makes it much harder for anyone else to misuse your account.

### Encryption and new people

Your business data is encrypted in the browser. When you add someone, your browser quietly shares the means to open the data with them, protected by the temporary password you chose. That is why the person you add can see your data after they sign in and choose their own password, and why there is nothing extra for you to set up. Remember that anyone you add can read whatever their role lets them see.

## Resetting someone's access

Use **Reset access** when a person has forgotten their password, or you suspect someone else knows it.

1. Find the person in the table and press **Reset access**.
2. A box opens saying it gives the person a new temporary password and signs them out. They will choose their own at next sign-in and keep access to the data.
3. Type a **New temporary password** (at least 10 characters, letters and numbers).
4. Press **Reset**. You see "Access reset". Press **Cancel** to back out.
5. Tell the person the new temporary password.

What happens: any device they were signed in on is signed out straight away, and they must choose a new password the next time they sign in.

You cannot reset your own access here. To change your own password, use [Security](#/docs/security).

> People who have an email address on file can also use "Forgot password?" on the sign-in screen. **Reset access** is the dependable way when email is not set up or the person cannot reach their inbox. If you are an Administrator who has lost your own password, you will need your recovery key. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Disabling and enabling someone

**Disable** stops a person from signing in without deleting them. Press **Disable** on their row. They are signed out immediately on every device, and the button changes to **Enable**. Press **Enable** later to let them back in; they use the same username and password as before.

When would you use it?

- A seasonal worker has finished for the summer and may return.
- You are investigating something odd and want to pause an account.
- Someone is away for a long period and you want no open sign-ins.

A disabled person who tries to sign in is told their sign-in has been disabled and to ask their account administrator.

You cannot disable yourself.

## Deleting someone

**Delete** removes a person from the account for good.

1. Press **Delete** on their row.
2. A box asks "Delete person?" and explains that they will be removed and can no longer sign in, and that it cannot be undone.
3. Type the person's full sign-in name (for example `sam@amber-fox-4271`) in the box, then confirm.

What is removed: their sign-in, their devices' sessions, and their stored sign-in history. The sales and inventory records they created stay, because that data belongs to the business, not to the person.

Rules:

- You cannot delete yourself.
- An account must always have at least one Administrator. If you try to delete the last one you are told so.

> Disable first, delete later. If you are not sure, **Disable** is reversible and **Delete** is not.

## Signing people out

There is no sign-out button on the Team page. People are signed out of every device automatically when you press **Disable**, **Reset access** or **Delete**. The **Signed in on** column shows how many devices a person is currently using, so you can see the effect. Each person can also sign themselves out at any time. Tap or click your username at the top right to open the account menu, then choose **Sign out**. (On a phone the menu rises from the bottom of the screen. The **More** sheet is only for moving between pages, so Sign out is not there.)

## Team members and backups

A backup file made on the [Backup and restore](#/docs/backup-and-restore) page contains your **team list**: each person's username, email and user type (Administrator, Standard or View), locked with your key like the rest. It never contains passwords, two-factor secrets or sign-ins.

When you restore a file, the restore sheet has a switch **Add team members (N in this file)**, on by default. People from the file who are not already on your team come back as **pending invitations**. On this page they carry a **Pending invitation** tag and cannot sign in yet. Press **Set up access** on their row (it works like **Reset access**), give them a temporary password and tell them their Reseller ID and username. They then choose their own password and set up their own two-factor. People who match a current member by username or email are skipped, nobody's user type is changed, and **Replace everything** never removes anyone. **Undo last restore** removes the invitations that restore added (only those still pending).

A pending Administrator does not count as "another Administrator" when you delete someone: an account always needs one person who can really sign in.

## Practical advice

- **One person, one login.** Never share a login. If two people share one, the Activity log cannot tell them apart and you cannot remove just one.
- **Give the least role that works.** Start new people as Standard, or View if they only need to look.
- **Review the list now and then.** Check the **Last sign-in** column for people who have not signed in for months, and the **From IP** column for anything unexpected.
- **Encourage two-factor.** The **2FA** column shows who has it. It is each person's choice, but for Administrators it is a very good idea.
- **Keep at least two people who know the recovery key situation.** If everyone forgets their passwords, only the recovery key can restore access, and the site operator cannot do it for you. See [Your data, your responsibility](#/docs/your-data-your-responsibility).
- **When a trial or paid period ends the app can become read-only.** See [Plans, trials and billing](#/docs/plans-trials-billing).

## Common mistakes

- Typing the username with spaces or symbols other than `.`, `_` and `-`, which gives "Username: 3-30 letters, numbers, . _ -".
- Choosing a temporary password with no digit, which is refused.
- Reusing a username that already exists. You are told it is taken.
- Forgetting to give the new person the Reseller ID. They need all three: Reseller ID, username, password.
- Deleting when you meant to disable.

If something else goes wrong, see [Troubleshooting and FAQ](#/docs/troubleshooting-faq). The [Glossary](#/docs/glossary) explains terms such as Reseller ID and 2FA.
