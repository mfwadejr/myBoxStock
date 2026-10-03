// ROUTES / host / accounts — support tools for signed-up accounts.
// PRIVACY BOUNDARY: only identity & security columns are read. Never touch inventory_items or other business tables
// (the one exception is the write-only DELETE when an account is erased).
import express from 'express';
import { hostLog } from './context.mjs';
import { hashPassword } from '../../auth/password.mjs';
import { destroyAllFor } from '../../auth/session.mjs';
import { token, sha256 } from '../../core/ids.mjs';
import { enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { config } from '../../core/config.mjs';

export function accountsRoutes(db) {
  const r = express.Router();
  const A = (req, level, event, message, a, data) => hostLog(req, level, event, message, { area: 'accounts', accountId: a?.id || null, data });
  const getAccount = (id) => db.get('SELECT id, account_code, business_name, owner_email, status, plan, created_at, last_activity FROM accounts WHERE id = ?', [id]);
  const userOf = (req) => db.get('SELECT id, account_id, username, login, email FROM account_users WHERE id = ? AND account_id = ?', [req.params.uid, req.params.id]);

  r.get('/', async (req, res) => {
    const q = `%${String(req.query.q || '').toLowerCase()}%`;
    const rows = await db.all(`SELECT a.id, a.account_code, a.business_name, a.owner_email, a.status, a.plan, a.created_at, a.last_activity,
      (SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id) AS user_count FROM accounts a
      WHERE LOWER(a.business_name) LIKE ? OR LOWER(a.account_code) LIKE ? OR LOWER(a.owner_email) LIKE ? ORDER BY a.created_at DESC LIMIT 200`, [q, q, q]);
    res.json(rows.map(x => ({ ...x, user_count: Number(x.user_count) })));
  });

  r.get('/:id', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return res.status(404).json({ error: 'Not found' });
    const users = await db.all('SELECT id, username, login, email, role, disabled, totp_enabled, must_change, created_at, last_login FROM account_users WHERE account_id = ? ORDER BY created_at', [a.id]);
    const events = await db.all("SELECT ts, actor, event, message FROM event_log WHERE account_id = ? AND area IN ('auth','accounts') ORDER BY ts DESC LIMIT 25", [a.id]);
    res.json({ account: a, users, events });
  });

  r.post('/:id/status', async (req, res) => {
    const status = req.body.status; if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Bad status' });
    const a = await getAccount(req.params.id); if (!a) return res.status(404).json({ error: 'Not found' });
    await db.run('UPDATE accounts SET status = ? WHERE id = ?', [status, a.id]);
    if (status === 'suspended') await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [a.id]);
    A(req, 'warn', `account.${status}`, `Account ${a.account_code} ${status === 'active' ? 'reactivated' : 'suspended (all sessions ended)'}`, a, { code: a.account_code });
    res.json({ ok: true });
  });

  r.delete('/:id', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return res.status(404).json({ error: 'Not found' });
    if (req.body.confirm !== a.account_code) return res.status(400).json({ error: `Type the account ID (${a.account_code}) to confirm.` });
    await db.tx(async (t) => { // write-only erase; nothing is read
      await t.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [a.id]);
      await t.run('DELETE FROM password_resets WHERE realm = ? AND subject_id IN (SELECT id FROM account_users WHERE account_id = ?)', ['app', a.id]);
      await t.run('DELETE FROM inventory_items WHERE account_id = ?', [a.id]); await t.run('DELETE FROM account_roles WHERE account_id = ?', [a.id]);
      await t.run('DELETE FROM account_users WHERE account_id = ?', [a.id]); await t.run('DELETE FROM accounts WHERE id = ?', [a.id]);
    });
    A(req, 'warn', 'account.deleted', `Account ${a.account_code} (${a.business_name}) permanently deleted`, a, { code: a.account_code });
    res.json({ ok: true });
  });

  r.post('/:id/users/:uid/reset-link', async (req, res) => {
    const u = await userOf(req); if (!u) return res.status(404).json({ error: 'Not found' });
    if (!u.email) return res.status(400).json({ error: 'This user has no email address on file.' });
    const raw = token(32);
    await db.run('INSERT INTO password_resets (token_hash, realm, subject_id, expires_at, used) VALUES (?,?,?,?,0)', [sha256(raw), 'app', u.id, Date.now() + 3600e3]);
    await enqueueMail(db, u.email, 'password_reset', { name: u.username, link: `${config.publicUrl}/app/#/reset/${raw}` }); processQueue(db).catch(() => {});
    A(req, 'info', 'user.reset_link_sent', `Password reset link emailed to ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true });
  });
  r.post('/:id/users/:uid/temp-password', async (req, res) => {
    const u = await userOf(req); if (!u) return res.status(404).json({ error: 'Not found' });
    const pw = token(9).replace(/[-_]/g, 'x') + '7';
    await db.run('UPDATE account_users SET pw_hash = ?, must_change = 1 WHERE id = ?', [hashPassword(pw), u.id]);
    await destroyAllFor(db, 'app', u.id, 'temporary password set by host admin');
    A(req, 'warn', 'user.temp_password', `Temporary password set for ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true, tempPassword: pw }); // shown once to the host admin, never logged
  });
  r.post('/:id/users/:uid/reset-mfa', async (req, res) => {
    const u = await userOf(req); if (!u) return res.status(404).json({ error: 'Not found' });
    await db.run('UPDATE account_users SET totp_enabled = 0, totp_secret = NULL, recovery_hashes = NULL WHERE id = ?', [u.id]);
    await destroyAllFor(db, 'app', u.id, 'two-factor reset by host admin');
    if (u.email) { await enqueueMail(db, u.email, 'mfa_reset', { name: u.username }); processQueue(db).catch(() => {}); }
    A(req, 'warn', 'user.mfa_reset', `Two-factor reset for ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true });
  });
  r.post('/:id/users/:uid/disabled', async (req, res) => {
    const u = await userOf(req); if (!u) return res.status(404).json({ error: 'Not found' });
    const off = !!req.body.disabled;
    await db.run('UPDATE account_users SET disabled = ? WHERE id = ?', [off ? 1 : 0, u.id]);
    if (off) await destroyAllFor(db, 'app', u.id, 'user disabled by host admin');
    A(req, 'warn', off ? 'user.disabled' : 'user.enabled', `Sign-in ${off ? 'disabled' : 'enabled'} for ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true });
  });
  return r;
}
