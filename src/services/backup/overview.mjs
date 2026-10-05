// SERVICES / backup / overview — the numbers on the Backups page header: last backup, next run, offsite copy, space used and the cost line.
import fs from 'node:fs';
import { getTiers } from './tiers.mjs';
import { getTierStatus, tierFailing } from './status.mjs';
import { getFullConfig, getFullStatus } from './auto.mjs';
import { getSchedule } from './schedule.mjs';
import { folderBytes, listBackups, backupDir } from './files.mjs';
import { estimateCost } from './cost.mjs';
import { snapshot } from '../system/metrics.mjs';
import { enabledDestinations } from './destinations/index.mjs';
import { steadyCount } from './thin.mjs';

const DAY = 86400e3;
export function nextFullRun(cfg, now = Date.now()) {
  if (!cfg.enabled) return null;
  const d = new Date(now); d.setUTCMinutes(0, 0, 0); d.setUTCHours(cfg.hourUtc);
  for (let i = 0; i < 9; i++) { if (d.getTime() > now && (cfg.frequency !== 'weekly' || d.getUTCDay() === cfg.weekday)) return d.getTime(); d.setTime(d.getTime() + DAY); }
  return null;
}
export async function databaseBytes(db) {
  if (db.client === 'sqlite' && db.file && fs.existsSync(db.file)) return fs.statSync(db.file).size;
  const l = listBackups().find(b => b.kind !== 'fullsite'); return l ? l.size : 0;
}

export async function backupOverview(db, now = Date.now()) {
  const tiers = await getTiers(db), st = await getTierStatus(db), full = await getFullConfig(db), fs_ = await getFullStatus(db), sched = await getSchedule(db);
  const disk = snapshot().disk, dbBytes = await databaseBytes(db), used = folderBytes();
  const cost = estimateCost({ dbBytes, frequent: tiers.frequent, offsite: tiers.offsite, full: { ...full, destinations: full.destinationIds }, safety: tiers.safety, freeBytes: disk?.free ?? null, usedByBackupsBytes: used });
  const lasts = [];
  if (st.frequent?.lastOk) lasts.push({ ...st.frequent.lastOk, tier: 'frequent' });
  if (st.manual?.lastOk) lasts.push({ ...st.manual.lastOk, tier: 'manual' });
  if (st.offsite?.lastOk) lasts.push({ ...st.offsite.lastOk, tier: 'offsite' });
  if (fs_.lastOk) lasts.push({ name: fs_.lastOk.name, at: fs_.lastOk.at, verified: fs_.lastOk.verified, tier: 'full' });
  const last = lasts.sort((a, b) => b.at - a.at)[0] || null;
  const nexts = [];
  if (tiers.frequent.enabled) nexts.push({ tier: 'frequent', at: Math.max(now, (st.frequent?.lastAttemptAt || now) + tiers.frequent.everyMinutes * 60000) });
  if (tiers.offsite.enabled && tiers.offsite.destinations.length) nexts.push({ tier: 'offsite', at: Math.max(now, (st.offsite?.lastAttemptAt || now) + tiers.offsite.everyMinutes * 60000) });
  const nf = nextFullRun(full, now); if (nf) nexts.push({ tier: 'full', at: nf });
  const next = nexts.sort((a, b) => a.at - b.at)[0] || null;
  const dests = await enabledDestinations(db, [...(tiers.offsite.destinations || []), ...(full.destinationIds || [])]);
  const offsiteWhere = [...new Set([...(st.offsite?.lastOk?.where || []).map(w => w.name), ...(full.destinationIds?.length && fs_.lastOk?.destinations || [])])];
  return {
    last, next, nexts,
    offsite: { exists: offsiteWhere.length > 0 || !!full.offboxDir && !!fs_.lastOk?.offbox, where: [...offsiteWhere, ...(fs_.lastOk?.offbox ? [fs_.lastOk.offbox] : [])], at: st.offsite?.lastOk?.at || fs_.lastOk?.at || null, configured: dests.length > 0 },
    failing: { frequent: tierFailing(st.frequent), offsite: tierFailing(st.offsite), full: tierFailing({ lastOk: fs_.lastOk, lastFail: fs_.lastFail }), detail: { frequent: st.frequent?.lastFail || null, offsite: st.offsite?.lastFail || null, full: fs_.lastFail || null } },
    space: { used, free: disk?.free ?? null, total: disk?.total ?? null, folder: backupDir() },
    cost, schedule: sched, counts: { frequent: steadyCount(tiers.frequent.everyMinutes, tiers.frequent.thin), offsite: steadyCount(tiers.offsite.everyMinutes, tiers.offsite.thin) },
  };
}
