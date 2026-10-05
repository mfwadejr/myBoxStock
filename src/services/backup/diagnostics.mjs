// SERVICES / backup / diagnostics — a plain-text health summary the reseller can paste to the Host admin. Counts, codes and times only: never tenant data, never other people's addresses.
import { config } from '../../core/config.mjs';
import { describeDevice } from '../signins/device.mjs';

const IP = /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;
const when = (t) => t ? new Date(Number(t)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'never';

export async function buildDiagnostics(db, user, ua, now = Date.now()) {
  const acc = await db.get('SELECT account_code, plan, last_backup_at, created_at FROM accounts WHERE id = ?', [user.account_id]);
  const roles = await db.all('SELECT role, COUNT(*) AS n FROM account_users WHERE account_id = ? GROUP BY role ORDER BY role', [user.account_id]);
  const twofa = Number((await db.get('SELECT COUNT(*) AS n FROM account_users WHERE account_id = ? AND totp_enabled = 1', [user.account_id])).n), total = roles.reduce((t, r) => t + Number(r.n), 0);
  const vault = await db.get('SELECT confirmed_at FROM account_recovery WHERE account_id = ?', [user.account_id]);
  const rp = await db.get('SELECT created_at FROM restore_points WHERE account_id = ?', [user.account_id]);
  const ev = await db.all("SELECT ts, level, event, message FROM event_log WHERE account_id = ? AND level IN ('warn','error') ORDER BY ts DESC LIMIT 20", [user.account_id]);
  const b = user.billing || {};
  const lines = [
    'myBoxStock diagnostics', `Created: ${when(now)}`, '',
    `App version: ${config.version}`, `Build: ${config.build || 'not set'}`, `Device: ${describeDevice(ua)}`,
    `Reseller ID: ${acc.account_code}`, `Plan: ${acc.plan || 'none'}`, `Billing: ${b.state || 'unknown'}${b.canWrite === false ? ' (read-only)' : ''}${b.daysLeft != null && b.state === 'trial' ? `, ${b.daysLeft} day(s) left` : ''}`,
    `Users: ${total} (${roles.map(r => `${r.role} ${Number(r.n)}`).join(', ') || 'none'})`,
    `Two-factor: ${twofa} of ${total} users have it on`,
    `Encryption: ${vault ? `on, recovery key ${vault.confirmed_at ? 'confirmed saved' : 'not confirmed'}` : 'off'}`,
    `Last full backup: ${when(acc.last_backup_at)}`, `Restore undo available: ${rp ? 'yes' : 'no'}`, '',
    `Recent warnings and errors for this account (${ev.length}):`,
    ...(ev.length ? ev.map(e => `${when(e.ts)}  ${String(e.level).toUpperCase()}  ${e.event}  ${String(e.message || '').replace(IP, '[address]').slice(0, 200)}`) : ['none']),
  ];
  return lines.join('\n');
}
