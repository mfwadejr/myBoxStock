---
title: Running the server
summary: How myBoxStock is deployed and kept healthy: the Docker container, the data folder, every environment variable with its default, reverse proxies and Cloudflare, https, ports, the health check, choosing a database, and how to keep the data volume safe.
keywords: docker, zimaos, compose, docker-compose, container, data folder, volume, /data, environment variables, PORT, DATA_DIR, DB_CLIENT, DATABASE_URL, TRUST_PROXY, SECURE_COOKIES, PUBLIC_URL, APP_SECRET, LOG_DIR, reverse proxy, caddy, nginx, traefik, cloudflare, https, health check, healthz, sqlite, postgres, postgresql, mariadb, mysql, migrate-db, ports, resources, memory, disk
order: 17
covers: PORT, DATA_DIR, DB_CLIENT, DATABASE_URL, DB_POOL_MAX, TRUST_PROXY, CLOUDFLARE_IP, HOST_ALLOW_ANY, SECURE_COOKIES, MAIL_ALLOW_PRIVATE, PUBLIC_URL, APP_SECRET, LOG_DIR, LOG_LEVEL, LOG_MAX_MB, LOG_FILES, LOG_RETENTION_DAYS, LOG_CONSOLE, CLOSING_SWEEP_MS, BUILD_ID, BACKUP_PASSPHRASE, NODE_ENV, /healthz, docker-compose.yml, restart policy, migrate-db
---

## The big picture

myBoxStock runs as a single program in a single container. One container serves two things from the same web address:

