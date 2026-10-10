// SERVICES / demo / backup-gate — "take a backup first". Build, Remove and Reset need a recent full-site backup (default: made in the last 24 hours) or, for the Owner only,
// a typed confirmation to go ahead without one (written to the audit trail). The backup itself is the existing full-site backup job; this file only reads its result.
import { getFullStatus } from '../backup/auto.mjs';
import { getDemo } from './settings.mjs';
import { coded, audit } from './audit.mjs';

export const OVERRIDE_TEXT = 'PROCEED WITHOUT BACKUP';
// { recent, lastAt, name, size, ageHours, maxAgeHours, firstBuild, failed }
export async function backupState(db, now = Date.now()) {
  const s = await getFullStatus(db), sec = await getDemo(db), ok = s.lastOk, at = ok?.at || null, ageHours = at ? (now - at) / 3600e3 : null;
  return { recent: !!at && ageHours <= sec.backupMaxAgeHours, lastAt: at, name: ok?.name || null, size: ok?.size || null, verified: !!ok?.verified, ageHours: ageHours == null ? null : Math.round(ageHours * 10) / 10, maxAgeHours: sec.backupMaxAgeHours, firstBuild: !sec.everBuilt, lastFail: s.lastFail || null };
}
// Passes when a recent backup exists. Otherwise needs `confirm` equal to the override text from the Owner. Throws a coded error when neither.
export async function requireBackup(db, { confirm = '', isOwner = false, actor, ip = null, what = 'a demo action' } = {}) {
  const st = await backupState(db); if (st.recent) return { overridden: false, state: st };
  if (!confirm) throw coded('DEMO_BACKUP_NEEDED', { state: st });
  if (!isOwner) throw coded('DEMO_OVERRIDE_OWNER');
  if (confirm !== OVERRIDE_TEXT) throw coded('DEMO_BACKUP_CONFIRM');
  audit('demo.backup_override', `The Owner continued with ${what} without a recent backup (${st.lastAt ? 'last backup ' + st.ageHours + ' hours ago' : 'no backup on record'})`, { actor, ip, level: 'warn', data: { what, state: { lastAt: st.lastAt } } });
  return { overridden: true, state: st };
}
