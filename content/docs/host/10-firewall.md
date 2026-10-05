---
title: Firewall
summary: Control who can open the Host Console, block or exempt addresses site-wide, tune the rate limits and bans, and set up the proxy or Cloudflare options safely.
keywords: bans survive restart, unban, audit, firewall, rate limit, ban, block, allow list, cidr, ip address, host console access, 404, HOST_ALLOW_ANY, cloudflare, proxy, lockout, unban, ports, skip rate limits
order: 10
covers: nav:firewall, Blocked, Rate-limited, Temporary bans, Rate limiting, Requests per IP, per window (seconds), Sign-in attempts per IP, Ban after N violations, Ban length (minutes), Save, Host Console access, Your address right now, Add my address, Add rule, Note (optional), Remove, Block this address, Skip rate limits, Site-wide blocking and rate-limit exceptions, Lift, Ports in this container, HOST_ALLOW_ANY, Reverse proxy in front of the site, Site is behind Cloudflare
---

## What the Firewall page is for

Every request that reaches the server comes from some address on the internet, called an IP address. The Firewall page lets you decide what to do about addresses: slow down ones that make too many requests, ban ones that misbehave repeatedly, block some outright, exempt some from the limits, and restrict who may reach the Host Console at all.

There are two separate ideas on this page, and mixing them up is the most common mistake.

- **Host Console access** controls who may open **your** console, the `/host/` area where you are signing in now. It does not touch your customers.
- **Site-wide blocking and rate-limit exceptions** apply to **the whole site**, including customers' apps, the sign-up page and the Host Console.

> Quick test: if you are asking "who may manage this server?", use Host Console access. If you are asking "how do I stop a bad visitor or help a good one?", use the site-wide rules or the rate limits.

## The three counters

At the top, three tiles show how the firewall has been working.

- **Blocked** is the number of requests refused since the server started, for example by a block rule, a ban, or a Host Console address outside your list.
- **Rate-limited** is the number of requests turned away for going over a limit, since the server started.
- **Temporary bans** is how many addresses are banned right now.

The first two reset to zero whenever the server restarts, so a low number after an update does not mean nothing happened earlier. The third does not reset: bans are saved and survive a restart (see "Temporary bans" below).

## How a request is judged

Each request goes through the same gate, in this order. Knowing it makes the rest easy to follow.

1. If the address matches a **Block this address** rule and does not also match a **Skip rate limits** rule, the request is refused with a plain "Forbidden".
2. If Host Console access is limited to the list and the request is for the Host Console from an address not on that list, it is refused with a plain "Not Found".
3. If rate limiting is off, or the address has a **Skip rate limits** rule, the request goes through.
4. If the address is temporarily banned, it is refused with a "Too many requests" message and a note on when to try again.
5. If the address has made more requests than allowed in the time window, it is refused and counted as a violation.
6. If the request is a sign-in, sign-up or password reset attempt and the address has made too many of those, it is refused and counted as a violation.

## Rate limiting

Rate limiting slows down floods and password guessing. It counts requests from each address over a short time window, and refuses extra ones. Your own address is shown in the description as "Your address". The switch on the right turns the whole feature on or off. It is on by default.

### The fields

- **Requests per IP** is how many requests of any kind one address may make in a window. Default 300. Allowed range 10 to 100,000.
- **...per window (seconds)** is the length of that window in seconds. Default 60. Range 1 to 3,600. So the default means up to 300 requests per minute per address.
- **Sign-in attempts per IP** is how many sign-in, two-factor, sign-up and password reset attempts one address may make in its own window. Default 10. Range 1 to 1,000.
- **...per window (seconds)** (the second one) is that window. Default 300, which is five minutes. Range 10 to 86,400.
- **Ban after N violations** is how many times an address may go over a limit before it is banned. Default 5. Range 1 to 100.
- **Ban length (minutes)** is how long a ban lasts. Default 15. Range 1 to 10,080 (one week).
- **Save** stores all the numbers and the switch together.

### Why these limits exist

A person using the app normally makes a handful of requests a minute, so the defaults are generous. A program hammering the site, or guessing passwords, makes hundreds. Without a limit, one noisy visitor could slow things down for every customer, and anyone could try thousands of passwords a minute.

### Setting them, step by step

