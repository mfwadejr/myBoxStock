---
title: Settings
summary: Every option on the Host Settings screen explained: sign-ups, trial length, site address, sign-in history, the announcement banner, the server options that used to be container variables, and the safety checks that stop you locking yourself out.
keywords: custom proxy value, restore announcement, clear announcement, settings, site address, public url, email links, trial days, trial length, open sign-ups, signups, sign-in history, announcement, banner, maintenance notice, secure cookies, https, private mail, reverse proxy, trust proxy, proxies, cloudflare, real visitor address, log detail, log level, log retention, back to server defaults, reset, lockout guard, database engine
order: 12
covers: nav:settings, Open sign-ups, Free trial length for new sign-ups (days), Site address (used for every link in an email), Use (this address) button, Keep sign-in history (days), Save, Announcement banner, Show the banner, Message, Style, Information (blue), Heads-up (amber), Important (red), Last day to show it (optional), Save announcement, Server options, Secure cookies, Resellers' mail servers on private networks, Site is behind Cloudflare, Reverse proxy in front of the site, Log detail, Keep the activity log (days), Save server options, Back to server defaults, Database engine, Saved here, Using the server default, Custom (set by the container), loopback, Show the banner off, restore notice, PUBLIC_URL, TRUST_PROXY, SECURE_COOKIES, MAIL_ALLOW_PRIVATE, CLOUDFLARE_IP, LOG_LEVEL, LOG_RETENTION_DAYS
---

## What this screen is for

Settings is where you change the platform-wide options for the whole site. It is the only screen in the Host Console that affects every customer at once, so it is worth knowing what each control does before you press Save.

The screen has four cards, one after another:

1. The first card holds the everyday options: **Open sign-ups**, the free trial length, the site address and how long sign-in history is kept. It has its own **Save** button.
2. **Announcement banner** is a single message that every customer sees inside their app. It has its own **Save announcement** button.
3. **Server options** are technical switches (secure cookies, proxies, Cloudflare, log detail and so on). They used to be settings you could only change by editing the container. They have **Save server options** and **Back to server defaults** buttons.
4. **Database engine** is information only. It tells you which database the server is using and shows the commands for moving to a bigger one.

Each card saves on its own. Pressing Save on one card never changes the others.

> The Host never sees what customers store in their accounts. Nothing on this screen changes that. These options control how the platform behaves, not what is inside anyone's inventory.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. See [Email](#/docs/email).

## Open sign-ups

This switch decides whether new businesses can create an account from the sign-up page.

1. Open **Settings** from the menu.
2. Find **Open sign-ups** ("Allow new businesses to create an account").
3. Turn it on to allow sign-ups, or off to close them.
4. Press **Save** at the bottom of the same card.

When it is off, anyone who tries to sign up is told that sign-ups are closed right now. People who already have accounts are not affected in any way.

Why you might close sign-ups: maintenance, a full server, or onboarding by invitation only. Flipping the switch does nothing until you press Save.

## Free trial length for new sign-ups (days)

This is the number of days a brand-new account gets before its trial ends. It accepts a whole number from 1 to 365.

1. Type the number of days in the box.
2. Press **Save**.

If you enter something that is not a whole number in that range, you get a message saying so and nothing is saved.

Important: the new length applies only to accounts created from now on. Accounts that already exist keep their own end date. To change one existing account, go to Accounts and use that account's Change plan option (see [Accounts](#/docs/accounts) and [Plans](#/docs/plans)).

Example: you have been giving 14 days and want to run a month-long promotion. Set 30, Save, and anyone who signs up from that moment gets 30 days. Someone who signed up yesterday still has their original 14.

## Site address (used for every link in an email)

This is one of the most important fields on the screen. It is the address people type to reach your site from anywhere, for example `https://boxes.yourdomain.com`. Every link that the site puts into an email is built from it: the link to confirm an email address, the link to reset a password, and the welcome email.

Why it matters: the server cannot guess its own public address, so a wrong one means emails with links that go nowhere.

How to set it:

1. Type the full address starting with `https://`, with nothing after the domain. `https://boxes.yourdomain.com` is right. `https://boxes.yourdomain.com/app/` is not.
2. Press **Save** on the card.

The site checks what you typed and refuses or warns in plain words:

- Not a web address at all: "Use the form https://app.example.com".
- It has a path, a question mark or a hash: "Use just the address, like https://app.example.com (no path)".
- It still uses an example domain: "This is still the example address. Enter your real site address."
- It is an address only your own network can reach (such as `localhost`, a name ending in `.local`, `.lan`, `.home` or `.internal`, a name with no dot, or a private number like `192.168.1.20`): "This is an address only your own network can reach. People outside it will get a broken link."
- It starts with `http` instead of `https`: "This address is not secure (http). Use https."

