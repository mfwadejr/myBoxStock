// AUTH / router / mfa — POST /login/mfa (second step of sign-in)
import { fail } from '../../core/messages.mjs';
import { verifyTotp } from '../totp.mjs';
import { unseal } from '../secrets.mjs';
import { sha256 } from '../../core/ids.mjs';
import { requireSession, promoteSession } from '../session.mjs';
import { isLocked, registerFailure, clearFailures } from '../lockout.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';

const L = areaLogger('auth');

export function mfaRoutes(r, c) {
  const { db, realm, table } = c;
  r.post('/login/mfa', requireSession(db, realm, c.loadSubject, { allowPending: true, allowMustChange: true }), async (req, res) => {
    const { subject: user, session } = req, ip = normalizeIp(req.ip);
    if (!session.mfa_pending) return res.json({ ok: true });
    const key = 'mfa:' + user.id;
    if (isLocked(key)) { L.warn('mfa.locked_out', `Two-factor attempt while locked: ${c.who(user).actor}`, { ...c.who(user), ip, data: { realm } }); return fail(res, 429, 'MFA_LOCKED'); }
    const code = String(req.body.code || '').trim().toLowerCase();
    let good = false, via = 'totp';
    if (/^\d{6}$/.test(code.replace(/\s/g, ''))) good = verifyTotp(unseal(user.totp_secret), code);
    else if (code) {
      const hashes = JSON.parse(user.recovery_hashes || '[]'), i = hashes.indexOf(sha256(code));
      if (i >= 0) { hashes.splice(i, 1); await db.run(`UPDATE ${table} SET recovery_hashes = ? WHERE id = ?`, [JSON.stringify(hashes), user.id]); good = true; via = 'recovery code'; }
    }
    if (!good) {
      const f = registerFailure(key, { ip, realm, accountId: user.account_id });
      L.warn('mfa.failed', `Wrong two-factor code for ${c.who(user).actor}`, { ...c.who(user), ip, data: { realm, recentFailures: f.n } });
      c.record?.({ user, ip, ua: req.headers['user-agent'], result: 'code_failed' });
      return res.status(401).json({ error: 'That code is not valid.' });
    }
    clearFailures(key);
    await promoteSession(db, req, res, realm);
    await db.run(`UPDATE ${table} SET last_login = ? WHERE id = ?`, [Date.now(), user.id]);
    await c.record?.({ user, ip, ua: req.headers['user-agent'], result: 'signed_in' });
    if (via === 'recovery code') c.log.warn('mfa.recovery_used', `Recovery code used by ${c.who(user).actor} (${JSON.parse(user.recovery_hashes || '[]').length - 1} left)`, req, user, { realm });
    c.log.info('login.ok', `Signed in with two-factor (${via}): ${c.who(user).actor}`, req, user, { realm, via });
    res.json({ ok: true, csrf: session.csrf, mustChange: !!user.must_change });
  });
}
