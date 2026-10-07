// CLI / commands — `node server.mjs reset-host-admin`, `node server.mjs reset-server-options` and `node server.mjs migrate-db --to <url>`.
import { initDb } from '../db/connection.mjs';
import { copyDatabase } from '../db/copy.mjs';
import { ensureHostAdmin } from './host-admin.mjs';
import fs from 'node:fs';
import { restoreBundleToDisk, extractBundle } from '../services/backup/bundle.mjs';
import { decryptFile } from '../services/backup/crypt.mjs';
import { clearRuntime } from '../services/runtime/index.mjs';
import { attachLogDb, closeLogs } from '../logging/logger.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

export async function runCli(cmd) {
  if (cmd === 'reset-host-admin') {
    const db = await initDb(); attachLogDb(db);
    const pw = await ensureHostAdmin(db, { reset: true });
    const owner = await db.get('SELECT username FROM host_admins ORDER BY created_at, id LIMIT 1');
    console.log(`\nHost admin reset. Username: ${owner?.username || 'admin'}\nTemporary password: ${pw}\nTwo-factor was cleared; you must change the password at next sign-in.\n`);
    await closeLogs(); await db.close(); return true;
  }
  if (cmd === 'reset-server-options') {
    const db = await initDb(); attachLogDb(db); await clearRuntime(db);
    console.log('\nSaved server options (proxy count, secure cookies, log detail, ...) cleared. The container settings are used again. Restart the app.\n');
    await closeLogs(); await db.close(); return true;
  }
  if (cmd === 'restore-bundle') {
    const file = arg('--file'), pass = process.env.BACKUP_PASSPHRASE;
    if (!file || !pass) { console.error('Usage: BACKUP_PASSPHRASE=… node server.mjs restore-bundle --file <backup.mbsbak> [--force]'); process.exitCode = 1; return true; }
    try { const m = await restoreBundleToDisk(file, pass, { force: process.argv.includes('--force') }); console.log(`\nRestored a ${m.engine} backup made ${m.createdAt} (myBoxStock ${m.version}).\n${m.engine === 'sqlite' ? 'Start the server — everyone can sign in as before.' : 'The database dump is in your data folder as restored-dump.sql; load it with psql / mysql, then start the server.'}\n`); }
    catch (e) { console.error(e.message); process.exitCode = 1; }
    await closeLogs(); return true;
  }
  if (cmd === 'decrypt-backup') {
    // Opens a copy that was sent away from the server (name ends in .mbsenc) into a plain database file; a .mbsbak full-site backup gives up its database the same way.
    const [file, out] = [process.argv[3], process.argv[4]], pass = process.env.BACKUP_PASSPHRASE;
    if (!file || !out || !pass) { console.error('Usage: BACKUP_PASSPHRASE=… node server.mjs decrypt-backup <file.mbsenc|file.mbsbak> <output-file>'); process.exitCode = 1; return true; }
    try {
      if (file.endsWith('.mbsbak')) { const x = await extractBundle(file, pass); try { fs.copyFileSync(x.files[x.manifest.database], out); fs.chmodSync(out, 0o600); } finally { x.cleanup(); } }
      else await decryptFile(file, out, pass);
      console.log(`\nDecrypted to ${out}. A .db file is the SQLite database; a .sql file is a dump to load with psql / mysql.`);
    } catch (e) { console.error(e.message); process.exitCode = 1; }
    return true;
  }
  if (cmd === 'migrate-db') {
    const to = arg('--to');
    if (!to) { console.error('Usage: node server.mjs migrate-db --to <postgres://… | mysql://… | sqlite:/path/file.db>'); process.exitCode = 1; return true; }
    const src = await initDb();
    const dst = to.startsWith('sqlite:') ? await initDb({ client: 'sqlite', file: to.slice(7) }) : await initDb({ client: to.startsWith('postgres') ? 'postgres' : 'mysql', url: to });
    console.log(`Copying ${src.client} -> ${dst.client} …`);
    await copyDatabase(src, dst);
    console.log('\nDone. Point DB_CLIENT and DATABASE_URL at the new database and restart. The original database was not modified.');
    await closeLogs(); await src.close(); await dst.close(); return true;
  }
  return false;
}
