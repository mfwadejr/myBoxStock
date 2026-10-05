// SERVICES / backup / testrestore — opens a backup in a scratch copy and checks it, so you know it would restore before you need it.
// Works in a temporary folder that is deleted afterwards; the live database and key are never read from or written to.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { areaLogger } from '../../logging/logger.mjs';
import { backupPath } from './files.mjs';
import { openBundle } from './bundle.mjs';
import { getPassphrase } from './passphrase.mjs';

const L = areaLogger('backup');
const ok = (label, detail = '') => ({ ok: true, label, detail }), bad = (label, detail = '') => ({ ok: false, label, detail });

// Integrity check and counts for one SQLite file (a private copy). `quick` uses the faster check (used right after a snapshot is written).
export function checkSqliteFile(file, { quick = false } = {}) {
  let d; const checks = [];
  try { d = new DatabaseSync(file, { readOnly: true }); } catch { return { checks: [bad('The file opens as a database', 'It is not a readable SQLite database. It may be damaged or cut short.')], counts: null }; }
  try {
    let res; try { res = Object.values(d.prepare(quick ? 'PRAGMA quick_check' : 'PRAGMA integrity_check').get())[0]; } catch (e) { res = e.message; }
    const unreadable = /not a database|malformed|corrupt|disk image/i.test(String(res));
    checks.push(res === 'ok' ? ok('The database passes its integrity check') : bad('The database passes its integrity check', unreadable ? 'The file is damaged, or it is not a SQLite database at all.' : `It reported: ${String(res).slice(0, 120)}`));
    if (res !== 'ok') return { checks, counts: null };
    try {
      const counts = { accounts: Number(d.prepare('SELECT COUNT(*) AS n FROM accounts').get().n), users: Number(d.prepare('SELECT COUNT(*) AS n FROM account_users').get().n) };
      checks.push(ok('Accounts and users can be read', `${counts.accounts} account${counts.accounts === 1 ? '' : 's'}, ${counts.users} user${counts.users === 1 ? '' : 's'}`));
      return { checks, counts };
    } catch { checks.push(bad('Accounts and users can be read', 'The account tables are missing, so this does not look like a myBoxStock database.')); return { checks, counts: null }; }
  } finally { d.close(); }
}

export async function testRestore(db, name, { passphrase = '', actor = null } = {}) {
  const src = backupPath(name), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-testrestore-')); let checks = [], counts = null, note = '';
  try {
    if (name.endsWith('.db')) {
      const copy = path.join(tmp, 'copy.db'); fs.copyFileSync(src, copy); ({ checks, counts } = checkSqliteFile(copy));
    } else if (name.endsWith('.mbsbak')) {
      const pass = passphrase || await getPassphrase(db); let e;
      if (!pass) checks.push(bad('The passphrase opens the backup', 'No passphrase is saved. Type the backup passphrase and try again.'));
      else {
        try { e = openBundle(fs.readFileSync(src), pass); checks.push(ok('The passphrase opens the backup')); } catch (er) { checks.push(bad('The passphrase opens the backup', er.message)); }
      }
      if (e) {
        const m = JSON.parse(e['manifest.json'].toString());
        checks.push(e['secret.key']?.length ? ok('The encryption key is inside') : bad('The encryption key is inside', 'The backup has no key, so two-factor secrets could not be read after a restore.'));
        if (m.engine === 'sqlite') { const copy = path.join(tmp, 'copy.db'); fs.writeFileSync(copy, e['database.db']); const r = checkSqliteFile(copy); checks.push(...r.checks); counts = r.counts; }
        else { const sql = e['database.sql']?.toString('utf8', 0, 200000) || ''; checks.push(/CREATE TABLE/i.test(sql) ? ok('The database dump looks complete') : bad('The database dump looks complete', 'It is empty or has no tables.')); note = 'This backup holds a PostgreSQL/MariaDB dump. It was opened and read, but a trial load needs a spare database server, so the dump itself was not loaded.'; }
      }
    } else {
      const head = fs.readFileSync(src, { encoding: 'utf8', flag: 'r' }).slice(0, 200000);
      checks.push(fs.statSync(src).size > 0 && /CREATE TABLE/i.test(head) ? ok('The dump contains the table definitions') : bad('The dump contains the table definitions', 'The file is empty or has no tables.'));
      note = 'Test restore can only load SQLite backups into a scratch copy. For a PostgreSQL/MariaDB dump this checked that the file is complete; loading it needs a spare database server.';
    }
  } catch (e) { checks.push(bad('The backup could be checked', e.message)); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const pass = checks.length > 0 && checks.every(c => c.ok);
  const summary = pass ? 'This backup passed. It opens, its data is intact, and it would restore.' : `This backup did not pass. ${checks.find(c => !c.ok)?.detail || 'It could not be checked.'} Do not rely on it.`;
  (pass ? L.info : L.warn).call(L, 'test_restore', `Test restore of ${name}: ${pass ? 'passed' : 'FAILED'}`, { actor, data: { name, pass, counts } });
  return { ok: pass, name, checks, counts, summary, note };
}
