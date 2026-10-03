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
  return r;
}