A trailing slash is removed for you. If there is a problem, a notice appears under the field, and the Overview screen also shows "Email links will not work" with a link back here, so you are reminded until it is fixed.

### Where the value comes from

If you have not saved an address here, the server falls back to the `PUBLIC_URL` setting of the container, and the hint under the field tells you so and shows the value being used. If you save an address here, it wins over `PUBLIC_URL`. If you clear the box and save, the saved address is removed and `PUBLIC_URL` is used again.

### The "Use" button

When you are viewing the Host Console over a real https address, no address is saved yet, and the web address looks public (it contains a dot and is not a `.local`, `.lan`, `.home`, `.internal` or numeric address), a button appears that reads "Use" followed by the address you are on. It simply copies that address into the box. You still need to press **Save**.

> Tip: the quickest correct setup is to open the Host Console from the real public https address, press that Use button, then Save.

## Keep sign-in history (days)

Every account keeps a list of who signed in, from which address and on what device. This setting is how long those entries are kept. It accepts a whole number from 7 to 730. Older entries are removed automatically (the server checks about every six hours).

Why it exists: a long history helps a customer notice a stranger signing in; a short one keeps less personal information on your server. It is separate from the log retention described below.

## Announcement banner

The announcement banner lets you show one message at the top of every customer's app, for maintenance notices or news. It is plain text only (no formatting or links), and it is never tied to any customer's data.

### The fields

- **Show the banner**: the on/off switch. While off, customers see nothing, even if a message is saved. Customers see the banner the next time they open or move around the app.
- **Message**: up to 400 characters. Example: "The site will be offline for maintenance on Saturday from 2 to 3 AM." You cannot turn the banner on with an empty message.
- **Style**: how it looks. **Information (blue)** for general news, **Heads-up (amber)** for something people should plan around, **Important (red)** for urgent notices.
- **Last day to show it (optional)**: a date. The banner is shown through that day and stops after it. Leave it empty to show the banner until you turn it off yourself.

### How to publish a notice

1. Write your message in **Message**.
2. Choose a **Style**.
3. Optionally pick a **Last day to show it**.
4. Turn **Show the banner** on.
5. Press **Save announcement**. You see "Announcement saved".

Each customer can close the banner with its Close button. After you restore a backup, the site posts a notice here by itself (see below). If you later change the message, the style, the last day, or turn the banner back on after it was off, the banner counts as new and appears again for people who had closed the old one. If you only change something else, people who closed it do not see it again.

### The notice after a restore