1. Open **Firewall**.
2. In the **Rate limiting** card, make sure the switch is on.
3. Change any of the six numbers. Start with the defaults and only change one at a time.
4. Click **Save**. The page reloads with the saved values.

### Things to know

- Limits count per address. If an office or mobile carrier shares one address, everyone counts as one; give it a **Skip rate limits** rule or raise the numbers.
- The request counters (requests per window and sign-in attempts per window) live in the server's memory, on purpose, so a restart starts them again from zero. That is harmless, because they only cover a minute or a few minutes.
- Bans and the count of violations that lead to a ban are different. They are saved in the database, so a restart does not lift a ban or let a banned address start fresh. An update, which restarts the server, does not either.
- Separately, after six wrong attempts in a row a sign-in name is locked for 15 minutes. That cannot be changed here. Lockouts are also saved and survive a restart (see [Security](#/docs/security)).

> Do not set **Sign-in attempts per IP** to 1 or 2. People mistype passwords.

## Host Console access

This card keeps your console private. When it is switched on, only the addresses on the list below it may open the Host Console. Everyone else, including anyone who finds the `/host/` address, sees a plain "Not Found" page, exactly as if nothing lived there. Your customers' app, their sign-in pages and the sign-up page are not affected.

Why it exists: the Host Console is the most powerful part of the site. Even with strong passwords and two-factor, the safest console is one nobody else can even see.

### The pieces of the card

- **The switch next to the heading** turns the access limit on or off. It is off by default.
- **Your address right now** shows the address the server sees for you, with a note saying whether it came from Cloudflare or from the proxy count in Settings.
- **Add my address** adds that address to the list with the note "My address". When your address is already listed and enabled, a green "on the list" label shows instead.
- The box for **an address or range**, the **Note (optional)** box and **Add rule** add any address you type. You can type one address such as `198.51.100.7` or a range such as `203.0.113.0/24`.
- The list shows each entry with a blue "console" label, the address, the note, an on/off switch and **Remove**.

### What a range (CIDR) is

A range such as `203.0.113.0/24` means a block of addresses that start the same way. `/24` covers 256 addresses, `/32` is exactly one. A single address with no slash is fine. Ranges work for IPv4; for IPv6 enter exact addresses.

### Turning it on safely, step by step

1. Look at **Your address right now**.
2. Click **Add my address**. If you work from several places, add each address or range you use, such as the office, your home and your phone's network.
3. Add a note to each, so you know months later which is which.
4. Only then turn on the switch.
5. Open a private browser window from a different network and visit `/host/`. You should see "Not Found".

### Built-in protection against locking yourself out

The page will not let you shoot yourself in the foot.

- You cannot turn the limit on until the list contains a rule that covers your current address.
- You cannot remove or disable the rule that lets you in while the limit is on. You are told to add another rule or turn the limit off first.

### If you see a blue notice

- A notice about **HOST_ALLOW_ANY** means the emergency override is switched on in the container's settings. It makes the server ignore this list completely, so the list is not being enforced. Remove that setting from the container and restart the app to turn it off.
- A notice that your address looks like an internal one means requests are probably arriving through a proxy that is not passing your real address along. Fix this under Settings (next section) before turning the limit on, or you could lock yourself out.

### Why HOST_ALLOW_ANY exists

If you are ever locked out, you can start the server once with the setting `HOST_ALLOW_ANY=1`. For that run, the console is open to every address, so you can get in and fix the list. Take the setting back out afterwards. See [Recovery and emergencies](#/docs/recovery-and-emergencies).

## Site-wide blocking and rate-limit exceptions

This card applies to the entire site, not only the Host Console. It exists for the occasions when one particular visitor is a problem or deserves special treatment.

### Adding a rule

1. Choose the kind with the two buttons: **Block this address** or **Skip rate limits**.
2. Type the address or range in the address box, for example `203.0.113.0/24` or `198.51.100.7`.
3. Optionally type a **Note (optional)**, such as "Scraper seen in logs 5 Oct" or "Warehouse office".
4. Click **Add rule**.

If the box does not hold a valid address or range, you are told to enter one.

### What the two kinds do

- **Block this address** refuses every request from that address or range with a plain "Forbidden", wherever on the site it is aimed, including the Host Console and your customers' app. Use it for an abuser, a scraper or a source of attacks.
- **Skip rate limits** exempts the address or range from the rate limits and bans. It is for people you trust who share one address, such as an office with many staff, or a monitoring service that checks the site often. It also overrides a block rule for the same address. It does not give access to the Host Console: that is still governed by the list above.

> The page refuses a block rule that would cut off your own address, with a message naming it.

### The rules list

Each rule shows a label ("blocked" in red, or "skips limits" in green), the address or range, the note, a switch to turn the rule off and on, and **Remove**. Turning a rule off keeps it for later. Remove deletes it. When there are none, the card says nothing is blocked and everyone is subject to the normal rate limits.

### Mistakes to avoid

- Blocking a range wider than you meant. A `/16` is 65,536 addresses.
- Blocking a shared network such as a mobile carrier, which may catch innocent customers.
- Using the wrong card: Host Console list for who manages the server, site-wide rules for visitors.
- Forgetting that blocked addresses cannot reach the Host Console either.

## Temporary bans

When there are any, a **Temporary bans** card lists each banned address and the time the ban ends, with a **Lift** button (in other words, unban). Lift ends the ban at once and clears that address's violation count. Bans end by themselves after the **Ban length (minutes)**. If a regular customer got banned by mistake, lifting the ban is the quick fix, and a **Skip rate limits** rule is the permanent one.

### Bans survive a restart

An active ban is saved in the database and loaded again whenever the server starts, including the restart that follows an update. The count of violations that is leading towards a ban is kept too, for one hour after the last one. Ban length is unchanged: it is the **Ban length (minutes)** you set, 15 by default. So restarting the container is no longer a way to clear a ban. Use **Lift**.

Only the request counters stay in memory. Restarting does reset those, but they do not decide who is banned.

### What is recorded

Every change on this page is written to the [Audit trail](#/docs/audit-trail) with who did it, when and from which address, and under the Type **Firewall and access**: a rule added, a rule changed (turned on or off), a rule removed, the rate-limit settings changed and the Host Console access limit changed. A ban created by the server is recorded as well, with the name "System", and so is a ban that an administrator lifted (under Type **Bans and lockouts**). The same events are also in [Logs](#/docs/logs), area security.

## Ports in this container

The **Ports in this container** card lists the network ports the server is listening on, found live. The columns are **Port**, **Service**, **Reachable on** and **Enforcement**.

- **Service** is a best guess at what the port is, such as the myBoxStock web service, SSH, PostgreSQL or MariaDB.
- **Reachable on** says whether it listens on all interfaces, only on the machine itself (loopback), or a specific address.
- **Enforcement** says "active" for the web port, where the rules and limits on this page are applied, and "visibility only" for the rest. The page shows other ports so you know they exist, but it does not filter them.

Your host's own firewall, or your cloud provider's security groups, are what protect other ports.

## Real addresses: proxy count and Cloudflare

Everything on this page depends on the server seeing each visitor's real address. If the site sits behind a reverse proxy (such as Caddy, nginx or Traefik) or Cloudflare, the server would otherwise see the proxy's address for everyone. Then rate limits would treat all visitors as one person, bans would hit everybody, and your Host Console list would be useless.

These two options are in **Settings**, under Server options. See [Settings](#/docs/settings).

- **Reverse proxy in front of the site** is the number of proxies between the internet and this server: none, 1, 2 or 3. It tells the server how far back in the forwarding chain to read the real address.
- **Site is behind Cloudflare** tells the server to read the visitor's address from the header that Cloudflare adds. It trusts that header only when the request arrives from one of Cloudflare's published address ranges, so nobody else can fake it. Use it when the proxy count cannot give the real address, for example with a Cloudflare tunnel.

Both are protected against lockouts. If a change would make the server see your address differently, and the new address is not on your Host Console list (or is blocked), the change is refused with a message naming the address to add first. Add that address to the list on this page, then change the setting.

If a saved server option ever locks you out, the command `node server.mjs reset-server-options` clears them and the container's own settings apply again.

> To check it works, look at **Your address right now** on this page. It should be your real public address, not an internal one like `10.` or `192.168.`.

## Related pages

- [Security](#/docs/security) for your password, two-factor and the administrator list.
- [Alerts](#/docs/alerts) for the "Many failed sign-ins" warning.
- [Running the server](#/docs/running-the-server) for container settings such as HOST_ALLOW_ANY.
