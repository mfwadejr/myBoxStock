// SERVICES / demo / remove — what Demo mode has built (counts per set), a preview of a removal, and the removal itself.
// THE DEMO TAG IS THE ONLY CRITERION: every statement here starts from `accounts.demo = 1` (and, for one set, `demo_set = ?`). A real account is never selected, counted as removable or touched.
import { jobStep, jobBytes, jobStopRequested } from '../backup/progress.mjs';
import { audit, coded } from './audit.mjs';

const TABLES = ['records', 'restore_point_records', 'restore_points', 'account_keys', 'account_recovery', 'account_roles', 'inventory_items', 'billing_events', 'billing_receipts', 'receipt_mail_usage', 'sign_in_history', 'demo_logins', 'support_attachments', 'support_notes'];
const where = (set) => set ? 'demo = 1 AND demo_set = ?' : 'demo = 1';
const args = (set) => set ? [set] : [];

// Counts per set key, for the Demo mode page and for previews. `built` = how many accounts exist now.
export async function builtStats(db) {
  const accts = await db.all('SELECT demo_set AS k, COUNT(*) AS n FROM accounts WHERE demo = 1 GROUP BY demo_set');
  const users = await db.all('SELECT a.demo_set AS k, COUNT(*) AS n FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE a.demo = 1 GROUP BY a.demo_set');
  const recs = await db.all('SELECT a.demo_set AS k, COUNT(*) AS n FROM records r JOIN accounts a ON a.id = r.account_id WHERE a.demo = 1 GROUP BY a.demo_set');
  const when = await db.all('SELECT set_key AS k, MIN(created_at) AS t FROM demo_logins GROUP BY set_key');
  const out = {};
  for (const r of accts) out[r.k] = { accounts: Number(r.n), users: 0, records: 0, builtAt: null };
  for (const r of users) if (out[r.k]) out[r.k].users = Number(r.n);
  for (const r of recs) if (out[r.k]) out[r.k].records = Number(r.n);
  for (const r of when) if (out[r.k]) out[r.k].builtAt = Number(r.t);
  return out;
}
// Totals for the Host numbers (Overview): demo accounts, people, opaque records.
export async function demoTotals(db) {
  const a = await db.get('SELECT COUNT(*) AS n FROM accounts WHERE demo = 1'), u = await db.get('SELECT COUNT(*) AS n FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE a.demo = 1');
  const r = await db.get('SELECT COUNT(*) AS n FROM records r JOIN accounts a ON a.id = r.account_id WHERE a.demo = 1');
  return { accounts: Number(a.n), users: Number(u.n), records: Number(r.n) };
}
// What a removal would delete, and (for reassurance) how many real accounts it will not touch.
export async function previewRemove(db, set = null) {
  if (set && !/^[a-z][a-z0-9]{1,19}$/.test(set)) throw coded('DEMO_SET_UNKNOWN');
  const st = await builtStats(db), keys = set ? [set] : Object.keys(st), t = { accounts: 0, users: 0, records: 0 };
  for (const k of keys) if (st[k]) { t.accounts += st[k].accounts; t.users += st[k].users; t.records += st[k].records; }
  const real = await db.get('SELECT COUNT(*) AS n FROM accounts WHERE demo = 0');
  return { set, sets: keys.filter(k => st[k]), ...t, bytes: t.records * 820, realAccounts: Number(real.n) };
}

// Deletes the demo accounts (all of them, or one set) and everything inside them, a few accounts at a time. Returns counts. Stops after the current few when asked.
export async function removeAccounts(db, { set = null, actor = 'System', shouldStop = null } = {}) {
  const ids = (await db.all(`SELECT id FROM accounts WHERE ${where(set)}`, args(set))).map(r => r.id), done = { accounts: 0, users: 0, records: 0 };
  let stopped = false;
  for (let i = 0; i < ids.length; i += 20) {
    if (shouldStop?.() || jobStopRequested()) { stopped = true; break; }
    // re-check the tag on exactly these ids, so a row that is not demo can never be in the list
    const part = (await db.all(`SELECT id FROM accounts WHERE demo = 1 AND id IN (${ids.slice(i, i + 20).map(() => '?').join(',')})`, ids.slice(i, i + 20))).map(r => r.id); if (!part.length) continue;
    const q = part.map(() => '?').join(','), users = `SELECT id FROM account_users WHERE account_id IN (${q})`;
    await db.tx(async (t) => {
      await t.run(`DELETE FROM sessions WHERE realm = 'app' AND account_id IN (${q})`, part);
      await t.run(`DELETE FROM password_resets WHERE realm = 'app' AND subject_id IN (${users})`, part);
      await t.run(`DELETE FROM email_confirmations WHERE user_id IN (${users})`, part);
      await t.run(`DELETE FROM admin_links WHERE user_id IN (${users})`, part);
      await t.run(`DELETE FROM support_views WHERE user_id IN (${users})`, part);
      await t.run(`DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE account_id IN (${q}))`, part);
      await t.run(`DELETE FROM support_tickets WHERE account_id IN (${q})`, part);
      done.records += (await t.run(`DELETE FROM records WHERE account_id IN (${q})`, part)).changes;
      for (const tbl of TABLES.filter(x => x !== 'records')) await t.run(`DELETE FROM ${tbl} WHERE account_id IN (${q})`, part);
      done.users += (await t.run(`DELETE FROM account_users WHERE account_id IN (${q})`, part)).changes;
      done.accounts += (await t.run(`DELETE FROM accounts WHERE demo = 1 AND id IN (${q})`, part)).changes;
    });
    jobBytes(Math.min(i + 20, ids.length), ids.length);
    await new Promise(r => setImmediate(r));
  }
  return { ...done, stopped, planned: ids.length };
}

// The Remove job body: removal with audit entries. `reason` is 'remove' or 'reset' (the audit event).
export async function removeWithAudit(db, { set = null, actor, ip = null, event = 'demo.remove' }) {
  jobStep(set ? `Removing ${set}` : 'Removing all demo accounts', 2, 98);
  const t0 = Date.now(), out = await removeAccounts(db, { set, actor });
  audit(out.stopped ? 'demo.stopped' : event, `${out.stopped ? 'Stopped while removing' : 'Removed'} demo ${set ? 'set ' + set : 'accounts'}: ${out.accounts} accounts, ${out.users} people, ${out.records} records`, { actor, ip, level: 'warn', data: { set, ...out, ms: Date.now() - t0 } });
  return out;
}
