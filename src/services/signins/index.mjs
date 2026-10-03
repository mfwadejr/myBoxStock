// SERVICES / signins — per-account sign-in history (who signed in, from which IP and device) and the new-location email.
// Lives in the tenant tables: only that account's own people can read it. Retention is a Host setting (days).
import { newId } from '../../core/ids.mjs';
import { getSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { describeDevice } from './device.mjs';

const L = areaLogger('auth');
export const DEFAULT_HISTORY_DAYS = 90;
const GROUP_MS = 10 * 60e3; // repeated failures from one address are grouped into one row for 10 minutes

export async function historyDays(db) {
  const n = Number(await getSetting(db, 'sign_in_history_days', DEFAULT_HISTORY_DAYS));
  return Number.isInteger(n) && n >= 7 && n <= 730 ? n : DEFAULT_HISTORY_DAYS;
}

// result: signed_in | wrong_password | code_failed | blocked.  Never throws: sign-in must not fail because history could not be written.
export async function recordSignIn(db, { user, ip, ua, result, reason = null }) {
  try {
    if (!user?.id || !user.account_id) return;
    const now = Date.now(), device = describeDevice(ua);
    if (result === 'wrong_password' || result === 'code_failed') {
      const row = await db.get('SELECT id, attempts FROM sign_in_history WHERE user_id = ? AND ip = ? AND result = ? AND ts > ?', [user.id, ip, result, now - GROUP_MS]);
      if (row) { await db.run('UPDATE sign_in_history SET attempts = ?, ts = ? WHERE id = ?', [Number(row.attempts) + 1, now, row.id]); return; }
    }
    let newIp = 0;
    if (result === 'signed_in') {
      const any = await db.get("SELECT COUNT(*) AS n FROM sign_in_history WHERE user_id = ? AND result = 'signed_in'", [user.id]);
      const same = await db.get("SELECT COUNT(*) AS n FROM sign_in_history WHERE user_id = ? AND result = 'signed_in' AND ip = ?", [user.id, ip]);
      newIp = Number(any.n) > 0 && Number(same.n) === 0 ? 1 : 0;
    }
    await db.run('INSERT INTO sign_in_history (id, account_id, user_id, login, ts, result, reason, ip, device, new_ip, attempts) VALUES (?,?,?,?,?,?,?,?,?,?,1)',
      [newId(), user.account_id, user.id, user.login, now, result, reason, ip, device, newIp]);
    if (newIp && user.email) {
      await enqueueMail(db, user.email, 'new_sign_in', { name: user.username, ip, device, time: new Date(now).toUTCString() }); processQueue(db).catch(() => {});
      L.info('signin.new_location_email', `New-location email queued for ${user.login} (${ip})`, { actor: user.login, accountId: user.account_id, ip });
    }
  } catch (e) { L.warn('signin.history_failed', `Could not record sign-in history: ${e.message}`, { accountId: user?.account_id }); }
}

export async function purgeSignInHistory(db) {
  const days = await historyDays(db), r = await db.run('DELETE FROM sign_in_history WHERE ts < ?', [Date.now() - days * 86400e3]);
  if (r.changes) L.info('signin.purged', `Removed ${r.changes} sign-in history rows older than ${days} days`, { data: { days, rows: r.changes } });
}

export const sessionId = (tokenHash) => String(tokenHash).slice(0, 16);
