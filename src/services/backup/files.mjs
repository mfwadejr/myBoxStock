// SERVICES / backup / files — where backups live and how to list, locate and delete them.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';

const L = areaLogger('backup');
export const backupDir = () => path.join(config.dataDir, 'backups');
export const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const safeName = (n) => /^[\w.-]+$/.test(n) && !n.includes('..');

export function listBackups() {
  fs.mkdirSync(backupDir(), { recursive: true });
  return fs.readdirSync(backupDir()).filter(f => /\.(db|sql)$/.test(f)).map(f => {
    const st = fs.statSync(path.join(backupDir(), f));
    return { name: f, size: st.size, created: st.mtimeMs, kind: f.endsWith('.db') ? 'sqlite' : 'sql-dump' };
  }).sort((a, b) => b.created - a.created);
}
export function backupPath(name) {
  if (!safeName(name)) throw new Error('Bad name');
  const p = path.join(backupDir(), name); if (!fs.existsSync(p)) throw new Error('Not found'); return p;
}
export function deleteBackup(name, actor) { fs.unlinkSync(backupPath(name)); L.info('deleted', `Deleted backup ${name}`, { actor, data: { name } }); }
