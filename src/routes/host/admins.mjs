// ROUTES / host / admins — host administrator accounts.
import express from 'express';
import { hostLog } from './context.mjs';
import { hashPassword, passwordProblem } from '../../auth/password.mjs';
import { newId } from '../../core/ids.mjs';

export function adminsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json(await db.all('SELECT id, username, email, totp_enabled, last_login, created_at FROM host_admins ORDER BY created_at')));
  r.post('/', async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase(), bad = passwordProblem(req.body.password);
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: 'Username: 3–40 letters, numbers, . _ -' });
    if (bad) return res.status(400).json({ error: bad });
    if (await db.get('SELECT id FROM host_admins WHERE username = ?', [username])) return res.status(400).json({ error: 'That username exists.' });
    await db.run('INSERT INTO host_admins (id, username, email, pw_hash, must_change, created_at) VALUES (?,?,?,?,1,?)', [newId(), username, req.body.email || null, hashPassword(req.body.password), Date.now()]);
    hostLog(req, 'info', 'admin.created', `Host administrator "${username}" created`, { data: { username } });
    res.json({ ok: true });
  });
  // Delete another host administrator. Not yourself, and never the last one (that would lock everyone out).
  r.delete('/:id', async (req, res) => {
    const a = await db.get('SELECT id, username FROM host_admins WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Administrator not found.' });
    if (a.id === req.subject.id) return res.status(400).json({ error: 'You cannot delete the account you are signed in with.' });
    if (req.body?.confirm !== a.username) return res.status(400).json({ error: `Type ${a.username} to confirm.` });
    const n = await db.get('SELECT COUNT(*) AS n FROM host_admins'); if (Number(n.n) <= 1) return res.status(400).json({ error: 'At least one host administrator must remain.' });
    await db.tx(async (t) => {
      await t.run("DELETE FROM sessions WHERE realm = 'host' AND subject_id = ?", [a.id]);
      await t.run("DELETE FROM password_resets WHERE realm = 'host' AND subject_id = ?", [a.id]);
      await t.run('DELETE FROM host_admins WHERE id = ?', [a.id]);
    });
    hostLog(req, 'warn', 'admin.deleted', `Host administrator "${a.username}" deleted`, { data: { username: a.username } });
    res.json({ ok: true });
  });
  return r;
}
