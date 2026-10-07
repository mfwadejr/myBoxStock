// SERVICES / backup / jobkinds — what each background job does. Each kind turns the request into { label, run } for jobs.startJob; the work itself is
// the same service code the page used to call in one long request. Checks that need no waiting (typed RESTORE, SQLite only) are made before the job starts.
import { coded } from './gate.mjs';
import { audit } from './audit.mjs';
import { backupPath } from './files.mjs';
import { createBackup } from './create.mjs';
import { createBundle, stageBundleRestore } from './bundle.mjs';
import { stageRestore } from './restore.mjs';
import { runFullBackup } from './auto.mjs';
import { testRestore } from './testrestore.mjs';
import { testOffsiteCopy, restoreOffsiteCopy, dropToken } from './offsite.mjs';
import { testBackupFile, restoreBackupFile, dropToken as dropFileToken } from './filetest.mjs';
import { jobStep } from './progress.mjs';
import { onDetachedToken } from './jobs.mjs';

onDetachedToken((t) => { dropToken(t); dropFileToken(t); });
const str = (v) => String(v ?? '');
const needConfirm = (b) => { if (b.confirm !== 'RESTORE') throw coded('HOST_BACKUP_RESTORE_CONFIRM'); };
const sqliteOnly = (db) => { if (db.client !== 'sqlite') throw coded('HOST_BACKUP_SQLITE_ONLY'); };
const fail = (m) => Object.assign(new Error(m), {});

export const JOB_KINDS = {
  // Test restore of a file in the backup folder.
  'test-restore': (db, b, { actor }) => {
    const name = str(b.name); backupPath(name); // refuses a name that is not in the backup folder
    return { label: `Test restore of ${name}`, run: async () => {
      const out = await testRestore(db, name, { passphrase: str(b.passphrase), actor });
      audit('backup.test_restore', `Test restore of ${name}: ${out.ok ? 'passed' : 'failed'}`, { actor, data: { name, ok: out.ok } }); return out;
    } };
  },
  'offsite-test': (db, b, { actor, ip }) => {
    const destination = str(b.destination), name = str(b.name);
    return { label: `Test restore of the offsite copy ${name}`, run: async () => {
      const out = await testOffsiteCopy(db, destination, name, { passphrase: str(b.passphrase), actor });
      audit('backup.test_restore', `Test restore of offsite copy ${name}: ${out.ok ? 'passed' : 'failed'}`, { actor, ip, level: out.ok ? 'info' : 'warn', data: { name, destination, ok: out.ok, source: 'offsite' } }); return out;
    } };
  },
  'file-test': (db, b, { actor, ip }) => ({ label: 'Test of a backup file', run: () => testBackupFile(db, b.source, { passphrase: str(b.passphrase), actor, ip }) }),
  // Restores. Each ends by staging the restore; the job then reports "restarting" and the process restarts (jobs.mjs).
  'restore': (db, b, { actor, ip }) => {
    sqliteOnly(db); needConfirm(b); const name = str(b.name), file = backupPath(name), bundle = name.endsWith('.mbsbak');
    return { label: `Restore of ${name}`, run: async () => {
      if (bundle) { jobStep('Decrypting the backup and checking every part', 2, 85); await stageBundleRestore(file, str(b.passphrase), actor); } // checks the passphrase before anything else happens
      jobStep('Taking a safety copy of the live site', bundle ? 85 : 10, 95); const pre = await createBackup(db, 'pre-restore', actor);
      jobStep('Staging the restore', 95, 99); if (!bundle) stageRestore(name, actor);
      audit('backup.restore', `Restore of ${name} requested (safety copy ${pre}); restarting`, { actor, ip, level: 'warn', data: { name, safetyCopy: pre } });
      return { ok: true, restarting: true, safetyCopy: pre, summary: 'Restored. The site is restarting.' };
    } };
  },
  'offsite-restore': (db, b, { actor, ip }) => {
    sqliteOnly(db); needConfirm(b);
    return { label: `Restore from the offsite copy ${str(b.name)}`, run: async () => {
      try { const out = await restoreOffsiteCopy(db, str(b.destination), str(b.name), { token: b.token, passphrase: str(b.passphrase), actor, ip }); return { ok: true, restarting: true, safetyCopy: out.safetyCopy, summary: 'Restored. The site is restarting.' }; }
      catch (e) { audit('backup.restore', `Restore from the offsite copy ${b.name} refused: ${e.message}`, { actor, ip, level: 'warn', data: { name: b.name, ok: false, source: 'offsite' } }); throw e; }
    } };
  },
  'file-restore': (db, b, { actor, ip }) => {
    sqliteOnly(db); needConfirm(b);
    return { label: 'Restore from a backup file', run: async () => {
      try { const out = await restoreBackupFile(db, { token: b.token, passphrase: str(b.passphrase), actor, ip }); return { ok: true, restarting: true, safetyCopy: out.safetyCopy, summary: 'Restored. The site is restarting.' }; }
      catch (e) { audit('backup.restore', `Restore from an uploaded or placed backup file refused: ${e.message}`, { actor, ip, level: 'warn', data: { ok: false, source: 'file' } }); throw e; }
    } };
  },
  // Full-site backups: the scheduled settings run now, or one by hand with its own passphrase.
  'full-backup': (db, b, { actor }) => ({ label: 'Full-site backup', run: async () => {
    const out = await runFullBackup(db, 'manual', actor); if (!out.ok) throw fail(out.error); return { ...out, summary: `Full-site backup ${out.name} made and verified.` };
  } }),
  'bundle': (db, b, { actor }) => ({ label: 'Full-site backup with a new passphrase', run: async () => {
    const name = await createBundle(db, b.passphrase, actor); audit('backup.run', `Full-site backup ${name} made by hand`, { actor, data: { tier: 'full', name, ok: true } });
    return { ok: true, name, summary: `Full-site backup ${name} made.` };
  } }),
};
