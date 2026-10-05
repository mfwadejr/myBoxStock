# myBoxStock (hosted, multi-account)

A new take on vBoxStock: one hosted site where many distributors each get a private account to track inventory and sales,
plus a separate **Host Console** for whoever runs the server.

|  | Host Console `/host/` | Account app `/app/` |
|---|---|---|
| Who | the person hosting the server | signed-up distributors and their staff |
| Sign-in | `admin` + TOTP (recommended) | `username@BX-ABC123` (account ID suffix), TOTP optional |
| Can do | resources dashboard, accounts support (reset password / 2FA, suspend, delete), backups & restore (snapshots, offsite copies, full-site backups, destinations), outbound email, firewall & rate limits, settings, **logs** and an **audit trail** | inventory, sales, customers, team & user types (Administrator / Standard / View), own security, own backup file and restore, phone camera scanning |
| Cannot | see any account's inventory, sales or customers | see any other account's data |

Separate cookies, session realms and tables; the privacy boundary is enforced in code and tested. Someone with direct access to the database
files can still read raw data — per-account encryption is a possible later step.

## Run
    docker compose up -d --build
    docker compose logs myboxstock        # first-run host password is printed once
Open `/host/`, sign in as `admin`, change the password, then turn on two-factor under **Security**. Both apps have one **account menu** (your name, top right) with Sign out; in the Host Console it lists linked reseller accounts, and in the reseller app it has a Site admin entry for accounts linked to a Host administrator.
Without Docker: `npm install && npm start` (Node 22.13+).

## Databases and scale
SQLite is embedded for testing. For many concurrent distributors use PostgreSQL or MariaDB/MySQL:

    node server.mjs migrate-db --to postgres://user:pass@db-host:5432/myboxstock   # copies everything; source untouched
    DB_CLIENT=postgres  DATABASE_URL=postgres://...                                # then restart
MariaDB: `mysql://user:pass@host:3306/db` with `DB_CLIENT=mysql`. The target must be empty. Tested on SQLite and PostgreSQL 16;
the MariaDB driver is written but has not been run against a live server yet.

## Environment
`PORT` · `DATA_DIR` · `DB_CLIENT` · `DATABASE_URL` · `TRUST_PROXY` · `SECURE_COOKIES` · `PUBLIC_URL` · `APP_SECRET` ·
`LOG_DIR` · `LOG_LEVEL` · `LOG_MAX_MB` · `LOG_FILES` · `LOG_RETENTION_DAYS` · `LOG_CONSOLE`

`TRUST_PROXY` may be a plain count or another value such as `loopback`; Settings then shows "Custom (set by the container: …)" and saving the card leaves it alone. It stays the first-start default and the fallback for `reset-server-options`. Backup settings are not environment variables: they live on the Backups page.

## Recovery
Locked out of the host console: `node server.mjs reset-host-admin` (prints a temporary password, clears 2FA). Sign-in lockouts (15 minutes after 6 wrong tries) and IP bans are saved in the database and **survive a restart**; wait them out or use **Lift** on the Firewall page. If a saved server option (such as the proxy count) is the cause, `node server.mjs reset-server-options` clears them, or set `HOST_ALLOW_ANY=1` for one restart to ignore the Host Console address list.

## Documentation
- `docs/ENCRYPTION-DESIGN.md` — how customer-data encryption works (and its limits)
- `docs/ARCHITECTURE.md` — where everything lives, by function
- `docs/LOGGING.md` — areas, formats, how to read and extend logs
- `docs/CSS-STANDARD.md` — the design-token rules and how they are enforced
- `CHANGELOG.md` and `docs/RELEASING.md` — release notes for every version and the release process

`npm test` runs the whole suite: sign-in/MFA/isolation/backups/firewall, logging behaviour, the documentation tests (every menu item has a page, every covered term is searchable) and the CSS + organization standards. The built-in Documentation (`content/docs/host` and `content/docs/reseller`) must be updated with every release.

