// ROUTES / app / hostlink — an Administrator who is also a Host administrator can link the two, so each side offers a switch to the other.
// Linking proves the Host password (and two-factor code, if on) from inside the account. Nothing about the account's data is shared with the Host side.
import express from 'express';
import { verifyPassword, DUMMY_HASH } from '../../auth/password.mjs';
import { verifyTotp } from '../../auth/totp.mjs';
import { unseal } from '../../auth/secrets.mjs';
import { isLocked, registerFailure, clearFailures } from '../../auth/lockout.mjs';
import { newId } from '../../core/ids.mjs';
import { need, tenantLog } from './context.mjs';

export function hostLinkRoutes(db) {
  const r = express.Router();

  r.post('/', need('users.manage'), async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase(), pw = String(req.body.password || ''), code = String(req.body.code || '').replace(/\s/g, '');
    const key = 'host:' + username;
    if (isLocked(key)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
    const a = username ? await db.get('SELECT * FROM host_admins WHERE username = ?', [username]) : null;
    const ok = verifyPassword(pw, a?.pw_hash || DUMMY_HASH) && a && (!a.totp_enabled || (/^\d{6}$/.test(code) && verifyTotp(unseal(a.totp_secret), code)));
    if (!ok) {
      registerFailure(key, { ip: req.ip, realm: 'app' });
      tenantLog(req, 'hostlink.failed', `${req.subject.login} failed to link a Host administrator`, { username });
      return res.status(401).json({ error: a?.totp_enabled && !code ? 'Enter the two-factor code for that Host administrator.' : 'Those Host administrator details are not right.' });
    }
    clearFailures(key);
    await db.run('DELETE FROM admin_links WHERE user_id = ?', [req.subject.id]);
    await db.run('INSERT INTO admin_links (id, admin_id, user_id, created_at) VALUES (?,?,?,?)', [newId(), a.id, req.subject.id, Date.now()]);
    tenantLog(req, 'hostlink.linked', `${req.subject.login} linked to Host administrator "${a.username}"`, { admin: a.username });
    res.json({ ok: true, admin: a.username });
  });

  r.get('/', async (req, res) => {
    const l = await db.get('SELECT a.username FROM admin_links k JOIN host_admins a ON a.id = k.admin_id WHERE k.user_id = ?', [req.subject.id]);
    res.json({ linked: !!l, admin: l?.username || null });
  });

  r.delete('/', async (req, res) => {
    await db.run('DELETE FROM admin_links WHERE user_id = ?', [req.subject.id]);
    tenantLog(req, 'hostlink.removed', `${req.subject.login} removed the Host administrator link`, {});
    res.json({ ok: true });
  });
  return r;
}
