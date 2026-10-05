# Logging

Everything the server does is logged **three ways**, in the **area** it belongs to:

| Copy | Where | For |
|---|---|---|
| Human readable | `<LOG_DIR>/<area>/<area>.log` | an admin reading along |
| Raw JSON (one object per line) | `<LOG_DIR>/<area>/<area>.jsonl` | scripts, grep/jq, shipping to a log service |
| Database `event_log` table | same database as the app | the web **Logs** page (already built for the host console) and future per-account viewers |

`LOG_DIR` defaults to `<DATA_DIR>/logs`. Files rotate by size (`LOG_MAX_MB`, keep `LOG_FILES`); the database copy is pruned after
`LOG_RETENTION_DAYS` (default 90). Level threshold: `LOG_LEVEL` (`debug|info|warn|error`). `LOG_CONSOLE=0` silences stdout.
Web requests (`http`) go to files only because of volume.

## Areas
| Area | What is in it |
|---|---|
| `http` | every request: method, full path, status, milliseconds, IP, signed-in user |
| `auth` | login ok/failed (with reason), lockouts, MFA, password changes, resets, sessions, CSRF rejections, unauthenticated access |
| `security` | firewall rules, rate-limit hits, temporary bans (created by the server, lifted by an administrator), blocked requests, limit changes, `blocks.loaded` (lockouts and bans restored at start), `blocks.write_failed` |
| `host` | host console actions: settings (`settings.runtime` lists only what changed, before and after; `settings.runtime_saved` for a save with no change), admins, mail test, bootstrap/reset, and the backup audit events below |
| `accounts` | host **support** actions on accounts: reset link, temp password, MFA reset, suspend, delete |
| `tenant` | account activity as ids and event names only (never business data). Includes a reseller's own backup events (`backup.file_created`, `backup.restore_started`, `backup.restore_done`, `backup.restore_refused`, `backup.restore_undone`, `backup.restore_rolled_back`, counts only). **Hidden from the host viewer.** |
| `backup` | snapshots, offsite copies and full-site runs, uploads, thinning and pruning, destinations saved / tested / removed, test restore, restore staged and applied, the post-restore notice |
| `mail` | queued, sent, retry, failed, settings |
| `system` | start/stop, key creation, disk/memory warnings, log pruning |
| `database` | connect, migrations, copies between databases |
| `error` | unhandled errors with stack |

## Logs and the Audit trail
The Host **Audit trail** is a view over the same `event_log`; it has no table of its own. Which events it shows is decided in one place, `src/services/audit/types.mjs`: every `host` / `accounts` event that has a named actor, plus a short list of security and auth events (firewall rule added / changed / removed, rate-limit settings and Host Console access limit changed, ban created / lifted, Host Console lockouts, sign-ins, failed sign-ins and sign-outs, two-factor turned on / off and recovery code used). Each kind has a friendly label (the raw event is the tooltip) and a **Type** filter group. Entries with no actor (a ban the server created) show as **System**. Reseller sign-ins are never in it (Host-realm events only). To add a kind of entry, add one row there.

Backup actions are written with `audit()` from `src/services/backup/audit.mjs` into area `host`: `backup.run`, `backup.restore`, `backup.download`, `backup.delete`, `backup.test_restore`, `backup.destination_saved`, `backup.destination_deleted`, `backup.destination_test`, `backup.settings_saved`. They never contain a secret.

## Line formats
Human: `2026-10-03 12:30:01.120  WARN   login.failed   Failed sign-in for "ghost@bx-aaaaaa" — no such user  | actor=… | account=… | ip=…`

Raw: `{"ts":"2026-10-03T12:30:01.120Z","t":1791030601120,"level":"warn","area":"auth","event":"login.failed","message":"…","actor":"…","accountId":null,"ip":"…","data":{"realm":"app","reason":"no such user"}}`

## Writing new log calls
```js
import { areaLogger } from '../logging/logger.mjs';
const L = areaLogger('backup');
L.info('create.done', `Backup ${name} created (${kb} KB)`, { actor, accountId, ip, data: { name, size } });
```
Rules: event names are `thing.what_happened`; the message is a full sentence a human can act on; put structured detail in `data`.
Keys containing password/secret/token/csrf/hash/recovery/otp/cookie are redacted automatically, but never pass secrets or business data
(inventory, customers, sales) on purpose. `test/logging.test.mjs` checks that passwords, tokens and device identifiers never reach any log.

## Reading logs
```
tail -f data/logs/auth/auth.log
jq 'select(.event=="login.failed") | {ts, ip, data}' data/logs/auth/auth.jsonl
GET /api/host/logs?area=security&level=warn&q=ban      (host console → Logs)
```
