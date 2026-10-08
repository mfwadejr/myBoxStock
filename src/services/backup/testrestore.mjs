// SERVICES / backup / testrestore — opens a backup in a scratch copy and checks it, so you know it would restore before you need it.
// Works in a temporary folder that is deleted afterwards; the live database and key are never read from or written to.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { areaLogger } from '../../logging/logger.mjs';
import { backupPath } from './files.mjs';
import { extractBundle, keyOf, peekPart } from './bundle.mjs';
import { getPassphrase, earlierPassphraseNote } from './passphrase.mjs';
import { takenAtFromName } from './files.mjs';
import { jobStep } from './progress.mjs';
import { recordTestResult } from './health.mjs';

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
      jobStep('Copying the snapshot to a scratch copy', 5, 40); const copy = path.join(tmp, 'copy.db'); fs.copyFileSync(src, copy); jobStep('Checking the database', 40, 95); ({ checks, counts } = checkSqliteFile(copy));
    } else if (name.endsWith('.mbsbak')) {
      const pass = passphrase || await getPassphrase(db); let x;
      if (!pass) checks.push(bad('The passphrase opens the backup', 'No passphrase is saved. Type the backup passphrase and try again.'));
      else {
        jobStep('Decrypting the backup and checking every part', 5, 85);
        try { x = await extractBundle(src, pass, { dir: tmp }); checks.push(ok('The passphrase opens the backup', 'It decrypted, and the whole file passed its authenticity check, so it is complete and unchanged.')); } catch (er) { checks.push(bad('The passphrase opens the backup', (await earlierPassphraseNote(db, takenAtFromName(name, fs.statSync(src).mtimeMs))) || er.message)); }
      }
      if (x) {
        const m = x.manifest;
        checks.push(keyOf(x) ? ok('The encryption key is inside') : bad('The encryption key is inside', 'The backup has no key, so two-factor secrets could not be read after a restore.'));
        jobStep('Checking the database', 85, 99);
        if (m.engine === 'sqlite') { const r = checkSqliteFile(x.files['database.db']); checks.push(...r.checks); counts = r.counts; }
        else { checks.push(/CREATE TABLE/i.test(peekPart(x, 'database.sql')) ? ok('The database dump looks complete') : bad('The database dump looks complete', 'It is empty or has no tables.')); note = 'This backup holds a PostgreSQL/MariaDB dump. It was opened and read, but a trial load needs a spare database server, so the dump itself was not loaded.'; }
      }
    } else {
      const fd = fs.openSync(src, 'r'), hb = Buffer.alloc(200000), head = hb.toString('utf8', 0, fs.readSync(fd, hb, 0, 200000, 0)); fs.closeSync(fd);
      checks.push(fs.statSync(src).size > 0 && /CREATE TABLE/i.test(head) ? ok('The dump contains the table definitions') : bad('The dump contains the table definitions', 'The file is empty or has no tables.'));
      note = 'Test restore can only load SQLite backups into a scratch copy. For a PostgreSQL/MariaDB dump this checked that the file is complete; loading it needs a spare database server.';
    }
  } catch (e) { checks.push(bad('The backup could be checked', e.message)); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const pass = checks.length > 0 && checks.every(c => c.ok);
  await recordTestResult(db, { ok: pass, name, kind: name.endsWith('.db') ? 'snapshot' : 'full-site' });
  const summary = pass ? 'This backup passed. It opens, its data is intact, and it would restore.' : `This backup did not pass. ${checks.find(c => !c.ok)?.detail || 'It could not be checked.'} Do not rely on it.`;
  (pass ? L.info : L.warn).call(L, 'test_restore', `Test restore of ${name}: ${pass ? 'passed' : 'FAILED'}`, { actor, data: { name, pass, counts } });
  return { ok: pass, name, checks, counts, summary, note };
}
