// AUTH / router / password — POST /change-password
import { hashPassword, verifyPassword, passwordProblem } from '../password.mjs';
import { requireSession } from '../session.mjs';

export function passwordRoutes(r, c) {
  const { db, realm, table } = c;
  r.post('/change-password', requireSession(db, realm, c.loadSubject, { allowMustChange: true }), async (req, res) => {
    const { current, next } = req.body, user = req.subject;
    if (!verifyPassword(String(current || ''), user.pw_hash)) { c.log.warn('password.change_failed', `Wrong current password while changing password: ${c.who(user).actor}`, req, user, { realm }); return res.status(400).json({ error: 'Current password is incorrect.' }); }
    const bad = passwordProblem(next); if (bad) return res.status(400).json({ error: bad });
    await db.run(`UPDATE ${table} SET pw_hash = ?, must_change = 0 WHERE id = ?`, [hashPassword(next), user.id]);
    const gone = await db.run('DELETE FROM sessions WHERE realm = ? AND subject_id = ? AND token_hash <> ?', [realm, user.id, req.session.token_hash]);
    c.log.info('password.changed', `Password changed by ${c.who(user).actor} (${gone.changes} other session(s) signed out)`, req, user, { realm });
    res.json({ ok: true });
  });
}
