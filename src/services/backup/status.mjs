// SERVICES / backup / status — remembers when each backup tier last ran and whether it worked (a setting, so it survives restarts).
import { getSetting, setSetting } from '../../db/settings.mjs';

const EMPTY = { frequent: {}, offsite: {}, last: null };
export const getTierStatus = async (db) => ({ ...EMPTY, ...(await getSetting(db, 'backup_status', {})) });
export async function recordTier(db, tier, patch) {
  const s = await getTierStatus(db); s[tier] = { ...(s[tier] || {}), ...patch };
  if (patch.lastOk) s.last = { ...patch.lastOk, tier };
  await setSetting(db, 'backup_status', s); return s;
}
export const tierFailing = (t) => !!(t?.lastFail && (!t.lastOk || t.lastFail.at > t.lastOk.at));
