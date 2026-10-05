// SERVICES / accounts / closing — closing an account: a 7-day locked period (restorable), then an automatic erase. Also the erase itself.
import { areaLogger } from '../../logging/logger.mjs';
import { destroyAllFor } from '../../auth/session.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { siteUrl } from '../site/index.mjs';

const L = areaLogger('accounts');
export const GRACE_DAYS = 7, GRACE_MS = GRACE_DAYS * 24 * 3600e3;
const day = (ms) => new Date(Number(ms)).toISOString().slice(0, 10);

// Write-only erase: nothing is read. Removes the account, its people, keys, records and history.
export async function eraseAccount(db, id) {
  await db.tx(async (t) => {
    await t.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [id]);
    await t.run('DELETE FROM password_resets WHERE realm = ? AND subject_id IN (SELECT id FROM account_users WHERE account_id = ?)', ['app', id]);
    await t.run('DELETE FROM email_confirmations WHERE user_id IN (SELECT id FROM account_users WHERE account_id = ?)', [id]);
    await t.run('DELETE FROM admin_links WHERE user_id IN (SELECT id FROM account_users WHERE account_id = ?)', [id]);
    for (const tbl of ['inventory_items', 'records', 'restore_point_records', 'restore_points', 'account_keys', 'account_recovery', 'account_roles', 'account_users', 'billing_events', 'billing_receipts', 'sign_in_history']) await t.run(`DELETE FROM ${tbl} WHERE account_id = ?`, [id]);
    await t.run('DELETE FROM accounts WHERE id = ?', [id]);
  });
}

const recipients = (a, extra) => [...new Set([a.owner_email, extra].filter(Boolean).map(x => String(x).trim()).filter(Boolean))];

export async function startClosing(db, a, { actor, email } = {}) {
  const at = Date.now() + GRACE_MS;
  await db.run('UPDATE accounts SET closing_at = ?, closing_by = ? WHERE id = ?', [at, String(actor || '').slice(0, 160), a.id]);
  // Everyone but Administrators is signed out now; Administrators can still look around and restore the account.
  for (const u of await db.all("SELECT id FROM account_users WHERE account_id = ? AND role <> 'Administrator'", [a.id])) await destroyAllFor(db, 'app', u.id, 'account is closing');
  L.warn('account.closing', `Account ${a.account_code} is closing: locked now, erases on ${day(at)}`, { actor, accountId: a.id, data: { code: a.account_code, eraseAt: at } });
  for (const to of recipients(a, email)) await enqueueMail(db, to, 'account_closing', { name: a.business_name, accountCode: a.account_code, eraseDate: day(at), url: `${await siteUrl(db)}/app/` });
  processQueue(db).catch(() => {});
  return at;
}
export async function restoreClosing(db, a, { actor } = {}) {
  await db.run('UPDATE accounts SET closing_at = NULL, closing_by = NULL WHERE id = ?', [a.id]);
  L.warn('account.restored', `Account ${a.account_code} restored: closing cancelled`, { actor, accountId: a.id, data: { code: a.account_code } });
}

// Hourly (and once at start, so a server that was down still catches up): erase accounts whose 7 days are over.
export async function sweepClosing(db) {
  const rows = await db.all('SELECT id, account_code, business_name, owner_email, closing_by FROM accounts WHERE closing_at IS NOT NULL AND closing_at <= ?', [Date.now()]);
  for (const a of rows) {
    const people = await db.all("SELECT email FROM account_users WHERE account_id = ? AND role = 'Administrator' AND email IS NOT NULL", [a.id]);
    const to = recipients(a, null).concat(people.map(p => p.email));
    await eraseAccount(db, a.id);
    L.warn('account.erased', `Account ${a.account_code} (${a.business_name}) erased automatically after the closing period`, { actor: 'system', accountId: null, data: { code: a.account_code, closedBy: a.closing_by } });
    for (const x of [...new Set(to)]) await enqueueMail(db, x, 'account_erased', { name: a.business_name, accountCode: a.account_code });
  }
  if (rows.length) processQueue(db).catch(() => {});
  return rows.length;
}
