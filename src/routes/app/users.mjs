// ROUTES / app / users — the account's own team members.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { hashPassword, passwordProblem } from '../../auth/password.mjs';
import { destroyAllFor } from '../../auth/session.mjs';
import { validKeys, saveKeys, vaultEnabled } from '../../services/vault/keys.mjs';
import { fail } from '../../core/messages.mjs';
import { newId } from '../../core/ids.mjs';

export function usersRoutes(db) {
  const r = express.Router();
  r.get('/', need('users.manage'), async (req, res) => res.json(await db.all(`SELECT id, username, login, email, role, disabled, totp_enabled, last_login,
    (SELECT s.ip FROM sign_in_history s WHERE s.user_id = account_users.id AND s.result = 'signed_in' ORDER BY s.ts DESC LIMIT 1) AS last_ip,
    (SELECT COUNT(*) FROM sessions x WHERE x.realm = 'app' AND x.subject_id = account_users.id AND x.mfa_pending = 0 AND x.expires_at > ?) AS active_sessions
    FROM account_users WHERE account_id = ? ORDER BY created_at`, [Date.now(), req.subject.account_id])));
  r.post('/', need('users.manage'), async (req, res) => {
    const { username, email, role, password } = req.body;
    if (!/^[a-z0-9._-]{3,30}$/i.test(username || '')) return res.status(400).json({ error: 'Username: 3–30 letters, numbers, . _ -' });
    const bad = passwordProblem(password); if (bad) return res.status(400).json({ error: bad });
    if (!await db.get('SELECT id FROM account_roles WHERE account_id = ? AND name = ?', [req.subject.account_id, role])) return res.status(400).json({ error: 'Unknown role.' });
    const login = `${username.toLowerCase()}@${req.subject.account_code.toLowerCase()}`;
    if (await db.get('SELECT id FROM account_users WHERE login = ?', [login])) return res.status(400).json({ error: 'That username is taken in your account.' });
    const id = newId();
    await db.run('INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, must_change, created_at) VALUES (?,?,?,?,?,?,?,1,?)', [id, req.subject.account_id, login, username.toLowerCase(), email || null, role, hashPassword(password), Date.now()]);
    // In an encrypted account the Administrator's browser wraps the account key under the new person's temporary password.
    if (await vaultEnabled(db, req.subject.account_id) && validKeys(req.body.keys)) await saveKeys(db, { id, account_id: req.subject.account_id }, req.body.keys);
    tenantLog(req, 'user.created', `${req.subject.login} added ${login} as ${role}`, { userId: id, role });
    res.json({ ok: true, login });
  });
  r.post('/:uid/disabled', need('users.manage'), async (req, res) => {
    if (req.params.uid === req.subject.id) return res.status(400).json({ error: 'You cannot disable yourself.' });
    const off = !!req.body.disabled;
    const n = await db.run('UPDATE account_users SET disabled = ? WHERE id = ? AND account_id = ?', [off ? 1 : 0, req.params.uid, req.subject.account_id]);
    if (n.changes && off) await destroyAllFor(db, 'app', req.params.uid, 'disabled by account administrator');
    if (n.changes) tenantLog(req, off ? 'user.disabled' : 'user.enabled', `${req.subject.login} ${off ? 'disabled' : 'enabled'} user ${req.params.uid}`, { userId: req.params.uid });
    res.json({ ok: n.changes > 0 });
  });
  // Give a person a new temporary password AND fresh access to the data (for someone who lost their password and recovery is not an option).
  r.post('/:uid/reset-access', need('users.manage'), async (req, res) => {
    const u = await db.get('SELECT id, login FROM account_users WHERE id = ? AND account_id = ?', [req.params.uid, req.subject.account_id]);
    if (!u) return fail(res, 404, 'NOT_FOUND');
    if (u.id === req.subject.id) return res.status(400).json({ error: 'Use Security to change your own password.' });
    const bad = passwordProblem(req.body.password); if (bad) return res.status(400).json({ error: bad });
    const enabled = await vaultEnabled(db, req.subject.account_id);
    if (enabled && !validKeys(req.body.keys)) return fail(res, 400, 'VAULT_BAD_KEYS');
    await db.run('UPDATE account_users SET pw_hash = ?, must_change = 1 WHERE id = ?', [hashPassword(req.body.password), u.id]);
    if (enabled) await saveKeys(db, { id: u.id, account_id: req.subject.account_id }, req.body.keys);
    await destroyAllFor(db, 'app', u.id, 'access reset by account administrator');
    tenantLog(req, 'user.access_reset', `${req.subject.login} gave ${u.login} a new temporary password`, { userId: u.id });
    res.json({ ok: true });
  });
  // Delete another person from this account. Not yourself, and never the last Administrator.
  r.delete('/:uid', need('users.manage'), async (req, res) => {
    const u = await db.get('SELECT id, login, role FROM account_users WHERE id = ? AND account_id = ?', [req.params.uid, req.subject.account_id]);
    if (!u) return res.status(404).json({ error: 'Person not found.' });
    if (u.id === req.subject.id) return res.status(400).json({ error: 'You cannot delete yourself.' });
    if (req.body?.confirm !== u.login) return res.status(400).json({ error: `Type ${u.login} to confirm.` });
    if (u.role === 'Administrator') {
      const others = await db.get("SELECT COUNT(*) AS n FROM account_users WHERE account_id = ? AND role = 'Administrator' AND id <> ?", [req.subject.account_id, u.id]);
      if (Number(others.n) < 1) return res.status(400).json({ error: 'An account needs at least one Administrator.' });
    }
    await db.tx(async (t) => {
      await t.run("DELETE FROM sessions WHERE realm = 'app' AND subject_id = ?", [u.id]);
      await t.run("DELETE FROM password_resets WHERE realm = 'app' AND subject_id = ?", [u.id]);
      await t.run('DELETE FROM account_keys WHERE user_id = ?', [u.id]);
      await t.run('DELETE FROM sign_in_history WHERE user_id = ? AND account_id = ?', [u.id, req.subject.account_id]);
      await t.run('DELETE FROM account_users WHERE id = ? AND account_id = ?', [u.id, req.subject.account_id]);
    });
    tenantLog(req, 'user.deleted', `${req.subject.login} deleted ${u.login} (${u.role})`, { userId: u.id, role: u.role });
    res.json({ ok: true });
  });
  return r;
}
