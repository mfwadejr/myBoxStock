// SERVICES / backup / schedule — automatic daily backups and retention.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { createBackup } from './create.mjs';
import { listBackups, deleteBackup } from './files.mjs';
import { maybeRunFull } from './auto.mjs';
import { tickTiers, withBackupLock } from './runner.mjs';
import { applyLocalDir } from './tiers.mjs';
import { audit } from './audit.mjs';

const L = areaLogger('backup');
export const DEFAULT_SCHEDULE = { enabled: true, hourUtc: 3, keep: 14 };

export const getSchedule = async (db) => ({ ...DEFAULT_SCHEDULE, ...(await getSetting(db, 'backup_schedule', {})) });
export async function saveSchedule(db, p, actor) {
  const next = { enabled: !!p.enabled, hourUtc: Math.min(23, Math.max(0, Number(p.hourUtc) || 0)), keep: Math.min(365, Math.max(1, Number(p.keep) || 14)) };
  await setSetting(db, 'backup_schedule', next);
  L.info('schedule.saved', `Backup schedule: ${next.enabled ? `daily at ${next.hourUtc}:00 UTC, keep ${next.keep}` : 'off'}`, { actor, data: next });
  return next;
}
export function pruneBackups(keep) {
  for (const b of listBackups().filter(b => b.name.includes('-auto-')).slice(keep)) { deleteBackup(b.name, 'scheduler'); L.info('pruned', `Removed old automatic backup ${b.name}`, { data: { name: b.name } }); }
}
let lastAutoDay = '';
// One pass, once a minute. Each kind of backup takes a shared lock, so two backups never run at the same time (a busy one is simply tried again next minute).
export async function schedulerTick(db) {
  try {
    const s = await getSchedule(db), now = new Date(), day = now.toISOString().slice(0, 10);
    if (s.enabled && now.getUTCHours() === s.hourUtc && lastAutoDay !== day) {
      const r = await withBackupLock('the daily copy', async () => { lastAutoDay = day; const n = await createBackup(db, 'auto', 'scheduler'); pruneBackups(s.keep); audit('backup.run', `Daily copy ${n} taken (scheduled)`, { data: { tier: 'frequent', name: n, trigger: 'scheduled', ok: true } }); });
      if (r.skipped) lastAutoDay = '';
    }
  } catch (e) { L.error('scheduler.error', `Automatic backup failed: ${e.message}`); }
  try { await tickTiers(db); } catch (e) { L.error('scheduler.error', `Backup tier check failed: ${e.message}`); }
  try { await withBackupLock('the full-site backup', () => maybeRunFull(db)); } catch (e) { L.error('scheduler.error', `Scheduled full-site backup check failed: ${e.message}`); }
}
let ticking = false;
export function startBackupScheduler(db) {
  applyLocalDir(db).catch((e) => L.error('scheduler.error', `Could not read the backup folder setting: ${e.message}`));
  setInterval(async () => { if (ticking) return; ticking = true; try { await schedulerTick(db); } finally { ticking = false; } }, 60000).unref();
  L.info('scheduler.started', 'Backup scheduler started (snapshots, offsite copies, full-site backups, safety-copy tidy-up)');
}
