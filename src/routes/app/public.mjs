// ROUTES / app / public — unauthenticated endpoints: site config, sign-up, forgot / reset password.
import express from 'express';
import { log } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { hashPassword, passwordProblem } from '../../auth/password.mjs';
import { newId, newAccountCode, token, sha256 } from '../../core/ids.mjs';
import { enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { getSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { DEFAULT_ROLES } from './context.mjs';

export function publicRoutes(db) {
  const r = express.Router();
  const loginOf = (username, code) => `${username.toLowerCase()}@${code.toLowerCase()}`;

  r.get('/public-config', async (req, res) => res.json({ siteName: await getSetting(db, 'site_name', 'myBoxStock'), signupsEnabled: await getSetting(db, 'signups_enabled', true) }));

  r.post('/signup', async (req, res) => {
    const ip = normalizeIp(req.ip);
    if (!(await getSetting(db, 'signups_enabled', true))) { log('tenant', 'info', 'signup.closed', 'Sign-up attempt while sign-ups are closed', { ip }); return res.status(403).json({ error: 'Sign-ups are closed right now.' }); }
    const { businessName, email, username, password } = req.body;
    if (!businessName?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) return res.status(400).json({ error: 'Enter a business name and a valid email.' });
    if (!/^[a-z0-9._-]{3,30}$/i.test(username || '')) return res.status(400).json({ error: 'Username: 3–30 letters, numbers, . _ -' });
    const bad = passwordProblem(password); if (bad) return res.status(400).json({ error: bad });
    const accountId = newId(), userId = newId(), now = Date.now();
    let code = newAccountCode(); while (await db.get('SELECT id FROM accounts WHERE account_code = ?', [code])) code = newAccountCode();
    const login = loginOf(username, code);
    await db.tx(async (t) => {
      await t.run('INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at) VALUES (?,?,?,?,?,?,?)', [accountId, code, businessName.trim().slice(0, 150), email.trim().slice(0, 200), 'active', 'free', now]);
      for (const [name, perms] of Object.entries(DEFAULT_ROLES)) await t.run('INSERT INTO account_roles (id, account_id, name, perms, builtin) VALUES (?,?,?,?,1)', [newId(), accountId, name, JSON.stringify(perms)]);
      await t.run('INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, created_at) VALUES (?,?,?,?,?,?,?,?)', [userId, accountId, login, username.toLowerCase(), email.trim(), 'Administrator', hashPassword(password), now]);
    });
    log('tenant', 'info', 'account.created', `New account ${code} created by ${login}`, { actor: login, accountId, ip, data: { code } });
    await enqueueMail(db, email.trim(), 'welcome', { name: username, accountCode: code, login, url: `${config.publicUrl}/app/` }); processQueue(db).catch(() => {});
    res.json({ ok: true, accountCode: code, login });
  });

  // Always answers the same way so it can't be used to discover which accounts exist; the log records the truth.
  r.post('/forgot', async (req, res) => {
    const login = String(req.body.login || '').trim().toLowerCase(), ip = normalizeIp(req.ip);
    const u = login && await db.get('SELECT id, account_id, username, email, disabled FROM account_users WHERE login = ?', [login]);
    if (u && u.email && !u.disabled) {
      const raw = token(32);
      await db.run('INSERT INTO password_resets (token_hash, realm, subject_id, expires_at, used) VALUES (?,?,?,?,0)', [sha256(raw), 'app', u.id, Date.now() + 3600e3]);
      await enqueueMail(db, u.email, 'password_reset', { name: u.username, link: `${config.publicUrl}/app/#/reset/${raw}` }); processQueue(db).catch(() => {});
      log('auth', 'info', 'reset.requested', `Password reset link sent for ${login}`, { actor: login, accountId: u.account_id, ip, data: { realm: 'app' } });
    } else log('auth', 'warn', 'reset.ignored', `Password reset requested for "${login}" — ${!u ? 'no such user' : !u.email ? 'no email on file' : 'user disabled'}`, { actor: login, ip, data: { realm: 'app' } });
    res.json({ ok: true });
  });
  r.post('/reset', async (req, res) => {
    const ip = normalizeIp(req.ip), bad = passwordProblem(req.body.password); if (bad) return res.status(400).json({ error: bad });
    const row = await db.get('SELECT * FROM password_resets WHERE token_hash = ?', [sha256(String(req.body.token || ''))]);
    if (!row || row.used || row.expires_at < Date.now()) { log('auth', 'warn', 'reset.invalid', `Invalid or expired password reset link used (${!row ? 'unknown' : row.used ? 'already used' : 'expired'})`, { ip }); return res.status(400).json({ error: 'This reset link has expired. Request a new one.' }); }
    await db.tx(async (t) => {
      await t.run('UPDATE password_resets SET used = 1 WHERE token_hash = ?', [row.token_hash]);
      await t.run('UPDATE account_users SET pw_hash = ?, must_change = 0 WHERE id = ?', [hashPassword(req.body.password), row.subject_id]);
      await t.run("DELETE FROM sessions WHERE realm = 'app' AND subject_id = ?", [row.subject_id]);
    });
    log('auth', 'info', 'reset.completed', 'Password reset completed from an emailed link (all sessions ended)', { ip, data: { realm: 'app', subjectId: row.subject_id } });
    res.json({ ok: true });
  });
  return r;
}
