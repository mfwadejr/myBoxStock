// CLI / commands — `node server.mjs reset-host-admin`, `node server.mjs reset-server-options` and `node server.mjs migrate-db --to <url>`.
import { initDb } from '../db/connection.mjs';
import { copyDatabase } from '../db/copy.mjs';
import { ensureHostAdmin } from './host-admin.mjs';
import { restoreBundleToDisk } from '../services/backup/bundle.mjs';
import { clearRuntime } from '../services/runtime/index.mjs';
import { attachLogDb, closeLogs } from '../logging/logger.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

export async function runCli(cmd) {
  if (cmd === 'reset-host-admin') {
    const db = await initDb(); attachLogDb(db);
    const pw = await ensureHostAdmin(db, { reset: true });
    console.log(`\nHost admin reset. Username: admin\nTemporary password: ${pw}\nTwo-factor was cleared; you must change the password at next sign-in.\n`);
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
    try { const m = restoreBundleToDisk(file, pass, { force: process.argv.includes('--force') }); console.log(`\nRestored a ${m.engine} backup made ${m.createdAt} (myBoxStock ${m.version}).\n${m.engine === 'sqlite' ? 'Start the server — everyone can sign in as before.' : 'The database dump is in your data folder as restored-dump.sql; load it with psql / mysql, then start the server.'}\n`); }
    catch (e) { console.error(e.message); process.exitCode = 1; }
    await closeLogs(); return true;
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
