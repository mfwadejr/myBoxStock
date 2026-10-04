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
import { fail } from '../../core/messages.mjs';
import { billingState } from '../../services/billing/state.mjs';
import { sendConfirmation } from '../../services/verify/index.mjs';
import { setPlan } from '../../services/billing/index.mjs';

export function accountsRoutes(db) {
  const r = express.Router();
  const A = (req, level, event, message, a, data) => hostLog(req, level, event, message, { area: 'accounts', accountId: a?.id || null, data });
  const getAccount = (id) => db.get('SELECT id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_until, plan_note, plan_changed_at, created_at, last_activity, host_link_allowed FROM accounts WHERE id = ?', [id]);
  const userOf = (req) => db.get('SELECT id, account_id, username, login, email, role FROM account_users WHERE id = ? AND account_id = ?', [req.params.uid, req.params.id]);

  r.get('/', async (req, res) => {
    const q = `%${String(req.query.q || '').toLowerCase()}%`;
    const rows = await db.all(`SELECT a.id, a.account_code, a.business_name, a.owner_email, a.status, a.plan, a.trial_ends_at, a.plan_until, a.plan_note, a.created_at, a.last_activity,
      (SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id) AS user_count FROM accounts a
      WHERE LOWER(a.business_name) LIKE ? OR LOWER(a.account_code) LIKE ? OR LOWER(a.owner_email) LIKE ? ORDER BY a.created_at DESC LIMIT 200`, [q, q, q]);
    const want = String(req.query.plan || '');   // '' | trial | free | paid | expired
    const out = rows.map(x => ({ ...x, user_count: Number(x.user_count), billing: billingState(x) }))
      .filter(x => !want || (want === 'expired' ? !x.billing.canWrite : x.billing.state === want));
    res.json(out);
  });

  r.get('/:id', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    const users = await db.all('SELECT id, username, login, email, email_verified_at, role, disabled, totp_enabled, must_change, created_at, last_login FROM account_users WHERE account_id = ? ORDER BY created_at', [a.id]);
    const events = await db.all("SELECT ts, actor, event, message FROM event_log WHERE account_id = ? AND area IN ('auth','accounts') ORDER BY ts DESC LIMIT 25", [a.id]);
    const history = await db.all('SELECT ts, kind, from_plan, to_plan, actor, note FROM billing_events WHERE account_id = ? ORDER BY ts DESC LIMIT 25', [a.id]);
    // What the Host can know about stored data: whether it is encrypted and how many opaque records exist. Never what they contain.
    const enc = await db.get('SELECT confirmed_at FROM account_recovery WHERE account_id = ?', [a.id]);
    const n = await db.get('SELECT COUNT(*) AS n FROM records WHERE account_id = ?', [a.id]);
    const owner = (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
    res.json({ account: { ...a, billing: billingState(a) }, isOwner: req.subject.id === owner, users, events, history, data: { encrypted: !!enc, recordCount: Number(n.n) } });
  });

  // Owner administrator only: let this account's Administrators link a Host administrator sign-in (the account switcher). Switching off also removes existing links.
  r.post('/:id/host-link', async (req, res) => {
    const owner = (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
    if (req.subject.id !== owner) return res.status(403).json({ error: 'Only the Owner administrator can do that.' });
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    const allowed = !!req.body?.allowed;
    await db.run('UPDATE accounts SET host_link_allowed = ? WHERE id = ?', [allowed ? 1 : 0, a.id]);
    if (!allowed) await db.run('DELETE FROM admin_links WHERE user_id IN (SELECT id FROM account_users WHERE account_id = ?)', [a.id]);
    A(req, 'warn', allowed ? 'account.hostlink_allowed' : 'account.hostlink_blocked', `Account ${a.account_code}: linking a Host administrator ${allowed ? 'allowed' : 'turned off (existing links removed)'}`, a, { code: a.account_code });
    res.json({ ok: true });
  });

  r.post('/:id/status', async (req, res) => {
    const status = req.body.status; if (!['active', 'suspended'].includes(status)) return fail(res, 400, 'BAD_ACCOUNT_STATUS');
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    await db.run('UPDATE accounts SET status = ? WHERE id = ?', [status, a.id]);
    if (status === 'suspended') await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [a.id]);
    A(req, 'warn', `account.${status}`, `Account ${a.account_code} ${status === 'active' ? 'reactivated' : 'suspended (all sessions ended)'}`, a, { code: a.account_code });
    res.json({ ok: true });
  });

  r.delete('/:id', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    if (req.body.confirm !== a.account_code) return res.status(400).json({ error: `Type the Reseller ID (${a.account_code}) to confirm.` });
    await db.tx(async (t) => { // write-only erase; nothing is read
      await t.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [a.id]);
      await t.run('DELETE FROM password_resets WHERE realm = ? AND subject_id IN (SELECT id FROM account_users WHERE account_id = ?)', ['app', a.id]);
      await t.run('DELETE FROM admin_links WHERE user_id IN (SELECT id FROM account_users WHERE account_id = ?)', [a.id]);
      await t.run('DELETE FROM inventory_items WHERE account_id = ?', [a.id]); await t.run('DELETE FROM records WHERE account_id = ?', [a.id]); await t.run('DELETE FROM account_keys WHERE account_id = ?', [a.id]); await t.run('DELETE FROM account_recovery WHERE account_id = ?', [a.id]); await t.run('DELETE FROM account_roles WHERE account_id = ?', [a.id]);
      await t.run('DELETE FROM account_users WHERE account_id = ?', [a.id]); await t.run('DELETE FROM billing_events WHERE account_id = ?', [a.id]); await t.run('DELETE FROM sign_in_history WHERE account_id = ?', [a.id]); await t.run('DELETE FROM accounts WHERE id = ?', [a.id]);
    });
    A(req, 'warn', 'account.deleted', `Account ${a.account_code} (${a.business_name}) permanently deleted`, a, { code: a.account_code });
    res.json({ ok: true });
  });

  // Change an account's plan: free (comped), trial (start or extend), or paid. Every change is kept in billing_events.
  r.post('/:id/plan', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    try {
      const b = await setPlan(db, a, { plan: req.body?.plan, days: req.body?.days, extend: !!req.body?.extend, until: req.body?.until, note: req.body?.note, actor: req.subject.username });
      res.json({ ok: true, billing: b });
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not change the plan.' }); }
  });

  // Delete one person from an account (identity only). Never the account's last Administrator — delete the whole account for that.
  r.delete('/:id/users/:uid', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    if (req.body?.confirm !== u.login) return res.status(400).json({ error: `Type ${u.login} to confirm.` });
    if (u.role === 'Administrator') {
      const others = await db.get("SELECT COUNT(*) AS n FROM account_users WHERE account_id = ? AND role = 'Administrator' AND id <> ?", [u.account_id, u.id]);
      if (Number(others.n) < 1) return res.status(400).json({ error: 'This is the last Administrator. Delete the whole account instead.' });
    }
    await db.tx(async (t) => {
      await t.run("DELETE FROM sessions WHERE realm = 'app' AND subject_id = ?", [u.id]);
      await t.run("DELETE FROM password_resets WHERE realm = 'app' AND subject_id = ?", [u.id]);
      await t.run('DELETE FROM admin_links WHERE user_id = ?', [u.id]);
      await t.run('DELETE FROM account_keys WHERE user_id = ?', [u.id]);
      await t.run('DELETE FROM account_users WHERE id = ? AND account_id = ?', [u.id, u.account_id]);
    });
    A(req, 'warn', 'user.deleted', `Host administrator deleted user ${u.login} (${u.role})`, { id: u.account_id }, { login: u.login, role: u.role });
    res.json({ ok: true });
  });

  r.post('/:id/users/:uid/reset-link', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    if (!u.email) return res.status(400).json({ error: 'This user has no email address on file.' });
    const raw = token(32);
    await db.run('INSERT INTO password_resets (token_hash, realm, subject_id, expires_at, used) VALUES (?,?,?,?,0)', [sha256(raw), 'app', u.id, Date.now() + 3600e3]);
    await enqueueMail(db, u.email, 'password_reset', { name: u.username, username: u.username, accountCode: (await db.get('SELECT account_code FROM accounts WHERE id = ?', [u.account_id]))?.account_code || '', link: `${config.publicUrl}/app/#/reset/${raw}` }); processQueue(db).catch(() => {});
    A(req, 'info', 'user.reset_link_sent', `Password reset link emailed to ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true });
  });
  r.post('/:id/users/:uid/verify-resend', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    if (!u.email) return res.status(400).json({ error: 'This user has no email address on file.' });
    const a = await db.get('SELECT account_code FROM accounts WHERE id = ?', [u.account_id]);
    const s = await sendConfirmation(db, u, u.email, { accountCode: a?.account_code, ip: null });
    if (!s.sent) return res.status(s.reason === 'mail_off' ? 400 : 429).json({ error: s.reason === 'mail_off' ? 'Email is not set up, so nothing can be sent.' : s.reason === 'too_soon' ? 'One was sent a moment ago. Wait a minute.' : 'Daily limit reached for this person.' });
    A(req, 'info', 'user.verify_resent', `Confirmation email re-sent to ${u.login}`, { id: u.account_id }, { login: u.login }); res.json({ ok: true });
  });
  r.post('/:id/users/:uid/mark-verified', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const reason = String(req.body?.reason || '').trim(); if (reason.length < 3) return res.status(400).json({ error: 'Say why (a few words), so the log explains it.' });
    await db.run('UPDATE account_users SET email_verified_at = ? WHERE id = ?', [Date.now(), u.id]);
    A(req, 'warn', 'user.marked_verified', `Email for ${u.login} marked as confirmed by a Host administrator: ${reason.slice(0, 200)}`, { id: u.account_id }, { login: u.login, reason: reason.slice(0, 200) }); res.json({ ok: true });
  });
  r.post('/:id/users/:uid/temp-password', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const pw = token(9).replace(/[-_]/g, 'x') + '7';
    await db.run('UPDATE account_users SET pw_hash = ?, must_change = 1 WHERE id = ?', [hashPassword(pw), u.id]);
    await destroyAllFor(db, 'app', u.id, 'temporary password set by host admin');
    A(req, 'warn', 'user.temp_password', `Temporary password set for ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true, tempPassword: pw }); // shown once to the host admin, never logged
  });
  r.post('/:id/users/:uid/reset-mfa', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    await db.run('UPDATE account_users SET totp_enabled = 0, totp_secret = NULL, recovery_hashes = NULL WHERE id = ?', [u.id]);
    await destroyAllFor(db, 'app', u.id, 'two-factor reset by host admin');
    if (u.email) { await enqueueMail(db, u.email, 'mfa_reset', { name: u.username }); processQueue(db).catch(() => {}); }
    A(req, 'warn', 'user.mfa_reset', `Two-factor reset for ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true });
  });
  r.post('/:id/users/:uid/disabled', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const off = !!req.body.disabled;
    await db.run('UPDATE account_users SET disabled = ? WHERE id = ?', [off ? 1 : 0, u.id]);
    if (off) await destroyAllFor(db, 'app', u.id, 'user disabled by host admin');
    A(req, 'warn', off ? 'user.disabled' : 'user.enabled', `Sign-in ${off ? 'disabled' : 'enabled'} for ${u.login}`, { id: u.account_id }, { login: u.login });
    res.json({ ok: true });
  });
  return r;
}
