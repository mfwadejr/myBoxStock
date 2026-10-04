// AUTH / router / login — POST /login, POST /logout, GET /me
import { verifyPassword, DUMMY_HASH } from '../password.mjs';
import { createSession, destroySession, readSession } from '../session.mjs';
import { isLocked, registerFailure, clearFailures } from '../lockout.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { fail } from '../../core/messages.mjs';

const L = areaLogger('auth');

export function loginRoutes(r, c) {
  const { db, realm, table } = c;

  r.post('/login', async (req, res) => {
    const clean = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    // Two boxes (Reseller ID + username) or the older single "username@id" box: both end up as the same sign-in name.
    const login = req.body.resellerId !== undefined ? (req.body.username && req.body.resellerId ? `${clean(req.body.username)}@${clean(req.body.resellerId)}` : '') : String(req.body.login || '').trim().toLowerCase(), pw = String(req.body.password || ''), ip = normalizeIp(req.ip);
    if (!login || !pw) return fail(res, 400, 'LOGIN_MISSING_FIELDS');
    if (isLocked(login)) {
      L.warn('login.locked_out', `Sign-in attempt for locked identity "${login}"`, { actor: login, ip, data: { realm } });
      return fail(res, 429, 'LOGIN_LOCKED');
    }
    const user = await c.findByLogin(db, login);
    const ok = verifyPassword(pw, user?.pw_hash || DUMMY_HASH); // always hash, so timing doesn't reveal if the account exists
    if (!user || !ok) { // wrong password or unknown user: same answer either way, so the form cannot be used to find accounts
      const reason = !user ? 'no such user' : 'wrong password';
      const f = registerFailure(login, { ip, realm, accountId: user?.account_id });
      L.warn('login.failed', `Failed sign-in for "${login}" — ${reason}`, { actor: login, accountId: user?.account_id || null, ip, data: { realm, reason, recentFailures: f.n } });
      if (user) c.record?.({ user, ip, ua: req.headers['user-agent'], result: 'wrong_password' });
      return fail(res, 401, 'LOGIN_INVALID');
    }
    // The password is right, so it is safe to say exactly why sign-in is refused. Not counted as a failed attempt.
    const blocked = user.blockedReason || (user.disabled ? 'USER_DISABLED' : null);
    if (blocked) {
      const why = blocked === 'ACCOUNT_SUSPENDED' ? 'the account is suspended' : 'the user is disabled';
      L.warn('login.blocked', `Sign-in refused for "${login}" — correct password, but ${why}`, { actor: login, accountId: user.account_id || null, ip, data: { realm, reason: blocked } });
      c.record?.({ user, ip, ua: req.headers['user-agent'], result: 'blocked', reason: blocked });
      return fail(res, 403, blocked);
    }
    clearFailures(login);
    const pending = !!user.totp_enabled;
    const csrf = await createSession(db, res, req, { realm, subjectId: user.id, accountId: user.account_id || null, pending });
    if (!pending) { await db.run(`UPDATE ${table} SET last_login = ? WHERE id = ?`, [Date.now(), user.id]); await c.record?.({ user, ip, ua: req.headers['user-agent'], result: 'signed_in' }); c.log.info('login.ok', `Signed in: ${c.who(user).actor}`, req, user, { realm }); }
    else c.log.info('login.password_ok', `Password accepted for ${c.who(user).actor}; two-factor code required`, req, user, { realm });
    res.json({ ok: true, mfa: pending, csrf, mustChange: !!user.must_change });
  });

  r.post('/logout', async (req, res) => {
    const s = await readSession(db, req, realm);
    await destroySession(db, req, res, realm);
    if (s) L.info('logout', `Signed out (${realm})`, { ip: normalizeIp(req.ip), accountId: s.account_id, data: { realm, subjectId: s.subject_id } });
    res.json({ ok: true });
  });

  r.get('/me', async (req, res) => {
    const s = await readSession(db, req, realm);
    const user = s && await c.loadSubject(db, s);
    if (!user) return fail(res, 401, 'NOT_SIGNED_IN');
    res.json({ user: c.publicUser(user), csrf: s.csrf, mfaPending: !!s.mfa_pending, mustChange: !!user.must_change, ...(c.meExtra ? { vault: await c.meExtra(db, user) } : {}) });
  });
}
