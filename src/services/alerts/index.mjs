// SERVICES / alerts — server-side problems shown in the Host Console and emailed to the Owner administrator.
// Only the server's own health is watched (email, backups, sign-in floods, disk, trials about to end). Nothing inside an account is ever read.
// Repeats of the same problem are grouped into one alert (a counter), and the Owner is emailed once per alert, not once per repeat.
import { newId } from '../../core/ids.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { getSetting } from '../../db/settings.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { getFullStatus } from '../backup/index.mjs';
import { snapshot } from '../system/metrics.mjs';
import { billingState, DAY } from '../billing/state.mjs';

const L = areaLogger('system');
const HOUR = 3600e3;
export const SIGNIN_LIMIT = 20; // failed or refused sign-ins in one hour before it is worth a look
const NO_EMAIL = new Set(['update.available']);

// Owner = the oldest Host administrator who has an email address.
const ownerEmail = async (db) => (await db.get("SELECT email FROM host_admins WHERE email IS NOT NULL AND email <> '' ORDER BY created_at, id LIMIT 1"))?.email;

export async function raise(db, { kind, key = kind, level = 'warn', title, detail = '' }) {
  const now = Date.now(), cur = await db.get("SELECT id, status FROM alerts WHERE dedupe_key = ? AND status IN ('open','dismissed')", [key]);
  if (cur) { await db.run('UPDATE alerts SET last_at = ?, occurrences = occurrences + 1, detail = ?, title = ? WHERE id = ?', [now, String(detail).slice(0, 600), title, cur.id]); return { id: cur.id, isNew: false }; }
  const id = newId();
  await db.run('INSERT INTO alerts (id, kind, dedupe_key, level, title, detail, first_at, last_at, occurrences, status) VALUES (?,?,?,?,?,?,?,?,1,?)', [id, kind, key, level, title, String(detail).slice(0, 600), now, now, 'open']);
  L[level === 'error' ? 'error' : 'warn']('alert.raised', `Alert: ${title}`, { data: { kind, key } });
  const to = NO_EMAIL.has(kind) ? null : await ownerEmail(db);
  if (to) {
    try { await enqueueMail(db, to, 'host_alert', { title, detail: detail || title, when: new Date(now).toUTCString() }); await db.run('UPDATE alerts SET emailed_at = ? WHERE id = ?', [now, id]); processQueue(db).catch(() => {}); } catch (e) { L.warn('alert.mail_failed', `Could not queue the alert email: ${e.message}`); }
  }
  return { id, isNew: true };
}
export async function resolve(db, key) {
  const r = await db.run("UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE dedupe_key = ? AND status IN ('open','dismissed')", [Date.now(), key]);
  if (r?.changes) L.info('alert.resolved', `Alert cleared: ${key}`, { data: { key } });
}
export const dismiss = (db, id) => db.run("UPDATE alerts SET status = 'dismissed' WHERE id = ? AND status = 'open'", [id]);
export const openCount = async (db) => Number((await db.get("SELECT COUNT(*) AS n FROM alerts WHERE status = 'open'")).n);
export const list = async (db) => ({
  open: await db.all("SELECT * FROM alerts WHERE status IN ('open') ORDER BY last_at DESC"),
  quiet: await db.all("SELECT * FROM alerts WHERE status = 'dismissed' ORDER BY last_at DESC LIMIT 20"),
  recent: await db.all("SELECT * FROM alerts WHERE status = 'resolved' ORDER BY resolved_at DESC LIMIT 20"),
});

// One pass over every check. Each check either raises (condition true) or clears (condition gone).
export async function evaluate(db) {
  const now = Date.now(), set = async (on, a) => { if (on) await raise(db, a); else await resolve(db, a.key || a.kind); };

  // Email: messages that gave up, or a queue that is not moving.
  const failed = Number((await db.get("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'failed' AND created_at > ?", [now - 24 * HOUR])).n);
  const stuck = Number((await db.get("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'queued' AND created_at < ?", [now - 30 * 60e3])).n);
  const lastErr = failed ? (await db.get("SELECT last_error FROM mail_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1"))?.last_error : '';
  await set(failed > 0 || stuck > 0, { kind: 'email.failing', level: 'warn', title: 'Email is not being delivered',
    detail: `${failed} message${failed === 1 ? '' : 's'} failed in the last 24 hours and ${stuck} ${stuck === 1 ? 'has' : 'have'} waited over 30 minutes.${lastErr ? ` Last problem: ${lastErr}` : ''} Open Email, then Health.` });

  // Backups: the newest scheduled full-site backup failed.
  const st = await getFullStatus(db), bad = st.lastFail && (!st.lastOk || st.lastFail.at > st.lastOk.at);
  await set(!!bad, { kind: 'backup.failing', level: 'error', title: 'The scheduled backup is failing', detail: bad ? `The last attempt failed: ${String(st.lastFail.error || 'unknown problem').slice(0, 300)}` : '' });

  // Sign-ins: a burst of failed, refused or wrong-code attempts.
  const n = Number((await db.get("SELECT COUNT(*) AS n FROM event_log WHERE area = 'auth' AND event IN ('login.failed','login.blocked','mfa.failed') AND ts > ?", [now - HOUR])).n);
  await set(n >= SIGNIN_LIMIT, { kind: 'signins.failing', level: 'warn', title: 'Many failed sign-ins', detail: `${n} failed or refused sign-in attempts in the last hour. Open Logs, quick filter "Failed sign-ins", to see where they come from.` });

  // Disk and database.
  const snap = snapshot(), d = snap.disk, pct = d ? Math.round(d.used / d.total * 100) : 0;
  await set(pct >= 90, { kind: 'disk.full', level: 'error', title: 'Storage is almost full', detail: `Storage is ${pct}% full. Free space or enlarge the disk before backups and the database run out of room.` });
  const dbErr = Number((await db.get("SELECT COUNT(*) AS n FROM event_log WHERE area = 'database' AND level = 'error' AND ts > ?", [now - HOUR])).n);
  await set(dbErr > 0, { kind: 'database.errors', level: 'error', title: 'Database problems', detail: `${dbErr} database error${dbErr === 1 ? '' : 's'} in the last hour. Open Logs, area "database".` });

  // Trials about to end (a count only; no account is named).
  let ending = 0; for (const a of await db.all("SELECT plan, trial_ends_at, plan_until FROM accounts WHERE status <> 'closing'")) { const b = billingState(a, now); if (b.canWrite && b.plan === 'trial' && b.endsAt && b.endsAt - now <= 3 * DAY) ending++; }
  await set(ending > 0, { kind: 'trials.ending', level: 'info', title: 'Trials ending soon', detail: `${ending} trial${ending === 1 ? '' : 's'} end within 3 days. Open Accounts or Plans to follow up.` });
}

let timer;
export function startAlertWorker(db) {
  const run = () => evaluate(db).catch((e) => L.error('alert.error', `Alert check failed: ${e.message}`));
  setTimeout(run, 20000).unref(); timer = setInterval(run, 5 * 60e3); timer.unref();
  L.info('alert.started', 'Alert checks started (every 5 minutes)');
}
