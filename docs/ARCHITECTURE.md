# Architecture — where things live

Code is grouped **by function**. To troubleshoot something, go to the folder named for what is going wrong.

| Symptom | Look in |
|---|---|
| Can't sign in / MFA / lockouts / sessions | `src/auth/` (`router/login.mjs`, `router/mfa.mjs`, `lockout.mjs`, `session.mjs`) |
| Blocked, rate-limited, banned | `src/security/firewall/` (`middleware.mjs` is the gate; `ratelimit.mjs`, `config.mjs`, `ports.mjs`) |
| A lockout or ban that should (not) have survived a restart | `src/security/blocks.mjs` (saves and reloads them; table `security_blocks`, migration 14); `lockout.mjs` and `firewall/ratelimit.mjs` call it |
| Host console page misbehaves | `src/routes/host/<area>.mjs` + `public/js/host/views/<area>.js` (same name on both sides) |
| Account app misbehaves | `src/routes/app/<area>.mjs` + `public/js/app/views/<area>.js` |
| Email not arriving | `src/services/mail/` (`queue.mjs` delivery + retries, `transport.mjs` direct/relay, `templates.mjs`) |
| Backup / restore (Host) | `src/services/backup/` (`tiers.mjs` settings, `runner.mjs` snapshots and offsite copies and the shared lock, `thin.mjs`, `cost.mjs`, `crypt.mjs` `.mbsenc`, `auto.mjs` + `bundle.mjs` full-site, `restore.mjs` + `restore-note.mjs`, `testrestore.mjs`, `destinations/*` for folder, SMB, S3, SFTP, WebDAV) and `src/routes/host/backups*.mjs`, `public/js/host/views/backups*.js` |
| Reseller backup file, restore point, diagnostics | `src/routes/app/backup.mjs`, `src/services/backup/restorepoint.mjs` + `diagnostics.mjs` (tables `restore_points`, `restore_point_records`, migration 15); the file is built and read in the browser: `public/js/app/backup-file.js`, `backup-restore.js`, `views/backup.js` |
| Phone camera scanning | `public/js/app/scan-core.js`, `scan-decode.js`, `scan-ui.js`, `public/css/scanner.css`, `public/js/vendor/zxing.min.js` (decoded on the phone; nothing uploaded or logged) |
| Account menu, long lists, Documentation | `public/js/shared/menu.js` (`UI.menu`, both top bars), `shared/list.js` (`UI.more` feeds with Load more, `UI.pager` page-size lists, `UI.chunked`), `shared/docs.js` + `src/services/docs/` + `content/docs/{host,reseller}/` |
| What shows in the Host audit trail | `src/services/audit/types.mjs` (one row per kind of entry) and `src/routes/host/audit.mjs` |
| Database problems, switching engines | `src/db/` (`drivers.mjs`, `schema.mjs`, `copy.mjs`) |
| Something looks wrong visually | `public/css/` — change a **token** in `tokens.css`, not a rule |
| What happened and when | the logs — see `docs/LOGGING.md` |

```
server.mjs                 wiring only
src/
  core/        config, ids, http helpers
  logging/     logger, areas, access log, rotating files
  db/          drivers (sqlite/postgres/mysql), schema, connection, settings, copy
  auth/        password, totp, secrets, lockout, session, router/{login,mfa,password,totp-routes}
  security/    firewall/{ip,config,ratelimit,ports,middleware}, blocks (saved lockouts and bans)
  services/    mail/*, backup/* (tiers, runner, thin, cost, crypt, bundle, restore, destinations/*), audit/types, docs, system/metrics
  routes/      host/*   (one file per console area)      app/*  (account API)
  cli/         reset-host-admin, reset-server-options, restore-bundle, decrypt-backup, migrate-db
public/
  css/         tokens, base, layout, components, commerce, auth, utilities, responsive, scanner, motion
  js/          shared/* (menu, list, docs, sheet…), host/{main,icons,views/*}, app/{main,views/*,backup-*,scan-*}, vendor/
test/          api, logging, standards (CSS + organization lint)
```

## Two realms, one privacy boundary
`/api/host/*` (host administrator) and `/api/app/*` (accounts) use different cookies, different tables and different session realms.
Host routes read only identity/security columns; they never query `inventory_items` or other business tables (the only mention is the
write-only `DELETE` when an account is erased). `test/standards.test.mjs` fails if a host route starts reading tenant business tables, and
`test/api.test.mjs` proves no tenant value appears in any host response. The `tenant` log area is hidden from the host log viewer.

## Lockouts, bans and what stays in memory
Sign-in lockouts (6 wrong tries, 15 minutes) and IP bans (default 15 minutes) are kept in memory for speed and written through to `security_blocks` (kinds `lockout`, `failures`, `ban`, `violations`; the two counter kinds expire one hour after the last event). `loadBlocks` reloads the unexpired rows at start, before the server listens, so a restart (including the one after an update) does not clear them. The per-request rate-limit counters (requests per window, sign-in attempts per window) stay in memory on purpose.

## Backups, in one paragraph
All backups go through one lock (`withBackupLock`). Frequent snapshots use the SQLite online backup into `${DATA_DIR}/backup` (older `${DATA_DIR}/backups` is still read). Everything that leaves the default folder is gzipped and encrypted with the backup passphrase (`.mbsenc`; `.mbsbak` bundles are already encrypted) and uploaded through a destination client, then verified before local copies are trimmed. Restore is staged and applied at the next start (`restore-pending.db`), a safety copy is taken first, and `restore-note.json` makes the next start post the announcement banner. Backup events are written with `audit()` (area `host`) so they appear in the Audit trail; resellers' own backup events are area `tenant` (counts only, hidden from the Host viewer).

## Conventions
- Every source file starts with a one-line header comment: `AREA / file — what it is for` (tested).
- Migrations are append-only (`src/db/schema.mjs`): ids 1–13 as before, 14 `security_blocks`, 15 reseller backup (`accounts.last_backup_at`, `restore_points`, `restore_point_records`). New tables go into `COPY_ORDER`.
- Documentation is part of the product: each console's pages are in `content/docs/<realm>/`, and `test/docs.test.mjs` fails if a menu item has no page or a covered term is not searchable.
- One concern per file; routes only translate HTTP, services do the work, `db/` is the only code that talks SQL dialects.
- Every function that changes state logs through `areaLogger(area)`.
