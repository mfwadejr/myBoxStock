// SERVICES / backup / files — where backups live and how to list, locate and delete them.
// New files go to the default folder ${DATA_DIR}/backup (inside the data volume). Older copies made by earlier versions in
// ${DATA_DIR}/backups are still listed, downloaded, restored and deleted from where they are; nothing is moved.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';

const L = areaLogger('backup');
let customDir = '';
export const defaultBackupDir = () => path.join(config.dataDir, 'backup');
export const legacyBackupDir = () => path.join(config.dataDir, 'backups');
export const setBackupDir = (dir) => { customDir = dir && path.isAbsolute(dir) ? dir : ''; };
export const backupDir = () => customDir || defaultBackupDir();
const readDirs = () => [...new Set([backupDir(), defaultBackupDir(), legacyBackupDir()])];
export const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const safeName = (n) => /^[\w.-]+$/.test(n) && !n.includes('..');

// The moment a backup was taken, read from the stamp in its name (UTC); falls back to the file time.
export function takenAtFromName(name, fallback = 0) {
  const m = String(name).match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : fallback;
}
// Which tier a file belongs to: frequent (snap, manual, daily plain), full (full-site), safety (taken before a restore).
export function classify(name) {
  if (/-fullsite-/.test(name)) return { tier: 'full', label: /-weekly-/.test(name) ? 'weekly' : /-daily-/.test(name) ? 'daily' : 'manual' };
  if (/-pre-restore-/.test(name)) return { tier: 'safety', label: 'pre-restore' };
  const m = name.match(/^myboxstock-(snap|manual|auto)-/);
  return { tier: 'frequent', label: m ? m[1] : 'other' };
}

export function listBackups() {
  fs.mkdirSync(backupDir(), { recursive: true });
  const seen = new Set(), out = [];
  for (const dir of readDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(db|sql|mbsbak)$/.test(f) || seen.has(f) || /-bundle-temp-|-offsite-temp-/.test(f)) continue;
      let st; try { st = fs.statSync(path.join(dir, f)); } catch { continue; }
      seen.add(f);
      out.push({ name: f, size: st.size, created: st.mtimeMs, takenAt: takenAtFromName(f, st.mtimeMs), kind: f.endsWith('.mbsbak') ? 'fullsite' : f.endsWith('.db') ? 'sqlite' : 'sql-dump', ...classify(f), legacy: dir === legacyBackupDir() && dir !== backupDir() });
    }
  }
  return out.sort((a, b) => b.created - a.created);
}
export function backupPath(name) {
  if (!safeName(name)) throw new Error('Bad name');
  for (const dir of readDirs()) { const p = path.join(dir, name); if (fs.existsSync(p)) return p; }
  throw new Error('Not found');
}
export function deleteBackup(name, actor) { fs.unlinkSync(backupPath(name)); L.info('deleted', `Deleted backup ${name}`, { actor, data: { name } }); }
export function folderBytes() { let n = 0; for (const b of listBackups()) n += b.size; return n; }
