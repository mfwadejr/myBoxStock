// DATABASE / schema — portable DDL for SQLite, PostgreSQL and MariaDB/MySQL.
// Rules: string primary keys, VARCHAR(n) for anything indexed, TEXT otherwise, BIGINT epoch-ms timestamps,
// INTEGER 0/1 booleans, no vendor-specific upsert/returning/autoincrement, no reserved-word column names.
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('database');
const id = 'VARCHAR(40)';
const s = (n = 255) => `VARCHAR(${n})`;

export const TABLES = [
  // ---- platform realm (host administrator) ----
  ['settings', `CREATE TABLE settings (k ${s(100)} PRIMARY KEY, v TEXT, updated_at BIGINT NOT NULL)`],
  ['host_admins', `CREATE TABLE host_admins (
    id ${id} PRIMARY KEY, username ${s(100)} NOT NULL UNIQUE, email ${s()},
    pw_hash ${s()} NOT NULL, must_change INTEGER NOT NULL DEFAULT 0,
    totp_secret TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0, recovery_hashes TEXT,
    created_at BIGINT NOT NULL, last_login BIGINT)`],
  ['event_log', `CREATE TABLE event_log (
    id ${id} PRIMARY KEY, ts BIGINT NOT NULL, level ${s(10)} NOT NULL, area ${s(20)} NOT NULL, event ${s(80)} NOT NULL,
    actor ${s()}, account_id ${s(40)}, ip ${s(64)}, message TEXT, raw TEXT)`],
  ['mail_queue', `CREATE TABLE mail_queue (
    id ${id} PRIMARY KEY, to_addr ${s()} NOT NULL, subject ${s()} NOT NULL, body_text TEXT, body_html TEXT,
    status ${s(20)} NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at BIGINT NOT NULL, sent_at BIGINT)`],
  ['firewall_rules', `CREATE TABLE firewall_rules (
    id ${id} PRIMARY KEY, kind ${s(20)} NOT NULL, cidr ${s(64)} NOT NULL, port INTEGER, note ${s()},
    enabled INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)`],

  // ---- tenant realm: every row carries account_id; the host console never queries these ----
  ['accounts', `CREATE TABLE accounts (
    id ${id} PRIMARY KEY, account_code ${s(20)} NOT NULL UNIQUE, business_name ${s()} NOT NULL,
    owner_email ${s()} NOT NULL, status ${s(20)} NOT NULL, plan ${s(40)}, created_at BIGINT NOT NULL, last_activity BIGINT)`],
  ['account_users', `CREATE TABLE account_users (
    id ${id} PRIMARY KEY, account_id ${id} NOT NULL, login ${s(160)} NOT NULL UNIQUE,
    username ${s(100)} NOT NULL, email ${s()}, role ${s(40)} NOT NULL,
    pw_hash ${s()} NOT NULL, must_change INTEGER NOT NULL DEFAULT 0, disabled INTEGER NOT NULL DEFAULT 0,
    totp_secret TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0, recovery_hashes TEXT,
    created_at BIGINT NOT NULL, last_login BIGINT, FOREIGN KEY (account_id) REFERENCES accounts(id))`],
  ['account_roles', `CREATE TABLE account_roles (
    id ${id} PRIMARY KEY, account_id ${id} NOT NULL, name ${s(60)} NOT NULL, perms TEXT NOT NULL,
    builtin INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (account_id) REFERENCES accounts(id))`],
  ['inventory_items', `CREATE TABLE inventory_items (
    id ${id} PRIMARY KEY, account_id ${id} NOT NULL, uid ${s(80)}, serial ${s(80)}, mac ${s(40)},
    model ${s(80)}, cond ${s(20)}, cost BIGINT, status ${s(20)} NOT NULL, notes TEXT, created_at BIGINT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id))`],

  // ---- sessions & resets (both realms) ----
  ['password_resets', `CREATE TABLE password_resets (
    token_hash ${s(64)} PRIMARY KEY, realm ${s(10)} NOT NULL, subject_id ${id} NOT NULL, expires_at BIGINT NOT NULL, used INTEGER NOT NULL DEFAULT 0)`],
  ['sessions', `CREATE TABLE sessions (
    token_hash ${s(64)} PRIMARY KEY, realm ${s(10)} NOT NULL, subject_id ${id} NOT NULL,
    account_id ${s(40)}, mfa_ok INTEGER NOT NULL DEFAULT 0, mfa_pending INTEGER NOT NULL DEFAULT 0,
    csrf ${s(64)} NOT NULL, ip ${s(64)}, ua ${s(200)}, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL)`],
];

