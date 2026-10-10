---
title: Getting started
summary: Sign in to the Host Console for the first time, set up two-factor, learn what each menu item is for, and work through a first-day checklist.
keywords: account menu, name menu, first sign-in, login, temporary password, change password, two-factor, 2FA, authenticator, owner, helper administrator, menu, checklist, first day, documentation, search, host console
order: 1
covers: nav:docs, Terms, Privacy, Data use, Billing, Username, Password, Sign in, Two-factor code, Verify, Use a different account, Set up two-factor, Sign out, Choose a new password, Current password, New password, Update password, Owner, helper administrator, Documentation search box, Documentation contents, Account menu, Reseller accounts, Host administrator, Sign out
---

## What the Host Console is

The Host Console is the control room for whoever runs this myBoxStock server. You reach it by adding `/host/` to the site address, for example `https://app.example.com/host/`. Your customers (the businesses that sign up) use a different place, `/app/`, and they never see the Host Console.

Your job as the Host is to keep the server healthy, safe and reachable, and to help customers with sign-in problems. It is not your job to look after their stock or sales, and the system is built so that you cannot see them even if you wanted to.

> The most important idea in this whole Documentation: customers own their data. It is encrypted in their own browser before it reaches your server, so you only ever see identity, plan, security and server facts. Customers are fully responsible for their own data, their recovery key and their own exports. You cannot recover what they lose.

That one fact explains many of the choices you will meet in the console: there is no "look at this customer's inventory" button, and a password reset never recovers their data on its own.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## Your first sign-in

When the server starts for the very first time it creates one administrator called `admin` with a temporary password. The password is printed once in the server's start-up output. With Docker you can see it by running `docker compose logs myboxstock`. Copy it straight away.