## Status — phase 1
Done: host console, auth + TOTP + recovery codes, account sign-up with unique IDs, user types, per-account isolation, backups & restore,
outbound email queue, firewall/rate limiting, DB portability, full logging, design-token CSS.
Next: full inventory model, sales & customers, mobile quick-sale site, custom user-type editor, per-account API ID/keys for a future app,
account-side log viewer, kernel-level (iptables) port enforcement.

## Backups

Host Console → **Backups** has a status strip (last backup, next run, offsite copy, space used and a cost line) and five tabs:

- **Frequent snapshots** — every 15 minutes by default (5 minutes to a day), taken with the database's online backup so sales keep being saved, kept on the server and thinned: every copy for 24 hours, then one an hour for 48 hours, one a day for 14 days, one a week for 8 weeks (about 166 files; all four numbers are settings). Plain `.db` files in `/data/backup` (`${DATA_DIR}/backup`), mode 0600, **not** passphrase-protected: passwords are hashed, TOTP/SMTP/destination secrets are sealed with `secret.key` (not in a snapshot) and customer data is encrypted in the customers' browsers, but account names, emails and plan details are readable. Backups made by older versions in `/data/backups` are still listed, downloaded, restored and deleted where they sit. The older nightly plain copy is on this tab.
- **Offsite copies** — hourly by default (15 minutes to a day), off until a destination is chosen. A fresh snapshot is gzipped, encrypted with the backup passphrase and uploaded as `myboxstock-offsite-<stamp>.db.mbsenc`, verified, and thinned at the destination too. They have Download and Delete only; to restore one, decrypt it by hand: `BACKUP_PASSPHRASE=… node server.mjs decrypt-backup <file> <out>`.
- **Full-site backups** — the nightly (or weekly) passphrase-sealed `.mbsbak` bundle with the database and `secret.key`, verified after writing, kept 14 daily and 8 weekly by default (up to 90 and 52), and now also sent to the chosen destinations.
- **Safety copies** — taken before every restore, kept 30 days with the newest 5 always kept.
- **Destinations** — a folder (any absolute path; a NAS mounted through Docker NFS/SMB works, see the commented examples in `docker-compose.yml`), SMB (built in, uses `smbclient`, installed in the image as `samba-client`), S3-compatible (Backblaze B2, Wasabi, Cloudflare R2, Amazon S3, MinIO), SFTP (`ssh2`; the host-key fingerprint is recorded at the first successful **Test connection** and required afterwards) and WebDAV. Credentials are stored sealed. Every destination except the default folder needs the backup passphrase and encrypts everything it receives (gzip + chunked AES-256-GCM, key from scrypt).

Rules: one shared lock so two backups never overlap; a failed backup or upload is logged, audited and raises the "backup failing" alert at once; **Test restore** opens a backup in a scratch copy and checks it without touching live data; **Restore** names the file, the UTC time and how long ago, takes a safety copy, restarts the site and then posts an important announcement ("The site was restored from a backup taken … UTC …") that the Host clears in Settings.

Resellers also keep their own backup file (**Backup and restore**, Administrators only): `myboxstock-backup-<reseller-id>-<yyyymmdd>.mbsbackup`, made and read in the browser (see `docs/ENCRYPTION-DESIGN.md`). It is how one account recovers work newer than a Host restore; the Host cannot restore a single account from a site backup.

## Moving to a new server (full-site backup)

1. In the Host Console → Backups → **Full-site backups**, set a passphrase and run a backup (or **Make one with a new passphrase**); download the `.mbsbak` file or fetch it from your destination.
2. On the new, empty server: `BACKUP_PASSPHRASE='your passphrase' node server.mjs restore-bundle --file myboxstock-fullsite-….mbsbak`
   (in Docker: mount the file and run the same command in the container before first start).
3. Start the server. Everyone signs in as before.

Offsite copies and snapshots do not contain `secret.key`; on a new server, two-factor secrets, the saved mail password and saved destination passwords cannot be read without it.
