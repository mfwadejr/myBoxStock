// SERVICES / retention / compact — gives the space deleted rows left behind in the SQLite file back to the disk (VACUUM). A prune alone does not shrink
// the file. Runs as one of the background jobs (backup/jobs.mjs), so only one runs at a time and never beside a backup or restore, and it checks free space first.
import { startJob } from '../backup/jobs.mjs';
import { backupBusy } from '../backup/runner.mjs';
import { jobStep } from '../backup/progress.mjs';
import { snapshot } from '../system/metrics.mjs';
import { log } from '../../logging/logger.mjs';
import { dbFileBytes } from './space.mjs';
import { coded, fmtBytes } from './rules.mjs';

export const SLACK = 64 * 1048576;   // room kept beyond the copy VACUUM makes
// Free space needed: a second copy of the database, plus a little.
export const neededBytes = (dbBytes) => Math.ceil(dbBytes * 1.1) + SLACK;
export async function checkCompact(db) {
  if (db.client !== 'sqlite') throw coded('RETENTION_COMPACT_SQLITE');
  const bytes = await dbFileBytes(db), disk = snapshot().disk;
  if (disk && disk.free < neededBytes(bytes)) throw Object.assign(coded('RETENTION_COMPACT_SPACE'), { need: neededBytes(bytes), free: disk.free });
  return { bytes, free: disk?.free ?? null };
}
async function vacuum(db) {
  for (let i = 0; i < 40; i++) {   // another request may hold a transaction on the one connection for a moment
    try { db.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.raw.exec('VACUUM'); db.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return; }
    catch (e) { if (!/within a transaction|locked|busy/i.test(e.message)) throw e; await new Promise(r => setTimeout(r, 250)); }
  }
  throw coded('RETENTION_COMPACT_FAILED');
}
// Starts the job. Throws a coded error (HOST_JOB_RUNNING, RETENTION_COMPACT_SQLITE, RETENTION_COMPACT_SPACE) before anything is changed.
export async function startCompact(db, { actor, ip, audit }) {
  const by = backupBusy(); if (by) throw Object.assign(coded('HOST_JOB_RUNNING'), { by });
  const before = await checkCompact(db);
  return startJob({ kind: 'compact', label: 'Compact the database', actor, ip, run: async () => {
    jobStep('Checking free space', 2, 8);
    jobStep('Compacting the database (the site may pause briefly)', 8, 92);
    await vacuum(db);
    jobStep('Measuring the result', 92, 99);
    const after = await dbFileBytes(db), freed = Math.max(0, before.bytes - after);
    audit({ before: before.bytes, after, freed });
    log('database', 'info', 'compacted', `Database compacted: ${before.bytes} -> ${after} bytes`, { actor, data: { before: before.bytes, after, freed } });
    return { ok: true, before: before.bytes, after, freed, summary: `Compacted. The database went from ${fmtBytes(before.bytes)} to ${fmtBytes(after)}.` };
  } });
}
