// SERVICES / verify — soft email confirmation. The account works straight away; confirming the address unlocks email-based actions
// (password reset by email, inviting teammates). Does nothing when outbound email is not set up, and never locks out older accounts.
import { newId, token, sha256 } from '../../core/ids.mjs';
import { config } from '../../core/config.mjs';
import { getMailSettings } from '../mail/index.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { areaLogger } from '../../logging/logger.mjs';

const L = areaLogger('accounts');
export const VALID_MS = 24 * 3600e3, RESEND_GAP_MS = 60e3, RESEND_PER_DAY = 5;

export const mailReady = async (db) => { const m = await getMailSettings(db); return !!(m.enabled && m.fromAddress); };
export const isVerified = (u) => !!u.email_verified_at;
// Only people who joined after confirmation was introduced are held back (migration 9 marks everyone earlier as grandfathered); they still see the banner.
export async function isHeld(db, u) {
  if (isVerified(u) || !u.email || u.email_grandfathered) return false;
  return mailReady(db);
}

// Sends the confirmation email for `email` (the user's current address, or a new one they asked to switch to).
export async function sendConfirmation(db, u, email, { accountCode, ip } = {}) {
  if (!await mailReady(db)) return { sent: false, reason: 'mail_off' };
  const recent = await db.all('SELECT created_at FROM email_confirmations WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC', [u.id, Date.now() - 24 * 3600e3]);
  if (recent.length && Date.now() - Number(recent[0].created_at) < RESEND_GAP_MS) return { sent: false, reason: 'too_soon' };
  if (recent.length >= RESEND_PER_DAY) return { sent: false, reason: 'daily_limit' };
  const raw = token(32);
  await db.run('INSERT INTO email_confirmations (token_hash, user_id, email, expires_at, used, created_at) VALUES (?,?,?,?,0,?)', [sha256(raw), u.id, email, Date.now() + VALID_MS, Date.now()]);
  await enqueueMail(db, email, 'confirm_email', { name: u.username, accountCode: accountCode || '', link: `${config.publicUrl}/app/#/confirm/${raw}` }); processQueue(db).catch(() => {});
  L.info('email.confirmation_sent', `Confirmation email sent to ${email} for ${u.login || u.username}`, { actor: u.login || u.username, accountId: u.account_id, ip, data: { change: email !== u.email } });
  return { sent: true };
}

export async function confirmWith(db, rawToken) {
  const row = await db.get('SELECT * FROM email_confirmations WHERE token_hash = ?', [sha256(String(rawToken || ''))]);
  if (!row || row.used || Number(row.expires_at) < Date.now()) return null;
  await db.tx(async (t) => {
    await t.run('UPDATE email_confirmations SET used = 1 WHERE token_hash = ?', [row.token_hash]);
    await t.run('UPDATE account_users SET email = ?, email_verified_at = ? WHERE id = ?', [row.email, Date.now(), row.user_id]);
  });
  return row;
}
