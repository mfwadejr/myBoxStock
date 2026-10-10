// SERVICES / demo / strip — takes the demo accounts out of a COPY of the database (the snapshot a full-site backup is made from), never out of the live one.
// Backups exclude demo accounts by default (a setting), so restoring a backup never brings demo data back. SQLite snapshots only; a database dump from PostgreSQL or MariaDB is left whole.
import { DatabaseSync } from 'node:sqlite';
import { getSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';

const L = areaLogger('backup');
const TABLES = ['records', 'restore_point_records', 'restore_points', 'account_keys', 'account_recovery', 'account_roles', 'inventory_items', 'billing_events', 'billing_receipts', 'receipt_mail_usage', 'sign_in_history', 'demo_logins', 'support_attachments', 'support_notes'];

export async function stripDemoFromSnapshot(db, file) {
  if (db.client !== 'sqlite') return { removed: 0 };
  const saved = await getSetting(db, 'demo_mode', null); if (saved && saved.excludeFromBackups === false) return { removed: 0, kept: true };
  const d = new DatabaseSync(file);
  try {
    const n = Number(d.prepare('SELECT COUNT(*) AS n FROM accounts WHERE demo = 1').get().n); if (!n) return { removed: 0 };
    const mine = 'SELECT id FROM accounts WHERE demo = 1', users = `SELECT id FROM account_users WHERE account_id IN (${mine})`;
    d.exec('BEGIN');
    d.exec(`DELETE FROM sessions WHERE account_id IN (${mine}); DELETE FROM password_resets WHERE subject_id IN (${users}); DELETE FROM email_confirmations WHERE user_id IN (${users}); DELETE FROM admin_links WHERE user_id IN (${users}); DELETE FROM support_views WHERE user_id IN (${users});
      DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE account_id IN (${mine})); DELETE FROM support_tickets WHERE account_id IN (${mine});`);
    for (const t of TABLES) d.exec(`DELETE FROM ${t} WHERE account_id IN (${mine})`);
    d.exec(`DELETE FROM account_users WHERE account_id IN (${mine}); DELETE FROM accounts WHERE demo = 1; COMMIT`);
    d.exec('VACUUM');
    L.info('demo.stripped', `${n} demo accounts were left out of the backup copy`, { data: { accounts: n } });
    return { removed: n };
  } finally { d.close(); }
}