export const INDEXES = [
  'CREATE INDEX idx_event_ts ON event_log (ts)',
  'CREATE INDEX idx_event_area ON event_log (area, ts)',
  'CREATE INDEX idx_event_account ON event_log (account_id, ts)',
  'CREATE INDEX idx_users_account ON account_users (account_id)',
  'CREATE INDEX idx_inv_account ON inventory_items (account_id, status)',
  'CREATE INDEX idx_sessions_exp ON sessions (expires_at)',
  'CREATE INDEX idx_mail_status ON mail_queue (status)',
];

// Order matters when copying between databases (parents before children).
export const COPY_ORDER = ['settings', 'host_admins', 'accounts', 'billing_events', 'account_users', 'sign_in_history', 'account_keys', 'account_recovery', 'account_roles', 'inventory_items', 'records',
  'firewall_rules', 'mail_queue', 'event_log', 'password_resets', 'sessions'];

// Versioned migrations. Each runs once, in order, and is recorded in schema_migrations.
// Fresh installs run all of them; existing installs run only the ones they are missing. Never edit an applied migration — add a new one.
const MIGRATIONS = [
  { id: 1, name: 'initial schema', up: async (db) => {
    for (const [name, ddl] of TABLES) { await db.exec(ddl); L.info('table.created', `Created table ${name}`); }
    for (const ddl of INDEXES) await db.exec(ddl);
  } },
  { id: 2, name: 'plans, free trials and billing history', up: async (db) => {
    // plan: trial | free | paid. Existing accounts were created as 'free', so they simply stay free (no surprise lock-outs).
    await db.exec('ALTER TABLE accounts ADD COLUMN trial_ends_at BIGINT');
    await db.exec('ALTER TABLE accounts ADD COLUMN plan_until BIGINT');
    await db.exec(`ALTER TABLE accounts ADD COLUMN plan_note ${s()}`);
    await db.exec('ALTER TABLE accounts ADD COLUMN plan_changed_at BIGINT');
    await db.exec('ALTER TABLE accounts ADD COLUMN expiry_noted INTEGER NOT NULL DEFAULT 0');
    await db.exec(`CREATE TABLE billing_events (
      id ${id} PRIMARY KEY, account_id ${id} NOT NULL, ts BIGINT NOT NULL, kind ${s(30)} NOT NULL,
      from_plan ${s(40)}, to_plan ${s(40)}, actor ${s(100)}, note ${s()}, detail TEXT)`);
    await db.exec('CREATE INDEX idx_billing_account ON billing_events (account_id, ts)');
  } },
  { id: 3, name: 'sign-in history and session activity', up: async (db) => {
    await db.exec(`CREATE TABLE sign_in_history (
      id ${id} PRIMARY KEY, account_id ${id} NOT NULL, user_id ${id} NOT NULL, login ${s(160)}, ts BIGINT NOT NULL,
      result ${s(20)} NOT NULL, reason ${s(40)}, ip ${s(64)}, device ${s(100)}, new_ip INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 1)`);
    await db.exec('CREATE INDEX idx_signin_account ON sign_in_history (account_id, ts)');
    await db.exec('CREATE INDEX idx_signin_user ON sign_in_history (user_id, ts)');
    await db.exec('ALTER TABLE sessions ADD COLUMN last_seen BIGINT');
  } },
  { id: 4, name: 'encrypted account data (keys and records)', up: async (db) => {
    // The server stores only ciphertext and wrapped keys here. It never holds a key that can read `records.blob`.
    await db.exec(`CREATE TABLE account_keys (
      user_id ${id} PRIMARY KEY, account_id ${id} NOT NULL, salt ${s(64)} NOT NULL, iters INTEGER NOT NULL, wrapped_adk TEXT NOT NULL, updated_at BIGINT NOT NULL)`);
    await db.exec(`CREATE TABLE account_recovery (
      account_id ${id} PRIMARY KEY, wrapped_adk TEXT NOT NULL, created_at BIGINT NOT NULL, confirmed_at BIGINT, rotated_at BIGINT)`);
    await db.exec(`CREATE TABLE records (
      id ${s(64)} PRIMARY KEY, account_id ${id} NOT NULL, type ${s(20)} NOT NULL, blob TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`);
    await db.exec('CREATE INDEX idx_records_account ON records (account_id, type)');
  } },
];

export async function migrate(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)`);
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (await db.get('SELECT id FROM schema_migrations WHERE id = ?', [m.id])) continue;
    await m.up(db);
    await db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [m.id, Date.now()]);
    L.info('migrate.done', `Database migration ${m.id} applied: ${m.name}`, { data: { id: m.id, name: m.name } });
    applied++;
  }
  return applied > 0;
}
