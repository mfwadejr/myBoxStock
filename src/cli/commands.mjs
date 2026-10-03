// CLI / commands — `node server.mjs reset-host-admin` and `node server.mjs migrate-db --to <url>`.
import { initDb } from '../db/connection.mjs';
import { copyDatabase } from '../db/copy.mjs';
import { ensureHostAdmin } from './host-admin.mjs';
import { attachLogDb, closeLogs } from '../logging/logger.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

export async function runCli(cmd) {
  if (cmd === 'reset-host-admin') {
    const db = await initDb(); attachLogDb(db);
    const pw = await ensureHostAdmin(db, { reset: true });
    console.log(`\nHost admin reset. Username: admin\nTemporary password: ${pw}\nTwo-factor was cleared; you must change the password at next sign-in.\n`);
    await closeLogs(); await db.close(); return true;
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
