// AUTH / router / login — POST /login, POST /logout, GET /me
import { verifyPassword, DUMMY_HASH } from '../password.mjs';
import { createSession, destroySession, readSession } from '../session.mjs';
import { isLocked, registerFailure, clearFailures } from '../lockout.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';

const L = areaLogger('auth');

export function loginRoutes(r, c) {
  const { db, realm, table } = c;

  r.post('/login', async (req, res) => {
    const login = String(req.body.login || '').trim().toLowerCase(), pw = String(req.body.password || ''), ip = normalizeIp(req.ip);
    if (!login || !pw) return res.status(400).json({ error: 'Enter your sign-in and password.' });
    if (isLocked(login)) {
      L.warn('login.locked_out', `Sign-in attempt for locked identity "${login}"`, { actor: login, ip, data: { realm } });
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    const user = await c.findByLogin(db, login);
    const ok = verifyPassword(pw, user?.pw_hash || DUMMY_HASH); // always hash, so timing doesn't reveal if the account exists
    if (!user || !ok || user.disabled) {
      const reason = !user ? 'no such user' : !ok ? 'wrong password' : 'account or user disabled/suspended';
      const f = registerFailure(login, { ip, realm, accountId: user?.account_id });
      L.warn('login.failed', `Failed sign-in for "${login}" — ${reason}`, { actor: login, accountId: user?.account_id || null, ip, data: { realm, reason, recentFailures: f.n } });
      return res.status(401).json({ error: 'Incorrect sign-in or password.' });
    }
    clearFailures(login);
    const pending = !!user.totp_enabled;
    const csrf = await createSession(db, res, req, { realm, subjectId: user.id, accountId: user.account_id || null, pending });
    if (!pending) { await db.run(`UPDATE ${table} SET last_login = ? WHERE id = ?`, [Date.now(), user.id]); c.log.info('login.ok', `Signed in: ${c.who(user).actor}`, req, user, { realm }); }
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
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    res.json({ user: c.publicUser(user), csrf: s.csrf, mfaPending: !!s.mfa_pending, mustChange: !!user.must_change });
  });
}
