# Changelog

Every published version has an entry here, newest first. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).
These notes are used verbatim as the GitHub Release notes (see `docs/RELEASING.md`).

## [0.2.0] - 2026-10-03

### Added
- Free trials: new sign-ups start a trial. The length is a Host Console setting (Settings → Free trial length, default 14 days, applies to new sign-ups).
- Plans per account: Trial, Free (comped, never expires) and Paid (optional paid-through date). Host administrators change a plan from Accounts → account → Change plan, with a private note. Every change is kept in a plan history and logged (area `accounts`).
- Plans are visible at a glance: a Plan column and filter on Accounts, and a Plans summary (trials, ending within 7 days, free, paid, ended) on the Overview.
- Ended trials and paid periods become read-only: people can still sign in and view everything, but changes are refused. Nothing is deleted. The owner gets an email, and users see a trial/read-only chip in the header.
- Delete people: account administrators can delete other users in their account; host administrators can delete users from an account and delete other host administrators. Typed confirmation is required; you cannot delete yourself or the last Administrator / host administrator.
- Versioned database migrations (existing installs upgrade in place; existing accounts become Free so nobody is locked out).

### Changed
- Welcome email mentions the trial; sign-up page shows the trial length.

## [0.1.0] - 2026-10-03

First published version (phase 1).

### Added
- Host console: system dashboard, account management (support actions only), backup and restore, outbound email queue and templates, application firewall with rate limiting, filtered log viewer, host-admin management.
- Account app: sign-up with unique account ID (`username@bx-code`), user types (Administrator, Standard, View), basic inventory, optional TOTP and recovery codes.
- Strict tenant privacy: host routes never read account business data; the `tenant` log area is hidden from the host.
- Portable database layer (SQLite by default, PostgreSQL and MySQL/MariaDB drivers) with `migrate-db` command.
- Logging in raw (JSONL) and human-readable form, per area, with rotation and retention.
- Single design-token stylesheet (`tokens.css`) enforced by tests; strict CSP with no inline styles.
- Deployed-version badge on every page and version reporting in `/healthz`.
- Docker image published to `ghcr.io/mfwadejr/myboxstock`.

### Known limitations
- MariaDB/MySQL driver is untested; live direct-to-MX email delivery is untested.
- Firewall enforces the web port only (other ports are visibility-only).