- **/app/** is where your customers (the resellers and their staff) sign in.
- **/host/** is the Host Console you use to run the server. Visiting the bare address sends people to /app/.

All of the server's memory of what happened lives in one **data folder**. The container itself can be thrown away and rebuilt at any time, which is exactly how updates work, as long as the data folder is kept. If you remember one rule from this page, make it that one: **the container is disposable, the data folder is precious.**

## Deploying with Docker (and ZimaOS)

The project includes a `Dockerfile` and a `docker-compose.yml`. The container is built on a small Node 22 image, and it listens on port 8080 inside. The standard compose file looks like this in spirit:

- The service is called `myboxstock` and is built from the project folder.
- `restart: unless-stopped`. This is **required**, not optional: restoring a backup works by letting the program exit and be started again by Docker. Without it, a restore would leave the server stopped.
- It maps port 8080 on the host to 8080 in the container.
- It sets a few environment variables: `TRUST_PROXY`, `SECURE_COOKIES` and `PUBLIC_URL`, with `APP_SECRET` as an optional extra.
- It mounts `./data` on the host as `/data` in the container. That is the data folder.

### First start

1. In the project folder, run `docker compose up -d --build`.
2. Read the container's output: `docker compose logs myboxstock`. On the very first start it prints a box headed FIRST RUN with the username `admin` and a temporary password. It is shown only once.
3. Open `/host/`, sign in, and choose a new password when asked.
4. Go to [Security](#/docs/security) and turn on two-factor.
5. Go to [Settings](#/docs/settings) and set the **Site address**.
6. Work through [Getting started](#/docs/getting-started) for the rest of the first-day setup.

### On ZimaOS

ZimaOS runs Docker for you and lets you add your own apps. The idea is the same as above: install myBoxStock from the compose file (using ZimaOS's custom app import, or a terminal on the box), and point the container's `/data` at a folder on your storage, one you will back up. Make sure the app is set to restart automatically. When ZimaOS shows an app's "update" or "rebuild" option, that is the equivalent of the compose command in [Updates](#/docs/updates).

> Whatever the platform, check two things before you walk away: the data folder is mapped to real storage (not a temporary one), and the restart policy is on.

### Without Docker

You can also run it directly with Node 22.13 or newer: `npm install && npm start`. The data folder then defaults to a folder called `data` next to the program. Docker is the recommended route because it keeps everything the same on every machine.

## The data folder

Everything the server remembers lives in the folder mapped to `/data` (the `DATA_DIR` setting). With the default SQLite database it contains:

- `myboxstock.db`, the database, plus `myboxstock.db-wal` and `myboxstock.db-shm` while it is running. Never delete or copy those three separately while the server is running.
- `secret.key`, the encryption key that protects two-factor secrets and the saved email password. It is created automatically on first start with private permissions.
- `backups/`, where the Backups screen keeps its files.
- `logs/`, the log files described on [Logs](#/docs/logs).
- Short-lived files such as `restore-pending.db` while a restore is waiting to be applied.

With PostgreSQL or MariaDB the database lives elsewhere, but the data folder still holds the key, the backups and the logs.

### Keeping it safe

- Put it on storage you trust, and **back it up away from the server**. The scheduled full-site backup can copy each backup to an off-box folder, such as a mounted NAS share or USB drive. See [Backups](#/docs/backups).
- Keep a copy of `secret.key` (or your `APP_SECRET` value) somewhere safe. Full-site backups include it, plain database snapshots do not.
- Never run two copies of the server on the same SQLite data folder.
- Restrict who has access to the box. Anyone who can read the folder can read the database. Customers' business data is encrypted in their own browsers, so what is stored is unreadable without their passwords or recovery keys, but accounts, usernames and sign-in history are not.
- Watch the disk. See [Recovery and emergencies](#/docs/recovery-and-emergencies) for what to do as it fills.

## Environment variables

These are set in the `environment:` part of the compose file (or your platform's equivalent). Switch-style variables are on only when set to exactly `1`. A few of them can also be changed in the Host Console, and a value saved there wins; see [Settings](#/docs/settings).

### Basics

- **PORT**: the port the program listens on inside the container. Default `8080`.
- **DATA_DIR**: where the data folder is. Default: a `data` folder next to the program; in the Docker image it is `/data`.
- **PUBLIC_URL**: the public web address, such as `https://boxes.yourdomain.com`, used in email links when no Site address is saved in Settings. Default empty.
- **APP_SECRET**: optional. A long random phrase the encryption key is made from. If left empty, a key is generated and stored in `secret.key`. Choose one or the other and keep it safe; changing it later makes existing two-factor secrets unreadable.
- **BUILD_ID**: optional label shown beside the version, usually set when building the image.
- **NODE_ENV**: set to `production` by the image. You do not change it.

### Database

- **DB_CLIENT**: `sqlite` (default), `postgres` or `mysql` (`mariadb` is accepted as another name for `mysql`).
- **DATABASE_URL**: the connection address, required when DB_CLIENT is not sqlite. Example: `postgres://user:password@db-host:5432/myboxstock`.
- **DB_POOL_MAX**: the most database connections to keep open for PostgreSQL or MariaDB. Default `10`.

### Behind proxies, https and addresses

- **TRUST_PROXY**: how many reverse proxies sit in front of the program, so it learns each visitor's real address. Default empty (none). Use `1` behind one proxy. Settings has a **Reverse proxy in front of the site** option that wins over this.
- **CLOUDFLARE_IP**: `1` when visitors arrive through Cloudflare, so the real visitor address from Cloudflare is used. Default off. Settings has **Site is behind Cloudflare**.
- **SECURE_COOKIES**: `1` to send sign-in cookies only over https. Default off. Turn on once https works.
- **HOST_ALLOW_ANY**: `1` is the emergency override that ignores the Host Console address list. Default off. Use it only to get back in; remove it afterwards.
- **MAIL_ALLOW_PRIVATE**: `1` lets resellers use mail servers on a private network. Default off.

### Logging

- **LOG_DIR**: where log files go. Default: a `logs` folder inside the data folder.
- **LOG_LEVEL**: `debug`, `info`, `warn` or `error`. Default `info`.
- **LOG_MAX_MB**: the size a log file reaches before it rotates. Default `10`.
- **LOG_FILES**: how many rotated files are kept per log. Default `5`.
- **LOG_RETENTION_DAYS**: how long the searchable database copy is kept. Default `90`.
- **LOG_CONSOLE**: lines are also printed to the container's output (what `docker logs` shows) unless this is set to `0`.

### Housekeeping and one-off

- **CLOSING_SWEEP_MS**: how often the server looks for accounts that have passed their closing date and erases them, in milliseconds. Default `3600000` (every hour). Customers who close an account get a 7-day locked period first.
- **BACKUP_PASSPHRASE**: used only with the `restore-bundle` command to give the backup's passphrase. Do not leave it set permanently.

Changing a variable means re-creating the container (`docker compose up -d`), not just restarting it, so the new value is picked up.

## HTTPS and reverse proxies

The program itself speaks plain http on its port. It does not handle certificates. For https you put something in front of it that does, and you tell the program about it:

1. A reverse proxy such as Caddy, nginx or Traefik, or a Cloudflare tunnel, receives the https request and forwards it to port 8080. For example, with Caddy a site block that sends `boxes.yourdomain.com` to `myboxstock:8080` is enough, because Caddy gets and renews the certificate on its own.
2. Set the **Site address** (or `PUBLIC_URL`) to the https address.
3. Set the proxy count to match, in Settings or `TRUST_PROXY`.
4. Once https works, turn on **Secure cookies**. It can only be turned on while you are viewing the console over https, which stops you locking yourself out.

Do not expose port 8080 directly to the internet if you are using a proxy; let the proxy be the only way in.

### How many proxies?

Count the programs that forward the request on its way to the container. Each trusted proxy lets the server step one address back along the chain.

- Visitors connect straight to the container: **None**.
- One reverse proxy (Caddy, nginx, Traefik): **1**.
- A proxy behind another proxy: **2**.
- Cloudflare sitting in front of your own proxy: **1** for your proxy, plus the Cloudflare option.

Why it matters: the firewall, rate limits, sign-in history and the Host Console address list all work from the visitor's address. Get the count wrong and every visitor looks like the proxy itself, so one person's bad passwords can lock out everybody, or an address someone can fake gets trusted. Signs of a wrong count are the same internal address for every visitor in [Logs](#/docs/logs), and "Your address right now" on [Firewall](#/docs/firewall) showing an internal number.

### Cloudflare

- With Cloudflare's normal proxy in front of the server, turn on **Site is behind Cloudflare**. The server then uses the visitor's real address Cloudflare supplies, and only believes it when the connection really arrives from a Cloudflare address, so it cannot be faked. Cloudflare's address ranges are built into the program.
- With your own proxy between Cloudflare and the container, also set the proxy count to 1.
- With a Cloudflare tunnel, the tunnel program sits next to the container, so count it as a proxy.
- After changing either option, open Firewall and check that "Your address right now" shows your real address. The Settings screen refuses a change that would lock you out of the Host Console, and tells you which address to add first.

## Ports and the firewall

- The program listens on one port (default 8080). Publish that port to your proxy, or to the network, and nothing else.
- Do not publish database ports (5432 for PostgreSQL, 3306 for MariaDB) to the internet.
- The Firewall screen lists the ports the container is listening on, discovered live. Rules and rate limits are enforced on the web port only; other ports are listed for visibility. See [Firewall](#/docs/firewall).

## The health check

The image checks itself every 30 seconds by asking the program for its own `/healthz` page, and Docker marks the container unhealthy if it does not answer within five seconds. The page answers with a short status that includes `ok`, the version and the build label. You can also point a monitoring service at `https://your-address/healthz`. `docker compose ps` shows the health status.

## Choosing a database

- **SQLite** (the default) is a single file inside the data folder. It needs no setup, makes backups simple, and suits testing and small numbers of customers.
- **PostgreSQL** or **MariaDB/MySQL** are for many simultaneous distributors. They run as separate servers. The project has been tested on SQLite and PostgreSQL 16. The MariaDB driver is written but, as the project's notes say, has not been run against a live server yet, so test it carefully before relying on it.

To move from SQLite to a bigger database:

1. Create an empty database on the new server. The target must be empty.
2. Back up first (see [Backups](#/docs/backups)).
3. Run inside the container: `node server.mjs migrate-db --to postgres://user:pass@db-host:5432/myboxstock`. It copies everything across and leaves the original untouched. For MariaDB use a `mysql://user:pass@host:3306/db` address.
4. Set `DB_CLIENT` and `DATABASE_URL` to the new database and re-create the container.
5. Check Overview shows the new engine, and that sign-in works.

The Settings screen shows the current engine and the same commands. On an external database, backups use `pg_dump` or `mysqldump` (the image includes these tools), and restoring means loading the dump yourself with `psql` or `mysql`. See [Recovery and emergencies](#/docs/recovery-and-emergencies).

## Resource use

myBoxStock is a modest program. The Overview screen shows the real numbers for your box: processor, memory (measured against the container's limit when there is one) and disk, plus a short history. The server notes a warning in the system log when memory or disk reaches 90 percent, at most once an hour, and the Alerts screen raises "Storage is almost full" at 90 percent disk.

It does a few things in the background without any action from you: checks for problems every five minutes, sends and retries email, runs scheduled backups, erases accounts past their closing date, clears out expired sessions, trims old sign-in history and removes old log rows, and once a day checks for a new release if you set a release address.

If the server feels slow, look at Overview first. Memory near the limit or a full disk is the usual cause; then consider more resources, or moving from SQLite to PostgreSQL.

A simple routine: look at Overview and Alerts weekly, test a restore on a spare machine now and then, and keep `restart: unless-stopped` and the data folder safe. If something goes wrong, [Troubleshooting and FAQ](#/docs/troubleshooting-faq) and [Recovery and emergencies](#/docs/recovery-and-emergencies) have the answers.
