# myBoxStock (hosted, multi-account)

A new take on vBoxStock: one hosted site where many distributors each get a private account to track inventory and sales,
plus a separate **Host Console** for whoever runs the server.

|  | Host Console `/host/` | Account app `/app/` |
|---|---|---|
| Who | the person hosting the server | signed-up distributors and their staff |
| Sign-in | `admin` + TOTP (recommended) | `username@BX-ABC123` (account ID suffix), TOTP optional |
| Can do | resources dashboard, accounts support (reset password / 2FA, suspend, delete), backups & restore, outbound email, firewall & rate limits, settings, **logs** | inventory, team & user types (Administrator / Standard / View), own security |
| Cannot | see any account's inventory, sales or customers | see any other account's data |

Separate cookies, session realms and tables; the privacy boundary is enforced in code and tested. Someone with direct access to the database
files can still read raw data — per-account encryption is a possible later step.

## Run
    docker compose up -d --build
    docker compose logs myboxstock        # first-run host password is printed once
Open `/host/`, sign in as `admin`, change the password, then turn on two-factor under **Security**.
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

## Recovery
Locked out of the host console: `node server.mjs reset-host-admin` (prints a temporary password, clears 2FA).

## Documentation
- `docs/ARCHITECTURE.md` — where everything lives, by function
- `docs/LOGGING.md` — areas, formats, how to read and extend logs
- `docs/CSS-STANDARD.md` — the design-token rules and how they are enforced

`npm test` runs 22 tests: sign-in/MFA/isolation/backups/firewall, logging behaviour, and the CSS + organization standards.

## Status — phase 1
Done: host console, auth + TOTP + recovery codes, account sign-up with unique IDs, user types, per-account isolation, backups & restore,
outbound email queue, firewall/rate limiting, DB portability, full logging, design-token CSS.
Next: full inventory model, sales & customers, mobile quick-sale site, custom user-type editor, per-account API ID/keys for a future app,
account-side log viewer, kernel-level (iptables) port enforcement.
