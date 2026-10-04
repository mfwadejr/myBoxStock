// ROUTES / app / public — unauthenticated endpoints: site config, sign-up, forgot / reset password.
import express from 'express';
import { log } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { hashPassword, passwordProblem } from '../../auth/password.mjs';
import { newId, newResellerId, token, sha256 } from '../../core/ids.mjs';
import { enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { getSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { DEFAULT_ROLES } from './context.mjs';
import { trialDays, recordEvent } from '../../services/billing/index.mjs';
import { dropKeys } from '../../services/vault/keys.mjs';
import { sendConfirmation, confirmWith, isHeld } from '../../services/verify/index.mjs';
import { DAY } from '../../services/billing/state.mjs';

export function publicRoutes(db) {
  const r = express.Router();
  const loginOf = (username, code) => `${username.toLowerCase()}@${code.toLowerCase()}`;

  r.get('/public-config', async (req, res) => res.json({ signupsEnabled: await getSetting(db, 'signups_enabled', true), trialDays: await trialDays(db) }));

  r.post('/signup', async (req, res) => {
    const ip = normalizeIp(req.ip);
    if (!(await getSetting(db, 'signups_enabled', true))) { log('tenant', 'info', 'signup.closed', 'Sign-up attempt while sign-ups are closed', { ip }); return res.status(403).json({ error: 'Sign-ups are closed right now.' }); }
    const { businessName, email, username, password } = req.body;
    if (!businessName?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) return res.status(400).json({ error: 'Enter a business name and a valid email.' });
    if (!/^[a-z0-9._-]{3,30}$/i.test(username || '')) return res.status(400).json({ error: 'Username: 3–30 letters, numbers, . _ -' });
    const bad = passwordProblem(password); if (bad) return res.status(400).json({ error: bad });
    const accountId = newId(), userId = newId(), now = Date.now(), days = await trialDays(db), trialEnds = now + days * DAY;
    let code = newResellerId(); while (await db.get('SELECT id FROM accounts WHERE LOWER(account_code) = ?', [code])) code = newResellerId();
    const login = loginOf(username, code);
    await db.tx(async (t) => {
      await t.run('INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_changed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [accountId, code, businessName.trim().slice(0, 150), email.trim().slice(0, 200), 'active', 'trial', trialEnds, now, now]);
      await recordEvent(t, { accountId, kind: 'trial_started', to: 'trial', actor: 'system', note: `Free trial of ${days} days`, detail: { trialEnds, days } });
      for (const [name, perms] of Object.entries(DEFAULT_ROLES)) await t.run('INSERT INTO account_roles (id, account_id, name, perms, builtin) VALUES (?,?,?,?,1)', [newId(), accountId, name, JSON.stringify(perms)]);
      await t.run('INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, created_at) VALUES (?,?,?,?,?,?,?,?)', [userId, accountId, login, username.toLowerCase(), email.trim(), 'Administrator', hashPassword(password), now]);
    });
    log('tenant', 'info', 'account.created', `New account (Reseller ID ${code}) created by ${login} with a ${days}-day free trial`, { actor: login, accountId, ip, data: { code, trialDays: days } });
    log('accounts', 'info', 'trial.started', `Account ${code} signed up — ${days}-day free trial until ${new Date(trialEnds).toISOString().slice(0, 10)}`, { actor: 'system', accountId, ip, data: { code, trialDays: days, trialEnds } });
    await enqueueMail(db, email.trim(), 'welcome', { name: username, accountCode: code, username: username.toLowerCase(), login, url: `${config.publicUrl}/app/`, trialLine: `Your free trial runs for ${days} days (until ${new Date(trialEnds).toISOString().slice(0, 10)}).` }); processQueue(db).catch(() => {});
    await sendConfirmation(db, { id: userId, username: username.toLowerCase(), login, account_id: accountId, email: email.trim() }, email.trim(), { accountCode: code, ip });
    res.json({ ok: true, accountCode: code, resellerId: code, username: username.toLowerCase(), login, trialDays: days });
  });

  // Always answers the same way so it can't be used to discover which accounts exist; the log records the truth.
  // Sent by email address: one message lists a reset link for every reseller account that uses that mailbox.
  // (The older "username@id" form is still accepted and sends a link for that one account.)
  const resetLink = async (u) => { const raw = token(32); await db.run('INSERT INTO password_resets (token_hash, realm, subject_id, expires_at, used) VALUES (?,?,?,?,0)', [sha256(raw), 'app', u.id, Date.now() + 3600e3]); return `${config.publicUrl}/app/#/reset/${raw}`; };
  r.post('/forgot', async (req, res) => {
    const ip = normalizeIp(req.ip), who = String(req.body.email || req.body.login || '').trim().toLowerCase();
    const cols = 'u.id, u.account_id, u.username, u.email, u.email_verified_at, u.created_at, u.disabled, a.business_name, a.account_code', from = 'FROM account_users u JOIN accounts a ON a.id = u.account_id';
    const rows = !who ? [] : req.body.email
      ? await db.all(`SELECT ${cols} ${from} WHERE LOWER(u.email) = ? AND a.status = 'active' ORDER BY a.business_name`, [who])
      : await db.all(`SELECT ${cols} ${from} WHERE u.login = ? AND a.status = 'active'`, [who]);
    const held = []; for (const u of rows) if (u.email && !u.disabled && await isHeld(db, u)) held.push(u.id);
    const usable = rows.filter(u => u.email && !u.disabled && !held.includes(u.id));
    if (held.length) log('auth', 'warn', 'reset.held', `Password reset by email held back for ${held.length} account(s): the email address is not confirmed yet`, { actor: who, ip, data: { realm: 'app' } });
    if (usable.length) {
      const items = []; for (const u of usable) items.push({ u, link: await resetLink(u) });
      const to = usable[0].email;
      if (items.length === 1) await enqueueMail(db, to, 'password_reset', { name: items[0].u.username, username: items[0].u.username, accountCode: items[0].u.account_code, link: items[0].link });
      else await enqueueMail(db, to, 'password_reset_multi', { name: items[0].u.username, accounts: items.map(({ u, link }) => `${u.business_name} — Reseller ID: ${u.account_code}, username: ${u.username}\n${link}`).join('\n\n') });
      processQueue(db).catch(() => {});
      log('auth', 'info', 'reset.requested', `Password reset link sent for ${usable.length} account(s) on one mailbox`, { actor: who, accountId: usable[0].account_id, ip, data: { realm: 'app', accounts: usable.map(u => u.account_code) } });
    } else log('auth', 'warn', 'reset.ignored', `Password reset requested for "${who}" — ${!rows.length ? 'no such user' : 'no email on file or user disabled'}`, { actor: who, ip, data: { realm: 'app' } });
    res.json({ ok: true });
  });
  r.post('/confirm-email', async (req, res) => {
    const row = await confirmWith(db, req.body.token);
    if (!row) { log('auth', 'warn', 'email.confirm_invalid', 'Invalid or expired email confirmation link used', { ip: normalizeIp(req.ip) }); return res.status(400).json({ error: 'This confirmation link has expired. Sign in and ask for a new one.' }); }
    log('auth', 'info', 'email.confirmed', 'Email address confirmed from an emailed link', { ip: normalizeIp(req.ip), data: { userId: row.user_id } });
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
      await dropKeys(t, row.subject_id); // the old key was wrapped under the old password; access comes back with the recovery key or an Administrator
    });
    log('auth', 'info', 'reset.completed', 'Password reset completed from an emailed link (all sessions ended)', { ip, data: { realm: 'app', subjectId: row.subject_id } });
    res.json({ ok: true });
  });
  return r;
}
