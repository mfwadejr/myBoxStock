// SERVICES / backup / restore-note — after a restore, tells every customer (site-wide banner) that recent entries may be missing.
// A small note file is left next to the data when a restore is staged; on the next start, once the restored database is open, the banner is posted.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { saveAnnouncement } from '../announcement/index.mjs';

const L = areaLogger('backup');
const noteFile = () => path.join(config.dataDir, 'restore-note.json');
export const whenText = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

export function writeRestoreNote({ name, takenAt }) { fs.writeFileSync(noteFile(), JSON.stringify({ name, takenAt, requestedAt: Date.now() })); }
export const clearRestoreNote = () => fs.rmSync(noteFile(), { force: true });

export const restoreMessage = (takenAt) => `The site was restored from a backup taken ${whenText(takenAt)}. Sales or changes made after that time may be missing. Please check your recent activity.`;

// Called at start-up after the database is open. Returns true when a banner was posted.
export async function postRestoreAnnouncement(db) {
  if (!fs.existsSync(noteFile())) return false;
  let note; try { note = JSON.parse(fs.readFileSync(noteFile(), 'utf8')); } catch { clearRestoreNote(); return false; }
  const bad = await saveAnnouncement(db, { enabled: true, level: 'important', text: restoreMessage(note.takenAt), until: '' });
  clearRestoreNote();
  if (bad) { L.error('restore.announce_failed', `Could not post the restore notice: ${bad}`); return false; }
  L.warn('restore.announced', `Site restored from the backup ${note.name} (taken ${whenText(note.takenAt)}); a notice banner was posted for everyone. Clear it in Settings when it is no longer needed.`, { data: { name: note.name, takenAt: note.takenAt } });
  return true;
}
