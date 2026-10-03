// AUTH / router / totp-routes — POST /totp/setup, /totp/enable, /totp/disable
import { fail } from '../../core/messages.mjs';
import { verifyPassword } from '../password.mjs';
import { verifyTotp, newTotpSecret, otpauthUri, newRecoveryCodes } from '../totp.mjs';
import { seal, unseal } from '../secrets.mjs';
import { requireSession } from '../session.mjs';

export function totpRoutes(r, c) {
  const { db, realm, table } = c;
  const need = requireSession(db, realm, c.loadSubject, { allowMustChange: true });

  r.post('/totp/setup', need, async (req, res) => {
    const user = req.subject; if (user.totp_enabled) return res.status(400).json({ error: 'Two-factor is already on.' });
    const secret = newTotpSecret();
    await db.run(`UPDATE ${table} SET totp_secret = ? WHERE id = ?`, [seal(secret), user.id]);
    c.log.info('mfa.setup_started', `Two-factor setup started by ${c.who(user).actor}`, req, user, { realm });
    res.json({ secret, uri: otpauthUri(secret, c.publicUser(user).label) });
  });
  r.post('/totp/enable', need, async (req, res) => {
    const user = req.subject; if (!user.totp_secret) return fail(res, 400, 'TOTP_SETUP_FIRST');
    if (!verifyTotp(unseal(user.totp_secret), req.body.code)) { c.log.warn('mfa.enable_failed', `Wrong code while enabling two-factor: ${c.who(user).actor}`, req, user, { realm }); return res.status(400).json({ error: 'That code did not match. Check your device clock and try again.' }); }
    const rc = newRecoveryCodes();
    await db.run(`UPDATE ${table} SET totp_enabled = 1, recovery_hashes = ? WHERE id = ?`, [JSON.stringify(rc.hashes), user.id]);
    c.log.info('mfa.enabled', `Two-factor turned on by ${c.who(user).actor}`, req, user, { realm });
    res.json({ ok: true, recoveryCodes: rc.plain });
  });
  r.post('/totp/disable', need, async (req, res) => {
    const user = req.subject;
    if (!verifyPassword(String(req.body.password || ''), user.pw_hash) || (user.totp_enabled && !verifyTotp(unseal(user.totp_secret), req.body.code))) {
      c.log.warn('mfa.disable_failed', `Wrong password or code while turning off two-factor: ${c.who(user).actor}`, req, user, { realm });
      return res.status(400).json({ error: 'Password or code is not valid.' });
    }
    await db.run(`UPDATE ${table} SET totp_enabled = 0, totp_secret = NULL, recovery_hashes = NULL WHERE id = ?`, [user.id]);
    c.log.warn('mfa.disabled', `Two-factor turned off by ${c.who(user).actor}`, req, user, { realm });
    res.json({ ok: true });
  });
}
