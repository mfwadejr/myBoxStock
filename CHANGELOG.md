# Changelog

Every published version has an entry here, newest first. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).
These notes are used verbatim as the GitHub Release notes (see `docs/RELEASING.md`).

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
- Docker image published to `ghcr.io/mfwadejr/myboxstock`, plus a ready-made ZimaOS/CasaOS app file (`zimaos/docker-compose.yml`).

### Known limitations
- MariaDB/MySQL driver is untested; live direct-to-MX email delivery is untested.
- Firewall enforces the web port only (other ports are visibility-only).
