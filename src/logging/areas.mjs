// LOGGING / areas — the single list of log areas. Every log line belongs to exactly one.
// Each area gets its own files:  <LOG_DIR>/<area>/<area>.log (human) and <area>.jsonl (raw JSON),
// and (except `http`) rows in the event_log table for a future web viewer.
export const AREAS = {
  http:     'Web requests (every request: method, path, status, timing)',
  auth:     'Sign-in, sign-out, sessions, lockouts, MFA, password changes',
  security: 'Firewall rules, rate limiting, bans, blocked requests',
  host:     'Host console actions (settings, admins, firewall, mail, backups)',
  accounts: 'Host support actions on accounts (resets, suspend, delete)',
  tenant:   'Account activity — metadata only (ids and event names, never business data)',
  backup:   'Backups, restores and the backup scheduler',
  mail:     'Outbound email queue and delivery',
  system:   'Server start/stop, configuration, resource warnings',
  database: 'Connections, migrations and database copies',
  error:    'Unhandled errors with stack traces',
};
export const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
// Areas whose rows must never be shown in the host console (they describe an account's own activity).
export const PRIVATE_AREAS = ['tenant'];
// Areas kept out of the database copy because of volume; still written to files.
export const FILE_ONLY_AREAS = ['http'];
