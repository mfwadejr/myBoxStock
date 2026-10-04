// SERVICES / backup / schedule — automatic daily backups and retention.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { createBackup } from './create.mjs';
import { listBackups, deleteBackup } from './files.mjs';
import { maybeRunFull } from './auto.mjs';

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
export function startBackupScheduler(db) {
  setInterval(async () => {
    try {
      const s = await getSchedule(db), now = new Date(), day = now.toISOString().slice(0, 10);
      if (s.enabled && now.getUTCHours() === s.hourUtc && lastAutoDay !== day) { lastAutoDay = day; await createBackup(db, 'auto', 'scheduler'); pruneBackups(s.keep); }
    } catch (e) { L.error('scheduler.error', `Automatic backup failed: ${e.message}`); }
    try { await maybeRunFull(db); } catch (e) { L.error('scheduler.error', `Scheduled full-site backup check failed: ${e.message}`); }
  }, 60000).unref();
  L.info('scheduler.started', 'Backup scheduler started');
}
