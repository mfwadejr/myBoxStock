// ROUTES / host / accounts — support tools for signed-up accounts.
// PRIVACY BOUNDARY: only identity & security columns are read. Never touch inventory_items or other business tables
// (the one exception is the write-only DELETE when an account is erased).
import express from 'express';
import { hostLog } from './context.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { hashPassword } from '../../auth/password.mjs';
import { destroyAllFor } from '../../auth/session.mjs';
import { token, sha256, newId } from '../../core/ids.mjs';
import { enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { siteUrl } from '../../services/site/index.mjs';
import { fail } from '../../core/messages.mjs';
import { billingState, DAY } from '../../services/billing/state.mjs';
import { sendConfirmation } from '../../services/verify/index.mjs';
import { eraseByHost, restoreClosing } from '../../services/accounts/closing.mjs';
import { termsOf } from '../../services/legal/index.mjs';
import { setPlan } from '../../services/billing/index.mjs';
import { isLocked, unlock } from '../../auth/lockout.mjs';
import { mailReady } from '../../services/mail/index.mjs';
import { listAccounts } from '../../services/accounts/list.mjs';
import { bulkRoutes } from './accounts-bulk.mjs';
import { isDemoAddress } from '../../services/demo/guard.mjs';

export function accountsRoutes(db) {
  const r = express.Router();
  const A = (req, level, event, message, a, data) => hostLog(req, level, event, message, { area: 'accounts', accountId: a?.id || null, data });
  const getAccount = (id) => db.get('SELECT id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_until, plan_note, plan_changed_at, created_at, last_activity, closing_at, closing_by, host_link_allowed, terms_version, terms_accepted_at, demo, demo_set FROM accounts WHERE id = ?', [id]);
  // Every support action needs a short reason; it goes in the log next to who did it (see "Support history").
  const reasonOf = (req, res) => { const t = String(req.body?.reason ?? req.body?.note ?? '').trim(); if (t.length < 3) { res.status(400).json({ error: 'Say why, in a few words, so the log explains it.', code: 'REASON_REQUIRED' }); return null; } return t.slice(0, 200); };
  const userOf = (req) => db.get('SELECT id, account_id, username, login, email, role FROM account_users WHERE id = ? AND account_id = ?', [req.params.uid, req.params.id]);

  // The account list, with the health signals a Host administrator can see (identity and security only, never business data). Search, filters, Needs attention and sorting: services/accounts/list.mjs.
  r.get('/', async (req, res) => res.json(await listAccounts(db, req.query)));
  r.use('/bulk', bulkRoutes(db));

  r.get('/:id', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    const users = await db.all('SELECT id, username, login, email, email_verified_at, role, disabled, totp_enabled, must_change, created_at, last_login FROM account_users WHERE account_id = ? ORDER BY created_at', [a.id]);
    const events = await db.all("SELECT ts, actor, event, message FROM event_log WHERE account_id = ? AND area IN ('auth','accounts') ORDER BY ts DESC LIMIT 25", [a.id]);
    const history = await db.all('SELECT ts, kind, from_plan, to_plan, actor, note FROM billing_events WHERE account_id = ? ORDER BY ts DESC LIMIT 25', [a.id]);
    // What the Host can know about stored data: whether it is encrypted and how many opaque records exist. Never what they contain.
    const enc = await db.get('SELECT confirmed_at FROM account_recovery WHERE account_id = ?', [a.id]);
    const n = await db.get('SELECT COUNT(*) AS n FROM records WHERE account_id = ?', [a.id]);
    const owner = (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
    // Support history: what Host administrators did on this account and why.
    const sup = await db.all("SELECT ts, actor, event, message, raw FROM event_log WHERE account_id = ? AND area = 'accounts' AND (event LIKE 'user.%' OR event LIKE 'account.%' OR event LIKE 'plan.%') ORDER BY ts DESC LIMIT 50", [a.id]);
    const support = sup.map(e => { let reason = ''; try { reason = JSON.parse(e.raw)?.data?.reason || ''; } catch {} return { ts: Number(e.ts), actor: e.actor, event: e.event, message: e.message, reason }; });
    const receipts = await db.all('SELECT id, ts, amount_cents, currency, method, reference, note, period_end, actor FROM billing_receipts WHERE account_id = ? ORDER BY ts DESC LIMIT 50', [a.id]);
    const lockedOf = (u) => isLocked(u.login) || isLocked('mfa:' + u.id);
    res.json({ mailReady: await mailReady(db), support, receipts: receipts.map(x => ({ ...x, ts: Number(x.ts), amount_cents: Number(x.amount_cents), period_end: x.period_end ? Number(x.period_end) : null })), account: { ...a, billing: billingState(a) }, terms: termsOf(a), isOwner: req.subject.id === owner, users: users.map(u => ({ ...u, locked: lockedOf(u) })), events, history, data: { encrypted: !!enc, recordCount: Number(n.n) } });
  });

  // Owner administrator only: let this account's Administrators link a Host administrator sign-in (the Host-link menu in the reseller app). Switching off also removes existing links.
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
    const reason = reasonOf(req, res); if (!reason) return;
    await db.run('UPDATE accounts SET status = ? WHERE id = ?', [status, a.id]);
    if (status === 'suspended') await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [a.id]);
    A(req, 'warn', `account.${status}`, `Account ${a.account_code} ${status === 'active' ? 'reactivated' : 'suspended (all sessions ended)'}: ${reason}`, a, { code: a.account_code, reason });
    res.json({ ok: true });
  });

  r.post('/:id/restore-closing', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    if (!a.closing_at) return fail(res, 400, 'NOT_CLOSING');
    await restoreClosing(db, a, { actor: req.subject.username }); A(req, 'warn', 'account.restored', `Account ${a.account_code} restored by a Host administrator (closing cancelled)`, a, { code: a.account_code });
    res.json({ ok: true });
  });
  r.delete('/:id', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    if (req.body.confirm !== a.account_code) return res.status(400).json({ error: `Type the Reseller ID (${a.account_code}) to confirm.` });
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    const m = await eraseByHost(db, a, { reason }); // write-only erase; nothing is read. Then one "account erased" email, which the delete never waits for.
    const why = m.sent ? '' : m.why, tail = reason ? ` (reason: ${reason})` : '';
    A(req, 'warn', 'account.deleted', `Account ${a.account_code} (${a.business_name}) permanently deleted${m.sent ? `, email queued to ${m.count} address${m.count === 1 ? '' : 'es'}` : `, email not sent: ${why}`}${tail}`, a, { code: a.account_code, reason, emailSent: !!m.sent, emailNotSentBecause: why });
    if (m.sent) m.done.then((r) => { if (!r.ok) A(req, 'warn', 'account.erase_email_failed', `Account ${a.account_code} deleted, email not sent: ${r.why}${tail}`, a, { code: a.account_code, reason, emailNotSentBecause: r.why }); });
    res.json({ ok: true, emailSent: !!m.sent, ...(why ? { emailNotSentBecause: why } : {}) });
  });

  // Change an account's plan: free (comped), trial (start or extend), or paid. Every change is kept in billing_events.
  r.post('/:id/plan', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    const note = reasonOf(req, res); if (!note) return;
    try {
      const b = await setPlan(db, a, { plan: req.body?.plan, days: req.body?.days, extend: !!req.body?.extend, until: req.body?.until, note, actor: req.subject.username });
      res.json({ ok: true, billing: b });
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not change the plan.' }); }
  });

  // A receipt record: money received outside the app (bank transfer, cash, invoice) written down against the account. Optionally also sets "paid through".
  r.post('/:id/receipts', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    const rawAmt = String(req.body.amount ?? '').replace(/[,\s$]/g, ''), amount = /^\d+(\.\d{1,2})?$/.test(rawAmt) ? Math.round(Number(rawAmt) * 100) : NaN, cur = String(req.body.currency || 'USD').trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10) return res.status(400).json({ error: 'Enter the amount received, for example 29.00.' });
    if (!/^[A-Z]{3}$/.test(cur)) return res.status(400).json({ error: 'Currency is a three-letter code such as USD.' });
    let periodEnd = null; if (req.body.paidThrough) { if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.paidThrough) || Number.isNaN(Date.parse(req.body.paidThrough))) return res.status(400).json({ error: 'Enter the paid-through date as YYYY-MM-DD.' }); periodEnd = Date.parse(req.body.paidThrough + 'T23:59:59Z'); }
    const id = newId();
    await db.run('INSERT INTO billing_receipts (id, account_id, ts, amount_cents, currency, method, reference, note, period_end, actor) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, a.id, Date.now(), amount, cur, String(req.body.method || '').slice(0, 40), String(req.body.reference || '').slice(0, 120), String(req.body.note || '').slice(0, 255), periodEnd, req.subject.username]);
    if (periodEnd && req.body.applyPlan) { try { await setPlan(db, a, { plan: 'paid', until: req.body.paidThrough, note: `Payment received${req.body.reference ? ' (' + String(req.body.reference).slice(0, 60) + ')' : ''}`, actor: req.subject.username }); } catch (e) { return res.status(e.status || 500).json({ error: e.message }); } }
    A(req, 'info', 'account.receipt_recorded', `Receipt of ${(amount / 100).toFixed(2)} ${cur} recorded for ${a.account_code}${periodEnd ? ` (paid through ${req.body.paidThrough})` : ''}`, a, { code: a.account_code, amount, currency: cur, reference: String(req.body.reference || '').slice(0, 120) });
    res.json({ ok: true, id });
  });
  r.delete('/:id/receipts/:rid', async (req, res) => {
    const a = await getAccount(req.params.id); if (!a) return fail(res, 404, 'NOT_FOUND');
    const reason = reasonOf(req, res); if (!reason) return;
    await db.run('DELETE FROM billing_receipts WHERE id = ? AND account_id = ?', [req.params.rid, a.id]);
    A(req, 'warn', 'account.receipt_removed', `A receipt record was removed from ${a.account_code}: ${reason}`, a, { code: a.account_code, reason }); res.json({ ok: true });
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
    if (isDemoAddress(u.email)) return fail(res, 400, 'DEMO_MAIL_BLOCKED');   // demo accounts never send email
    const reason = reasonOf(req, res); if (!reason) return;
    const raw = token(32);
    await db.run('INSERT INTO password_resets (token_hash, realm, subject_id, expires_at, used) VALUES (?,?,?,?,0)', [sha256(raw), 'app', u.id, Date.now() + 3600e3]);
    await enqueueMail(db, u.email, 'password_reset', { name: u.username, username: u.username, accountCode: (await db.get('SELECT account_code FROM accounts WHERE id = ?', [u.account_id]))?.account_code || '', link: `${await siteUrl(db)}/app/#/reset/${raw}` }); processQueue(db).catch(() => {});
    A(req, 'info', 'user.reset_link_sent', `Password reset link emailed to ${u.login}: ${reason}`, { id: u.account_id }, { login: u.login, reason });
    res.json({ ok: true });
  });
  r.post('/:id/users/:uid/verify-resend', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    if (!u.email) return res.status(400).json({ error: 'This user has no email address on file.' });
    if (isDemoAddress(u.email)) return fail(res, 400, 'DEMO_MAIL_BLOCKED');
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
    const reason = reasonOf(req, res); if (!reason) return;
    const pw = token(9).replace(/[-_]/g, 'x') + '7';
    await db.run('UPDATE account_users SET pw_hash = ?, must_change = 1 WHERE id = ?', [hashPassword(pw), u.id]);
    await destroyAllFor(db, 'app', u.id, 'temporary password set by host admin');
    A(req, 'warn', 'user.temp_password', `Temporary password set for ${u.login}: ${reason}`, { id: u.account_id }, { login: u.login, reason });
    res.json({ ok: true, tempPassword: pw }); // shown once to the host admin, never logged
  });
  r.post('/:id/users/:uid/reset-mfa', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const reason = reasonOf(req, res); if (!reason) return;
    await db.run('UPDATE account_users SET totp_enabled = 0, totp_secret = NULL, recovery_hashes = NULL WHERE id = ?', [u.id]);
    await destroyAllFor(db, 'app', u.id, 'two-factor reset by host admin');
    if (u.email) { await enqueueMail(db, u.email, 'mfa_reset', { name: u.username }); processQueue(db).catch(() => {}); }
    A(req, 'warn', 'user.mfa_reset', `Two-factor reset for ${u.login}: ${reason}`, { id: u.account_id }, { login: u.login, reason });
    res.json({ ok: true });
  });
  // Let a locked-out person try again now (clears the lockout and failed-attempt counter for the sign-in and for two-factor codes). Never touches a password.
  r.post('/:id/users/:uid/unlock', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const reason = reasonOf(req, res); if (!reason) return;
    const o = { actor: req.subject.username, ip: normalizeIp(req.ip), accountId: u.account_id, reason };
    const a = unlock(u.login, o), b = unlock('mfa:' + u.id, o);
    if (!a && !b) return fail(res, 400, 'NOT_LOCKED');
    res.json({ ok: true });
  });
  r.post('/:id/users/:uid/sign-out', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const reason = reasonOf(req, res); if (!reason) return;
    await destroyAllFor(db, 'app', u.id, 'signed out everywhere by host admin');
    A(req, 'warn', 'user.signed_out', `${u.login} signed out everywhere: ${reason}`, { id: u.account_id }, { login: u.login, reason }); res.json({ ok: true });
  });
  r.post('/:id/users/:uid/disabled', async (req, res) => {
    const u = await userOf(req); if (!u) return fail(res, 404, 'NOT_FOUND');
    const off = !!req.body.disabled; const reason = reasonOf(req, res); if (!reason) return;
    await db.run('UPDATE account_users SET disabled = ? WHERE id = ?', [off ? 1 : 0, u.id]);
    if (off) await destroyAllFor(db, 'app', u.id, 'user disabled by host admin');
    A(req, 'warn', off ? 'user.disabled' : 'user.enabled', `Sign-in ${off ? 'disabled' : 'enabled'} for ${u.login}: ${reason}`, { id: u.account_id }, { login: u.login, reason });
    res.json({ ok: true });
  });
  return r;
}
