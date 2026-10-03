# Architecture — where things live

Code is grouped **by function**. To troubleshoot something, go to the folder named for what is going wrong.

| Symptom | Look in |
|---|---|
| Can't sign in / MFA / lockouts / sessions | `src/auth/` (`router/login.mjs`, `router/mfa.mjs`, `lockout.mjs`, `session.mjs`) |
| Blocked, rate-limited, banned | `src/security/firewall/` (`middleware.mjs` is the gate; `ratelimit.mjs`, `config.mjs`, `ports.mjs`) |
| Host console page misbehaves | `src/routes/host/<area>.mjs` + `public/js/host/views/<area>.js` (same name on both sides) |
| Account app misbehaves | `src/routes/app/<area>.mjs` + `public/js/app/views/<area>.js` |
| Email not arriving | `src/services/mail/` (`queue.mjs` delivery + retries, `transport.mjs` direct/relay, `templates.mjs`) |
| Backup / restore | `src/services/backup/` |
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
  security/    firewall/{ip,config,ratelimit,ports,middleware}
  services/    mail/*, backup/*, system/metrics
  routes/      host/*   (one file per console area)      app/*  (account API)
  cli/         reset-host-admin, migrate-db
public/
  css/         tokens, base, layout, components, auth, utilities, motion
  js/          shared/*, host/{main,icons,views/*}, app/{main,views/*}, vendor/
test/          api, logging, standards (CSS + organization lint)
```

## Two realms, one privacy boundary
`/api/host/*` (host administrator) and `/api/app/*` (accounts) use different cookies, different tables and different session realms.
Host routes read only identity/security columns; they never query `inventory_items` or other business tables (the only mention is the
write-only `DELETE` when an account is erased). `test/standards.test.mjs` fails if a host route starts reading tenant business tables, and
`test/api.test.mjs` proves no tenant value appears in any host response. The `tenant` log area is hidden from the host log viewer.

## Conventions
- Every source file starts with a one-line header comment: `AREA / file — what it is for` (tested).
- One concern per file; routes only translate HTTP, services do the work, `db/` is the only code that talks SQL dialects.
- Every function that changes state logs through `areaLogger(area)`.
