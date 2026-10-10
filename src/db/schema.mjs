// DATABASE / schema — portable DDL for SQLite, PostgreSQL and MariaDB/MySQL.
// Rules: string primary keys, VARCHAR(n) for anything indexed, TEXT otherwise, BIGINT epoch-ms timestamps,
// INTEGER 0/1 booleans, no vendor-specific upsert/returning/autoincrement, no reserved-word column names.
import { newId } from '../core/ids.mjs';
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
  'firewall_rules', 'mail_queue', 'event_log', 'password_resets', 'sessions', 'admin_links', 'email_confirmations', 'billing_receipts', 'receipt_mail_usage', 'alerts', 'security_blocks', 'restore_points', 'restore_point_records',
  'support_tickets', 'support_messages', 'support_attachments', 'support_notes', 'support_views', 'demo_logins'];

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
  { id: 5, name: 'host administrator contact details', up: async (db) => {
    await db.exec(`ALTER TABLE host_admins ADD COLUMN display_name ${s(100)}`);
    await db.exec(`ALTER TABLE host_admins ADD COLUMN cell ${s(40)}`);
  } },
  { id: 6, name: 'link a host administrator to their own reseller account', up: async (db) => {
    // Lets one person switch between the Host Console and their own account. A link is created from inside the account, after proving the Host password.
    await db.exec(`CREATE TABLE admin_links (id ${id} PRIMARY KEY, admin_id ${id} NOT NULL, user_id ${id} NOT NULL UNIQUE, created_at BIGINT NOT NULL)`);
    await db.exec('CREATE INDEX idx_admin_links_admin ON admin_links (admin_id)');
  } },
  { id: 7, name: 'per-account permission to link a Host administrator', up: async (db) => {
    // Off for every account until the Owner administrator switches it on for that account.
    await db.exec('ALTER TABLE accounts ADD COLUMN host_link_allowed INTEGER NOT NULL DEFAULT 0');
  } },
  { id: 8, name: 'Host Console access rules', up: async (db) => {
    // Host Console access now has its own rule kind. Anything that was an enabled "allow" rule keeps working by getting a host twin.
    const rows = await db.all("SELECT cidr, port, note FROM firewall_rules WHERE kind = 'allow' AND enabled = 1");
    for (const r of rows) await db.run('INSERT INTO firewall_rules (id, kind, cidr, port, note, enabled, created_at) VALUES (?,?,?,?,?,1,?)', [newId(), 'host', r.cidr, r.port, r.note, Date.now()]);
  } },
  { id: 9, name: 'email confirmation', up: async (db) => {
    // Soft verification: people who already had an account are never held back, only people who join from now on.
    await db.exec('ALTER TABLE account_users ADD COLUMN email_verified_at BIGINT');
    await db.exec(`CREATE TABLE email_confirmations (token_hash ${s(64)} PRIMARY KEY, user_id ${id} NOT NULL, email ${s()} NOT NULL, expires_at BIGINT NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)`);
    await db.exec('CREATE INDEX idx_email_conf_user ON email_confirmations (user_id, created_at)');
    await db.exec('ALTER TABLE account_users ADD COLUMN email_grandfathered INTEGER NOT NULL DEFAULT 0');
    await db.exec('UPDATE account_users SET email_grandfathered = 1');
  } },
  { id: 10, name: 'closing an account (7-day period before erase)', up: async (db) => {
    await db.exec('ALTER TABLE accounts ADD COLUMN closing_at BIGINT');
    await db.exec(`ALTER TABLE accounts ADD COLUMN closing_by ${s(160)}`);
  } },
  { id: 11, name: 'receipt records per account', up: async (db) => {
    // A Host-side record of money received for an account (entered by hand today; payments can fill it in later). Amounts are whole cents.
    await db.exec(`CREATE TABLE billing_receipts (id ${id} PRIMARY KEY, account_id ${id} NOT NULL, ts BIGINT NOT NULL, amount_cents BIGINT NOT NULL, currency ${s(8)} NOT NULL, method ${s(40)}, reference ${s(120)}, note ${s(255)}, period_end BIGINT, actor ${s(100)})`);
    await db.exec('CREATE INDEX idx_receipts_account ON billing_receipts (account_id, ts)');
  } },
  { id: 12, name: 'daily count of receipts emailed per account', up: async (db) => {
    // Only a count per day: no address, no content (receipts are relayed, never stored).
    await db.exec(`CREATE TABLE receipt_mail_usage (account_id ${id} NOT NULL, day ${s(10)} NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (account_id, day))`);
  } },
  { id: 13, name: 'Host alerts', up: async (db) => {
    // Server-side problems only (email, backups, sign-in floods, disk, trials). Never anything from inside an account.
    await db.exec(`CREATE TABLE alerts (id ${id} PRIMARY KEY, kind ${s(40)} NOT NULL, dedupe_key ${s(120)} NOT NULL, level ${s(10)} NOT NULL, title ${s()} NOT NULL, detail ${s(600)},
      first_at BIGINT NOT NULL, last_at BIGINT NOT NULL, occurrences INTEGER NOT NULL DEFAULT 1, status ${s(12)} NOT NULL, resolved_at BIGINT, emailed_at BIGINT)`);
    await db.exec('CREATE INDEX idx_alerts_status ON alerts (status, last_at)');
  } },
  { id: 14, name: 'lockouts and bans survive a restart', up: async (db) => {
    // Active sign-in lockouts, IP bans and the failure counters that lead to them. Only a sign-in name or address and a count: nothing from inside an account.
    // kind: lockout | failures | ban | violations. subject: sign-in name, mfa:<id> or IP address. expires_at: when the row stops mattering (epoch ms).
    await db.exec(`CREATE TABLE security_blocks (id ${id} PRIMARY KEY, kind ${s(20)} NOT NULL, subject ${s(200)} NOT NULL, hits INTEGER NOT NULL DEFAULT 0, reason ${s(200)}, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL)`);
    await db.exec('CREATE UNIQUE INDEX idx_blocks_subject ON security_blocks (kind, subject)');
    await db.exec('CREATE INDEX idx_blocks_until ON security_blocks (expires_at)');
  } },
  { id: 15, name: 'reseller backup: last backup time and a 7-day undo copy of a restore', up: async (db) => {
    // last_backup_at is just a time. A restore point is a copy of the account's own ciphertext taken before a restore, so it can be undone for 7 days. The host cannot read it.
    await db.exec('ALTER TABLE accounts ADD COLUMN last_backup_at BIGINT');
    await db.exec(`CREATE TABLE restore_points (account_id ${id} PRIMARY KEY, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, created_by ${s(160)}, record_count INTEGER NOT NULL DEFAULT 0, mode ${s(12)})`);
    await db.exec(`CREATE TABLE restore_point_records (account_id ${id} NOT NULL, id ${s(64)} NOT NULL, type ${s(20)} NOT NULL, blob TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, PRIMARY KEY (account_id, id))`);
  } },
  { id: 16, name: 'terms and privacy acceptance on the account owner', up: async (db) => {
    // Which version of the Terms and Privacy Policy the account owner accepted, and when. Nothing else: no extra personal data. Existing accounts stay empty and are asked once at their next Administrator sign-in.
    await db.exec(`ALTER TABLE accounts ADD COLUMN terms_version ${s(40)}`);
    await db.exec('ALTER TABLE accounts ADD COLUMN terms_accepted_at BIGINT');
  } },
  { id: 17, name: 'support tickets (internal): tickets, messages, screenshots, Host notes and read marks', up: async (db) => {
    // Tickets are written by signed-in resellers and read by the Host (unlike the encrypted account data). Text is plain; screenshots are stored in the database as base64 text,
    // so every snapshot, full-site backup and database dump carries them. account_id, account_code and account_name are copied onto the ticket so it survives the account's erase
    // and so a later public (no-account) form can attach: source says where it came from, account_id and requester_id may be empty, contact_token_hash is for a secret ticket link.
    const big = db.client === 'mysql' ? 'LONGTEXT' : 'TEXT';
    await db.exec(`CREATE TABLE support_tickets (
      id ${id} PRIMARY KEY, number INTEGER NOT NULL UNIQUE, source ${s(12)} NOT NULL, account_id ${s(40)}, account_code ${s(20)}, account_name ${s()},
      requester_id ${s(40)}, requester_username ${s(100)}, requester_role ${s(40)}, requester_email ${s()}, contact_token_hash ${s(64)},
      subject ${s(200)} NOT NULL, category ${s(60)} NOT NULL, priority ${s(40)} NOT NULL, status ${s(20)} NOT NULL, assignee_id ${s(40)},
      app_version ${s(40)}, device ${s(100)}, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, last_requester_at BIGINT, last_host_at BIGINT, resolved_at BIGINT, closed_at BIGINT)`);
    await db.exec('CREATE INDEX idx_tickets_status ON support_tickets (status, updated_at)');
    await db.exec('CREATE INDEX idx_tickets_account ON support_tickets (account_id, created_at)');
    await db.exec('CREATE INDEX idx_tickets_requester ON support_tickets (requester_id)');
    // side: requester | host | system. internal 1 = a Host-only note or log line that the reseller never sees.
    await db.exec(`CREATE TABLE support_messages (
      id ${id} PRIMARY KEY, ticket_id ${id} NOT NULL, ts BIGINT NOT NULL, side ${s(10)} NOT NULL, internal INTEGER NOT NULL DEFAULT 0, author_id ${s(40)}, author_name ${s(100)}, body TEXT NOT NULL, diagnostics TEXT)`);
    await db.exec('CREATE INDEX idx_support_msg_ticket ON support_messages (ticket_id, ts)');
    // ticket_id and message_id stay empty while a screenshot is uploaded but not yet sent; those are removed after an hour.
    await db.exec(`CREATE TABLE support_attachments (
      id ${id} PRIMARY KEY, ticket_id ${s(40)}, message_id ${s(40)}, account_id ${s(40)}, owner_kind ${s(8)} NOT NULL, owner_id ${s(40)} NOT NULL, name ${s(120)} NOT NULL, mime ${s(20)} NOT NULL, size INTEGER NOT NULL, data ${big} NOT NULL, created_at BIGINT NOT NULL)`);
    await db.exec('CREATE INDEX idx_support_att_ticket ON support_attachments (ticket_id)');
    await db.exec('CREATE INDEX idx_support_att_owner ON support_attachments (owner_kind, owner_id)');
    await db.exec(`CREATE TABLE support_notes (account_id ${id} PRIMARY KEY, body TEXT NOT NULL, updated_at BIGINT NOT NULL, updated_by ${s(100)})`);
    await db.exec(`CREATE TABLE support_views (ticket_id ${id} NOT NULL, user_id ${id} NOT NULL, seen_at BIGINT NOT NULL, PRIMARY KEY (ticket_id, user_id))`);
  } },
  { id: 18, name: 'Demo mode: the demo tag on accounts and the demo logins', up: async (db) => {
    // demo = 1 only on accounts made by Demo mode's Build; demo_set says which set (demo3, demo300, ...). Every Demo action selects on this tag and nothing else, so a real account is never picked.
    // demo_logins holds one row per named demo login with its password sealed by the server key (the demo accounts hold only made-up data, so the password may be recovered; real accounts never get a row here).
    await db.exec('ALTER TABLE accounts ADD COLUMN demo INTEGER NOT NULL DEFAULT 0');
    await db.exec(`ALTER TABLE accounts ADD COLUMN demo_set ${s(40)}`);
    await db.exec('CREATE INDEX idx_accounts_demo ON accounts (demo, demo_set)');
    await db.exec(`CREATE TABLE demo_logins (
      user_id ${id} PRIMARY KEY, account_id ${id} NOT NULL, set_key ${s(40)} NOT NULL, kind ${s(12)} NOT NULL, login ${s(160)} NOT NULL, role ${s(40)} NOT NULL, pw_sealed TEXT NOT NULL, created_at BIGINT NOT NULL, rotated_at BIGINT)`);
    await db.exec('CREATE INDEX idx_demo_logins_set ON demo_logins (set_key)');
  } },
];

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].id; // used by the offsite test to refuse a copy made by a newer app

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