When you restore a backup from the Backups page (see [Backups](#/docs/backups)), the site starts again and turns this banner on at the **Important (red)** level, with the text: "The site was restored from a backup taken YYYY-MM-DD HH:MM UTC. Sales or changes made after that time may be missing. Please check your recent activity." If you had another announcement up, the restore notice replaces it.

It stays until you take it down. When resellers have had time to check their activity, open Settings, turn **Show the banner** off (or change the **Message**) and press **Save announcement**. The restore notice is only posted for restores made from the Backups page, not for the `restore-bundle` command on the server.

> Tip: set a Last day whenever you can. A maintenance notice that stays up for weeks teaches customers to ignore banners.

Mistakes to avoid: writing the message but leaving the switch off (nobody sees it), and using red for routine news so that a real emergency looks the same as everything else.

## Server options

This card holds options that used to be container environment variables. You can now change them here without editing the container and without restarting. Changes take effect straight away.

### How saved values win over the container

For each option the server decides its value in this order:

1. If you have saved a value here, that value is used.
2. If nothing is saved here, the value from the container's environment is used.
3. If the container does not set it either, the built-in default is used.

Next to each option the screen says either **Saved here.** or **Using the server default.** so you always know which of the two is in charge. This matters if you edit your container settings later and nothing seems to change: a value saved here will keep winning until you return it to the server default.

### The options

- **Secure cookies**: sends sign-in cookies only over https. Turn it on once the site is served through https. It can only be turned on while you are viewing the console over https; otherwise you get a message that you are not using https right now and that turning it on would stop you signing in. This is deliberate protection against locking yourself out. Container setting: `SECURE_COOKIES=1`.
- **Resellers' mail servers on private networks**: resellers can send receipts through their own mail server. Normally only public mail servers are allowed, so a reseller cannot use your server to probe your internal network. Turn it on only if a reseller legitimately uses a mail relay inside your own network. Container setting: `MAIL_ALLOW_PRIVATE=1`.
- **Site is behind Cloudflare**: turn on when visitors reach the site through Cloudflare, including a Cloudflare tunnel. The firewall, logs and sign-in history then use the visitor's real address from Cloudflare instead of Cloudflare's own. The server only believes this when the request truly arrives from a Cloudflare address, so it cannot be faked by a visitor. Container setting: `CLOUDFLARE_IP=1`.
- **Reverse proxy in front of the site**: choose **None (connect directly)**, **1 proxy**, **2 proxies** or **3 proxies**. It tells the server how many proxies sit between the internet and the site, which is how it learns each visitor's real address for the firewall and sign-in history. Container setting: `TRUST_PROXY`.
- **Log detail**: **Debug (everything)**, **Info (normal)**, **Warnings and errors** or **Errors only**. Container setting: `LOG_LEVEL`. See [Logs](#/docs/logs).
- **Keep the activity log (days)**: how long the database copy of the log is kept, from 7 to 730 days. Container setting: `LOG_RETENTION_DAYS`.

### Saving and resetting

1. Change the options you want.
2. Press **Save server options**. You see "Saved" and the screen reloads, so the "Saved here" notes update.

To undo everything on this card, press **Back to server defaults**. That forgets every value saved here and returns all six options to whatever the container sets. It does not touch the first card, the announcement or any other part of the console.

### Choosing the proxy number

Count the servers that forward traffic to this site. If visitors go straight to the container, choose None. If you run one reverse proxy (Caddy, nginx, Traefik), choose 1. A proxy in front of another proxy is 2. Cloudflare in front of your own proxy usually means turning on **Site is behind Cloudflare** and choosing 1 for your own proxy. More detail is on [Running the server](#/docs/running-the-server).

Signs you chose wrong: every visitor appears to have the same internal address in Logs, or the Firewall screen shows "Your address right now" as an internal number.

### When the container sets something other than a number

`TRUST_PROXY` in the container can hold more than a plain number, for example `loopback` or a list of addresses. When it does, the menu shows an extra choice that reads **Custom (set by the container: loopback)**, with the real value, and that choice is selected. Nothing is wrong. It means the container's own value is in charge.

- Saving the card leaves this value alone unless you pick another option in the menu. You can change other options on the card safely.
- If you do pick **None**, **1**, **2** or **3** and save, your choice is saved and wins over the container.
- **Back to server defaults** puts the container's value back, and so does `reset-server-options` (see [Recovery and emergencies](#/docs/recovery-and-emergencies)). The container variable stays as the first-start value and as the fallback.

There is no longer a warning about overwriting a value like this, because it cannot happen by accident.

## The lockout guard

Changing the proxy count or the Cloudflare option changes which address the site sees for you. If the Host Console is limited to listed addresses (see [Firewall](#/docs/firewall)), a wrong choice could make the site see you as a stranger and shut you out.

To prevent that, before saving either option the site works out which address it would see for you with the new setting. If that address is different from your current one, and it would be refused by the Host Console list or is blocked, the change is refused. The message names the address, for example: with that setting the site would see you as a different address which is not allowed into the Host Console, so add a Host Console rule for it first, then change this.

What to do when you see it:

1. Go to **Firewall** and add the named address under Host Console access.
2. Come back to Settings and save the option again.

The guard does nothing if the Host Console is not limited to a list, and it is skipped if the emergency override `HOST_ALLOW_ANY` is on. If you ever do get locked out, see [Recovery and emergencies](#/docs/recovery-and-emergencies), where `reset-server-options` clears everything saved on this card.

## Database engine

This card shows which engine the server is using now (SQLite, PostgreSQL or MariaDB/MySQL) and has no buttons. SQLite is ideal for testing. For many simultaneous customers, switch to PostgreSQL or MariaDB. The card shows two steps: create an empty database and copy everything across with the `migrate-db` command (the original is left untouched), then point the container at the new database with `DB_CLIENT` and `DATABASE_URL` and restart. The full picture is on [Running the server](#/docs/running-the-server).

## Everything is written down

Every change you save here is recorded in the Audit trail with your name, the time and your address: sign-ups, trial length, site address, sign-in history and the banner turning on or off. For server options, the entry "Server options changed" lists only the options that really changed, each with its value before and after. Pressing Save server options without changing anything is recorded as a save with no change. See [Audit trail](#/docs/audit-trail) if you ever need to answer "who changed that?".
