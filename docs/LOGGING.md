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
| `security` | firewall rules, rate-limit hits, temporary bans, blocked requests, limit changes |
| `host` | host console actions: settings, admins, mail test, bootstrap/reset |
| `accounts` | host **support** actions on accounts: reset link, temp password, MFA reset, suspend, delete |
| `tenant` | account activity as ids and event names only (never business data). **Hidden from the host viewer.** |
| `backup` | create / delete / download / restore / schedule / prune |
| `mail` | queued, sent, retry, failed, settings |
| `system` | start/stop, key creation, disk/memory warnings, log pruning |
| `database` | connect, migrations, copies between databases |
| `error` | unhandled errors with stack |

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
