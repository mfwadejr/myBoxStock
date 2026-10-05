// SERVICES / backup / restore — SQLite restore is staged, then applied at the next start so a live connection is never swapped under traffic.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { backupDir, backupPath, stamp, takenAtFromName } from './files.mjs';
import { writeRestoreNote } from './restore-note.mjs';

const L = areaLogger('backup');
const pendingFile = () => path.join(config.dataDir, 'restore-pending.db');

export function stageRestore(name, actor) {
  const p = backupPath(name);
  if (!name.endsWith('.db')) throw new Error('Only SQLite snapshots can be restored from the console. Restore SQL dumps with psql / mysql.');
  fs.copyFileSync(p, pendingFile());
  writeRestoreNote({ name, takenAt: takenAtFromName(name, fs.statSync(p).mtimeMs) }); // the site-wide notice is posted after the restart
  L.warn('restore.staged', `Restore of ${name} staged; the server will restart to apply it`, { actor, data: { name } });
}
export function applyPendingRestore(dbFile) { // run before the DB is opened at startup
  if (!fs.existsSync(pendingFile())) return false;
  fs.mkdirSync(backupDir(), { recursive: true });
  if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, path.join(backupDir(), `myboxstock-pre-restore-${stamp()}.db`));
  for (const ext of ['-wal', '-shm']) fs.rmSync(dbFile + ext, { force: true });
  fs.renameSync(pendingFile(), dbFile);
  const keyPending = path.join(config.dataDir, 'restore-pending.key');
  if (fs.existsSync(keyPending)) { const k = path.join(config.dataDir, 'secret.key'); if (fs.existsSync(k)) fs.copyFileSync(k, path.join(backupDir(), `secret-pre-restore-${stamp()}.key`)); fs.renameSync(keyPending, k); }
  L.warn('restore.applied', 'Pending restore applied; the previous database was saved as a pre-restore backup');
  return true;
}
export const restorePending = () => fs.existsSync(pendingFile());