1. Open `/host/` on your site.
2. Type `admin` in **Username** and the temporary password in **Password**.
3. Press **Sign in**.
4. You will be taken to **Choose a new password** and told to replace the temporary password before continuing. Type the temporary password in **Current password**, then your new one in **New password**. It needs at least 10 characters with letters and numbers.
5. Press **Update password**.
6. You are now in the console, starting at [Overview](#/docs/overview).

Under the sign-in box are four short links, **Terms**, **Privacy**, **Data use** and **Billing**. They open the legal pages (Terms of Service, Privacy Policy, Data responsibility and acceptable use, and Billing, trial and refund terms) in a new tab; hold the pointer over a link to see the full title. The same four links sit at the bottom of every page, here and in the reseller app.

> If you lose the temporary password before using it, or you get locked out later, see [Recovery and emergencies](#/docs/recovery-and-emergencies). Do not keep guessing passwords.

### Set up two-factor now

Two-factor means that, after your password, you also type a 6-digit code from an authenticator app on your phone. It protects the console even if your password leaks, which matters because this account can suspend every customer.

1. Open **Security** in the menu.
2. In the Two-factor authentication card, press **Set up**.
3. Follow the steps: scan the code with an authenticator app, type the code it shows, and save the recovery codes you are given somewhere safe (not on the server).
4. From then on, sign-in shows **Two-factor code**: type the 6-digit code from your app, or one of your recovery codes, and press **Verify**.

If you reach the code screen with the wrong account, use **Use a different account** to go back to the sign-in form.

Why do this on day one? Because the server is on the internet. See [Security](#/docs/security) for everything on that page.

## Owner and helper administrators

The first administrator, normally `admin`, is the **Owner**. The Owner is the oldest administrator, cannot be deleted, and is the only one who can:

- add, delete and edit other administrators, reset their two-factor, set their temporary passwords and sign them out (all on the [Security](#/docs/security) page);
- change an account's **Allow this account to link a Host administrator** setting (see [Accounts](#/docs/accounts));
- receive the alert emails the system sends about server problems (see [Alerts](#/docs/alerts)).

Anyone else you add is a **helper administrator**. Helpers can do the day-to-day work such as supporting accounts, but they must set up two-factor before they can use the console. A helper who signs in without two-factor sees **Set up two-factor** and a **Sign out** link, and nothing else works until they finish. The Owner is exempt from this rule only so that nobody can be locked out of their own server, but the Owner should still turn it on.

When the Owner adds a helper, the Owner chooses a starting password, and the helper, like you, must change it at first sign-in.

> Give each person their own administrator login. Every support action is written to the log with the name of who did it, and shared logins make the [Audit trail](#/docs/audit-trail) useless.

### The account menu

At the top right of every page is a pill-shaped button with your name. This is the **account menu**. Click or tap it to open the menu. It closes when you click elsewhere, press Escape or choose an item. With the keyboard, the arrow keys, Home and End move through it. On a phone it rises from the bottom of the screen as a sheet.

The menu has:

- a header with your name and "Host administrator";
- **Reseller accounts**, a short list of business names. This heading only appears when you also run a reseller account of your own and it has been linked to your administrator login. Choosing a business opens that account's app in a new browser tab. It only appears when the Owner has allowed linking for that account (see [Accounts](#/docs/accounts));
- **Sign out**.

There is no separate Sign out button or name label any more. Use **Sign out** from this menu on any computer that is not yours. The same menu exists in the reseller app, where it also offers a "Site admin" entry for accounts linked to a Host administrator.

## Tour of the menu

The menu is the same on every page. Each item opens one screen.

- **Overview** shows how healthy the server is right now. See [Overview](#/docs/overview).
- **Alerts** lists problems the server noticed. See [Alerts](#/docs/alerts).
- **Accounts** is where you help individual customers. See [Accounts](#/docs/accounts).
- **Pipeline** shows sign-ups, trials, renewals and accounts that have gone quiet. See [Pipeline](#/docs/pipeline).
- **Onboarding** shows how far new accounts get through setup. See [Onboarding](#/docs/onboarding).
- **Plans** is the list of plan names, prices and limits. See [Plans](#/docs/plans).
- **Backups** protects the server itself: frequent snapshots, offsite copies, full-site backups and the place to restore from. See [Backups](#/docs/backups).
- **Email** controls outgoing mail and the wording of messages. See [Email](#/docs/email).
- **Firewall** controls who can reach the site and the Host Console. See [Firewall](#/docs/firewall).
- **Security** is your own password, two-factor and the administrator list. See [Security](#/docs/security).
- **Settings** holds platform-wide options and the announcement banner. See [Settings](#/docs/settings).
- **Logs** is the searchable activity record. See [Logs](#/docs/logs).
- **Audit trail** shows who did what in the console. See [Audit trail](#/docs/audit-trail).
- **Updates** tells you about new versions. See [Updates](#/docs/updates).
- **Documentation** is this manual.

There is also a page for helping resellers with their own backups and phone scanning: [Support and diagnostics](#/docs/support-and-diagnostics).

If a problem needs attention, a red bar appears at the top of every page saying how many problems need a look, with a link to Alerts. Alerts you have set aside do not count.

At the top right is the account menu described above, with your name and **Sign out**. Click the myBoxStock mark at the top left to go back to Overview.

## First-day checklist

Work through these once. Each one has a full page behind it.

1. **Set the site address.** Open [Settings](#/docs/settings) and fill in **Site address (used for every link in an email)**, for example `https://app.example.com`, without any path. Confirmation, reset and welcome emails all link to it, and the Overview warns "Email links will not work" until it is right.
2. **Set up email.** Open [Email](#/docs/email), connect your outgoing mail and send a test. Without it customers cannot confirm their address or reset a password by email.
3. **Check backups.** Open [Backups](#/docs/backups) and follow **Backup setup** at the top: set and confirm the passphrase, say where copies go (a destination must pass Test connection), choose how much to keep, then run the first backup and test restore. Only then does the page say Protected. Frequent snapshots are on by default. Then read [Recovery and emergencies](#/docs/recovery-and-emergencies). Your backup covers the server; customers must still keep their own exports and recovery keys.
4. **Check the firewall and Host Console access.** Open [Firewall](#/docs/firewall). Decide whether the Host Console should answer only to listed addresses. Add your own address first so you do not lock yourself out.
5. **Turn on two-factor** for yourself (above) and add helpers only if you need them.
6. **Decide on sign-ups and trial length** in [Settings](#/docs/settings): leave **Open sign-ups** on if you want new customers, and pick the **Free trial length for new sign-ups (days)**.
7. **Write your plans** in [Plans](#/docs/plans), even if nothing is charged yet.
8. **Optionally post an announcement** under Settings, for example "Welcome. Please save your recovery key when you first sign in."

> Tell new customers, in your welcome announcement or sign-up page, that they are responsible for saving their recovery key and making their own exports. You cannot do it for them.

## Using this Documentation

Open **Documentation** in the menu. The page has one layout. The contents menu is on the left with every topic, and the open topic is on the right, below a search box. The first time you open it, it shows Getting started. Click another topic in the contents to read it, and use the **previous** and **next** buttons at the bottom of a topic to read in order. On a phone the contents is a compact list at the top of the page.

To search, type in the box above the topic that says "Search the documentation: a menu name, a setting, or a question". Searching starts after you type two letters. Results show the page and the section the words were found in, with a short extract. Try a menu name like "Firewall", a button label like "Suspend", or a plain question such as "customer forgot password". Every button and field on a screen is mentioned on its page, so searching the exact label usually lands you in the right place.

If a search finds nothing, try fewer or different words; the message reads "Nothing found".

## Common mistakes on day one

- Leaving the temporary password in place. The console forces you to change it, but keep it out of chat messages and emails afterwards.
- Skipping two-factor because "it is only a test server". Test servers become real quickly.
- Forgetting the site address, so every email link is wrong.
- Turning on the Host Console address list before adding your own address. See [Firewall](#/docs/firewall).
- Assuming you can rescue a customer's data. You cannot, and the customer is told that.

When you are ready, continue to [Overview](#/docs/overview), and keep [Troubleshooting and FAQ](#/docs/troubleshooting-faq) and the [Glossary](#/docs/glossary) close by.

## Using the Host Console on a phone or tablet

The Host Console works on phones and tablets as well as laptops and desktops. On a small screen the menu moves to a bar along the bottom with Overview, Alerts, Accounts and Logs; tap **More** for every other page. The More sheet is only for moving around: sign out from the account menu at the top right. Tables turn into labelled cards so nothing scrolls sideways, and pop-ups slide up from the bottom. This is handy for checking Alerts or the Overview when you are away from your desk.
