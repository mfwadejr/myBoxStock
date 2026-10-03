// SERVICES / backup / create — make a backup (SQLite snapshot, pg_dump or mysqldump).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { backupDir, stamp } from './files.mjs';

const run = promisify(execFile), L = areaLogger('backup');

export async function createBackup(db, label = 'manual', actor = null) {
  fs.mkdirSync(backupDir(), { recursive: true });
  const base = `myboxstock-${label}-${stamp()}`, t0 = Date.now();
  L.info('create.start', `Backup started (${label}, ${db.client})`, { actor, data: { label, engine: db.client } });
  try {
    let out;
    if (db.client === 'sqlite') { out = path.join(backupDir(), base + '.db'); await db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`); }
    else {
      out = path.join(backupDir(), base + '.sql');
      try {
        if (db.client === 'postgres') await run('pg_dump', ['--no-owner', '--dbname', config.dbUrl, '--file', out], { timeout: 600000 });
        else { const u = new URL(config.dbUrl); await run('mysqldump', [`--host=${u.hostname}`, `--port=${u.port || 3306}`, `--user=${decodeURIComponent(u.username)}`, '--single-transaction', '--result-file=' + out, u.pathname.slice(1)], { timeout: 600000, env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) } }); }
      } catch (e) { throw new Error(`${db.client === 'postgres' ? 'pg_dump' : 'mysqldump'} is not available or failed (${e.code || e.message}). Install the database client tools in the container, or back up with your database provider.`); }
    }
    const size = fs.statSync(out).size;
    L.info('create.done', `Backup ${path.basename(out)} created (${(size / 1024).toFixed(0)} KB in ${Date.now() - t0} ms)`, { actor, data: { name: path.basename(out), size, ms: Date.now() - t0, label } });
    return path.basename(out);
  } catch (e) { L.error('create.failed', `Backup failed: ${e.message}`, { actor, data: { label, error: e.message } }); throw e; }
}
