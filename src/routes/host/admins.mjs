// ROUTES / host / admins — host administrator accounts. The Owner (the first administrator created, normally "admin") can manage the others;
// everyone can edit their own contact details.
import express from 'express';
import { hostLog } from './context.mjs';
import { hashPassword, passwordProblem } from '../../auth/password.mjs';
import { destroyAllFor } from '../../auth/session.mjs';
import { newId, token } from '../../core/ids.mjs';
import { enqueueMail, processQueue } from '../../services/mail/index.mjs';

const COLUMNS = 'id, username, display_name, email, cell, totp_enabled, last_login, created_at';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, CELL = /^[0-9+()\-.\s]{6,30}$/;

export function adminsRoutes(db) {
  const r = express.Router();
  // The Owner is the oldest administrator. They can never be deleted, so this never changes hands.
  const ownerId = async () => (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
  const mustBeOwner = async (req, res) => { if (req.subject.id === await ownerId()) return true; res.status(403).json({ error: 'Only the Owner administrator can do that.' }); return false; };
  const target = async (req, res, { notSelf = false, what = 'do that to' } = {}) => {
    const a = await db.get(`SELECT ${COLUMNS} FROM host_admins WHERE id = ?`, [req.params.id]);
    if (!a) { res.status(404).json({ error: 'Administrator not found.' }); return null; }
    if (notSelf && a.id === req.subject.id) { res.status(400).json({ error: `You cannot ${what} the account you are signed in with.` }); return null; }
    return a;
  };

  r.get('/', async (req, res) => { const owner = await ownerId(); res.json((await db.all(`SELECT ${COLUMNS} FROM host_admins ORDER BY created_at, id`)).map(a => ({ ...a, owner: a.id === owner }))); });

  r.post('/', async (req, res) => {
    if (!await mustBeOwner(req, res)) return;
    const username = String(req.body.username || '').trim().toLowerCase(), bad = passwordProblem(req.body.password);
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: 'Username: 3–40 letters, numbers, . _ -' });
    if (bad) return res.status(400).json({ error: bad });
    if (await db.get('SELECT id FROM host_admins WHERE username = ?', [username])) return res.status(400).json({ error: 'That username exists.' });
    await db.run('INSERT INTO host_admins (id, username, email, pw_hash, must_change, created_at) VALUES (?,?,?,?,1,?)', [newId(), username, req.body.email || null, hashPassword(req.body.password), Date.now()]);
    hostLog(req, 'info', 'admin.created', `Host administrator "${username}" created`, { data: { username } });
    res.json({ ok: true });
  });

  // Edit contact details: your own, or (Owner only) anyone's.
  r.put('/:id', async (req, res) => {
    const a = await target(req, res); if (!a) return;
    if (a.id !== req.subject.id && !await mustBeOwner(req, res)) return;
    const name = String(req.body.displayName ?? '').trim(), email = String(req.body.email ?? '').trim(), cell = String(req.body.cell ?? '').trim();
    if (name.length > 100) return res.status(400).json({ error: 'The name is too long (100 characters at most).' });
    if (email && (!EMAIL.test(email) || email.length > 200)) return res.status(400).json({ error: 'Enter a valid email address, or leave it empty.' });
    if (cell && !CELL.test(cell)) return res.status(400).json({ error: 'Enter a valid cell number (digits, spaces, + ( ) - .), or leave it empty.' });
    await db.run('UPDATE host_admins SET display_name = ?, email = ?, cell = ? WHERE id = ?', [name || null, email || null, cell || null, a.id]);
    hostLog(req, 'info', 'admin.updated', `Contact details updated for host administrator "${a.username}"`, { data: { username: a.username } });
    res.json({ ok: true });
  });

  // Owner only: clear another administrator's two-factor so they set it up again. Signs them out and tells them by email.
  r.post('/:id/reset-mfa', async (req, res) => {
    if (!await mustBeOwner(req, res)) return;
    const a = await target(req, res, { notSelf: true, what: 'reset two-factor for' }); if (!a) return;
    await db.run('UPDATE host_admins SET totp_enabled = 0, totp_secret = NULL, recovery_hashes = NULL WHERE id = ?', [a.id]);
    await destroyAllFor(db, 'host', a.id, 'two-factor reset by the Owner administrator');
    if (a.email) { await enqueueMail(db, a.email, 'mfa_reset', { name: a.display_name || a.username }); processQueue(db).catch(() => {}); }
    hostLog(req, 'warn', 'admin.mfa_reset', `Two-factor reset for host administrator "${a.username}"`, { data: { username: a.username } });
    res.json({ ok: true });
  });

  // Owner only: set a temporary password (shown once, never logged); they must change it at next sign-in.
  r.post('/:id/temp-password', async (req, res) => {
    if (!await mustBeOwner(req, res)) return;
    const a = await target(req, res, { notSelf: true, what: 'set a temporary password for' }); if (!a) return;
    const pw = token(9).replace(/[-_]/g, 'x') + '7';
    await db.run('UPDATE host_admins SET pw_hash = ?, must_change = 1 WHERE id = ?', [hashPassword(pw), a.id]);
    await destroyAllFor(db, 'host', a.id, 'temporary password set by the Owner administrator');
    hostLog(req, 'warn', 'admin.temp_password', `Temporary password set for host administrator "${a.username}"`, { data: { username: a.username } });
    res.json({ ok: true, tempPassword: pw });
  });

  // Owner only: end every open session of another administrator.
  r.post('/:id/sign-out', async (req, res) => {
    if (!await mustBeOwner(req, res)) return;
    const a = await target(req, res, { notSelf: true, what: 'sign out' }); if (!a) return;
    await destroyAllFor(db, 'host', a.id, 'signed out by the Owner administrator');
    hostLog(req, 'warn', 'admin.signed_out', `Host administrator "${a.username}" signed out everywhere`, { data: { username: a.username } });
    res.json({ ok: true });
  });

  // Owner only. Not yourself, and never the last one (that would lock everyone out).
  r.delete('/:id', async (req, res) => {
    if (!await mustBeOwner(req, res)) return;
    const a = await target(req, res, { notSelf: true, what: 'delete' }); if (!a) return;
    if (req.body?.confirm !== a.username) return res.status(400).json({ error: `Type ${a.username} to confirm.` });
    const n = await db.get('SELECT COUNT(*) AS n FROM host_admins'); if (Number(n.n) <= 1) return res.status(400).json({ error: 'At least one host administrator must remain.' });
    await db.tx(async (t) => {
      await t.run("DELETE FROM sessions WHERE realm = 'host' AND subject_id = ?", [a.id]);
      await t.run("DELETE FROM password_resets WHERE realm = 'host' AND subject_id = ?", [a.id]);
      await t.run('DELETE FROM admin_links WHERE admin_id = ?', [a.id]);
      await t.run('DELETE FROM host_admins WHERE id = ?', [a.id]);
    });
    hostLog(req, 'warn', 'admin.deleted', `Host administrator "${a.username}" deleted`, { data: { username: a.username } });
    res.json({ ok: true });
  });
  return r;
}
